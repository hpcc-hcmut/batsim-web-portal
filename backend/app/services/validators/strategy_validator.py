"""
Strategy validator for PyBatsim scheduler Python files.

PyBatsim scheduler contract:
- Must be valid Python (AST-parseable)
- Should contain a scheduler class or function compatible with PyBatsim
- PyBatsim CLI looks for: CamelCase class matching filename, or a function
- Common scheduler patterns: class with onJobSubmission, or function decorated with @as_scheduler
"""

import ast
from app.services.validators.validation_result import ValidationResult

# Event handlers that PyBatsim schedulers typically implement
EXPECTED_HANDLERS = {"onJobSubmission", "onJobCompletion", "onSimulationBegins"}
OPTIONAL_HANDLERS = {"onSimulationEnds", "onJobKilled", "onJobMessage",
                     "onMachinePStateChanged", "onReportEnergyConsumed",
                     "onRequestedCall"}


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
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            module = ""
            if isinstance(node, ast.ImportFrom) and node.module:
                module = node.module
            elif isinstance(node, ast.Import):
                module = ".".join(a.name for a in node.names)
            if "batsim" in module.lower() or "pybatsim" in module.lower():
                imports_batsim = True

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

    return result


def _filename_to_class(filename: str) -> str:
    """Convert filename to expected CamelCase class name (PyBatsim convention)."""
    module = filename.rsplit(".", 1)[0] if "." in filename else filename
    return module[0].upper() + module[1:] if module else ""
