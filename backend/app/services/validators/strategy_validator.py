"""
Strategy validator for PyBatsim scheduler Python files.

PyBatsim scheduler contract:
- Must be valid Python (AST-parseable)
- Should contain a scheduler class or function compatible with PyBatsim
- PyBatsim CLI looks for: CamelCase class matching filename, or a function
- Common scheduler patterns: class with onJobSubmission, or function decorated with @as_scheduler

Imports are checked against an allow-list (stdlib + libs declared in the PyBatSim
runtime manifest). Rejecting unknown imports at upload time gives the researcher
a fail-fast UX instead of an opaque ImportError mid-simulation.
"""

import ast
from typing import Iterable

from app.core.runtime_manifest import get_allowed_top_level_modules
from app.services.validators.validation_result import ValidationResult

# Event handlers that PyBatsim schedulers typically implement
EXPECTED_HANDLERS = {"onJobSubmission", "onJobCompletion", "onSimulationBegins"}
OPTIONAL_HANDLERS = {"onSimulationEnds", "onJobKilled", "onJobMessage",
                     "onMachinePStateChanged", "onReportEnergyConsumed",
                     "onRequestedCall"}


def _collect_top_level_imports(tree: ast.AST) -> set[str]:
    """Return the top-level module names imported by the strategy.

    Handles both `import foo.bar` (top-level = foo) and `from foo.bar import baz`
    (top-level = foo). Relative `from . import x` is skipped — strategies don't
    have a package context inside the container.
    """
    seen: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                top = alias.name.split(".", 1)[0].strip()
                if top:
                    seen.add(top.lower())
        elif isinstance(node, ast.ImportFrom):
            if node.level and node.level > 0:
                continue  # relative import, ignore
            if node.module:
                top = node.module.split(".", 1)[0].strip()
                if top:
                    seen.add(top.lower())
    return seen


def _detect_dynamic_imports(tree: ast.AST) -> list[str]:
    """Return a list of dynamic-import call sites that bypass the AST whitelist.

    Patterns flagged:
      __import__("foo")
      importlib.import_module("foo")
      importlib.__import__("foo")

    Static analysis can't follow dynamic strings, so we surface the call and let
    the operator decide. A literal string arg is reported; non-literal args
    ("dynamic value") are also flagged for review.
    """
    findings: list[str] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        name: str | None = None
        if isinstance(func, ast.Name) and func.id == "__import__":
            name = "__import__"
        elif isinstance(func, ast.Attribute) and func.attr in ("import_module", "__import__"):
            # importlib.import_module / importlib.__import__ (or any object.import_module)
            name = f"{getattr(func.value, 'id', '?')}.{func.attr}"
        if name is None:
            continue
        arg_desc = "<dynamic>"
        if node.args:
            first = node.args[0]
            if isinstance(first, ast.Constant) and isinstance(first.value, str):
                arg_desc = repr(first.value)
        findings.append(f"{name}({arg_desc}) at line {node.lineno}")
    return findings


def _check_import_whitelist(imports: Iterable[str], result: ValidationResult) -> None:
    """Reject imports that aren't in the allow-list — fail-fast at upload."""
    allowed = get_allowed_top_level_modules()
    for imp in sorted(imports):
        if imp not in allowed:
            result.add_error(
                f"imports.{imp}",
                f"Module '{imp}' is not available in the PyBatSim container",
                "Contact the operator to add it to docker/pybatsim-extended/Dockerfile, "
                "or remove the import. Available libraries are listed on the Strategies page banner.",
            )


def validate_strategy(content: str, filename: str = "") -> ValidationResult:
    """Validate a PyBatsim scheduler Python file. Returns ValidationResult."""
    result = ValidationResult()

    # Parse AST
    try:
        tree = ast.parse(content)
    except SyntaxError as e:
        result.add_error("file", f"Python syntax error at line {e.lineno}: {e.msg}",
                         "Fix the syntax error and re-upload")
        return result

    # Analyze the AST
    classes = []
    functions = []
    has_main = False
    has_name_guard = False
    imports_batsim = False

    top_level_imports = _collect_top_level_imports(tree)
    imports_batsim = any(name in ("batsim", "pybatsim") for name in top_level_imports)

    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            classes.append(node)
        elif isinstance(node, ast.FunctionDef):
            functions.append(node)
            if node.name == "main":
                has_main = True
        elif isinstance(node, ast.If):
            # Check for if __name__ == "__main__"
            if (isinstance(node.test, ast.Compare)
                    and isinstance(node.test.left, ast.Name)
                    and node.test.left.id == "__name__"):
                has_name_guard = True

    # Reject imports outside the runtime whitelist — fail-fast at upload time.
    _check_import_whitelist(top_level_imports, result)

    # Dynamic imports can side-step the AST whitelist. Surface them so the operator
    # knows the static check isn't a complete guarantee — error not warning so the
    # researcher can rewrite to a static import (or admin can authorise the bypass).
    for finding in _detect_dynamic_imports(tree):
        result.add_error(
            "imports.dynamic",
            f"Dynamic import bypass detected: {finding}",
            "Use a top-level `import` statement instead so the validator can check it. "
            "Dynamic imports can load arbitrary modules at runtime and defeat the whitelist.",
        )

    # Check for scheduler class
    scheduler_class = None
    handler_methods = set()
    for cls in classes:
        methods = {m.name for m in cls.body if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef))}
        # A scheduler class should have at least onJobSubmission
        if methods & EXPECTED_HANDLERS:
            scheduler_class = cls.name
            handler_methods = methods & (EXPECTED_HANDLERS | OPTIONAL_HANDLERS)
            break

    # Check for scheduler function (functional style like filler_sched)
    scheduler_function = None
    for func in functions:
        # Functions with 'scheduler' as first param are likely scheduler functions
        if func.args.args and len(func.args.args) >= 1:
            first_arg = func.args.args[0].arg
            if first_arg in ("scheduler", "sched", "self"):
                if func.name != "main" and func.name != "__init__":
                    scheduler_function = func.name
                    break

    # Validation checks
    if not scheduler_class and not scheduler_function:
        if len(classes) == 0 and len(functions) == 0:
            result.add_error("scheduler", "No classes or functions found",
                             "Add a scheduler class with onJobSubmission method "
                             "or a scheduler function")
        else:
            result.add_warning("scheduler",
                               "No PyBatsim-compatible scheduler detected. "
                               "Expected a class with onJobSubmission method "
                               "or a function with 'scheduler' as first parameter")

    if scheduler_class:
        missing = EXPECTED_HANDLERS - handler_methods
        if "onJobSubmission" not in handler_methods:
            result.add_error(f"class.{scheduler_class}.onJobSubmission",
                             "Missing required handler 'onJobSubmission'",
                             "Add: def onJobSubmission(self, job): ...")
        for handler in missing - {"onJobSubmission"}:
            result.add_warning(f"class.{scheduler_class}.{handler}",
                               f"Missing recommended handler '{handler}'")

    if not imports_batsim:
        result.add_warning("imports", "No batsim/pybatsim import found. "
                           "Scheduler may not integrate with PyBatsim runtime")

    # PyBatsim CLI compatibility: check if class name matches expected CamelCase of filename
    if filename and scheduler_class:
        expected_class = _filename_to_class(filename)
        if scheduler_class != expected_class:
            result.add_warning("class_name",
                               f"Class '{scheduler_class}' doesn't match expected "
                               f"'{expected_class}' (from filename '{filename}'). "
                               f"PyBatsim CLI may not auto-discover it")

    # Store metadata
    result.metadata["has_main"] = has_main
    result.metadata["has_name_guard"] = has_name_guard
    result.metadata["scheduler_class"] = scheduler_class
    result.metadata["scheduler_function"] = scheduler_function
    result.metadata["handler_methods"] = sorted(handler_methods) if handler_methods else []
    result.metadata["imports_batsim"] = imports_batsim
    result.metadata["top_level_imports"] = sorted(top_level_imports)

    return result


def _filename_to_class(filename: str) -> str:
    """Convert filename to expected CamelCase class name (PyBatsim convention)."""
    module = filename.rsplit(".", 1)[0] if "." in filename else filename
    return module[0].upper() + module[1:] if module else ""
