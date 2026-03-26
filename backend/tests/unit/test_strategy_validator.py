"""Tests for strategy validator."""

import pytest
from app.services.validators.strategy_validator import validate_strategy


class TestStrategyValidatorValidInputs:
    """Test strategy validator with valid inputs."""

    def test_valid_scheduler_class_with_handlers(self):
        """Test validation of valid scheduler class."""
        content = """
from pybatsim.scheduler import Scheduler

class MyScheduler(Scheduler):
    def onJobSubmission(self, job):
        pass

    def onJobCompletion(self, job):
        pass

    def onSimulationBegins(self):
        pass
"""
        result = validate_strategy(content, "my_scheduler.py")
        assert result.valid is True
        assert result.metadata["scheduler_class"] == "MyScheduler"
        assert "onJobSubmission" in result.metadata["handler_methods"]

    def test_valid_scheduler_function(self):
        """Test validation of valid scheduler function."""
        content = """
def my_scheduler_function(scheduler):
    pass
"""
        result = validate_strategy(content)
        assert result.valid is True
        assert result.metadata["scheduler_function"] == "my_scheduler_function"

    def test_valid_minimal_class(self):
        """Test minimal class with just onJobSubmission."""
        content = """
class Scheduler:
    def onJobSubmission(self, job):
        self.submit(job)
"""
        result = validate_strategy(content)
        assert result.valid is True
        assert result.metadata["scheduler_class"] == "Scheduler"

    def test_valid_class_with_main(self):
        """Test scheduler with main block."""
        content = """
from pybatsim.scheduler import Scheduler

class MyScheduler(Scheduler):
    def onJobSubmission(self, job):
        pass

def main():
    print("test")

if __name__ == "__main__":
    main()
"""
        result = validate_strategy(content)
        assert result.valid is True
        assert result.metadata["has_main"] is True
        assert result.metadata["has_name_guard"] is True

    def test_valid_with_batsim_import_variants(self):
        """Test validation accepts various batsim import patterns."""
        for import_stmt in [
            "from pybatsim.scheduler import Scheduler",
            "import pybatsim",
            "from batsim import something",
            "import batsim.scheduler"
        ]:
            content = f"""
{import_stmt}

class MyScheduler:
    def onJobSubmission(self, job):
        pass
"""
            result = validate_strategy(content)
            assert result.metadata["imports_batsim"] is True

    def test_valid_function_with_sched_param(self):
        """Test validation detects scheduler function with 'sched' param."""
        content = """
def my_scheduler(sched):
    pass
"""
        result = validate_strategy(content)
        assert result.valid is True
        assert result.metadata["scheduler_function"] == "my_scheduler"

    def test_valid_function_with_scheduler_param(self):
        """Test validation detects scheduler function with 'scheduler' param."""
        content = """
def my_scheduler(scheduler):
    pass
"""
        result = validate_strategy(content)
        assert result.valid is True


class TestStrategyValidatorInvalidPython:
    """Test strategy validator with invalid Python."""

    def test_syntax_error(self):
        """Test validation fails on syntax error."""
        content = """
class MyScheduler
    def onJobSubmission(self, job):
        pass
"""
        result = validate_strategy(content)
        assert result.valid is False
        assert result.errors[0].field == "file"
        assert "syntax error" in result.errors[0].error.lower()

    def test_indentation_error(self):
        """Test validation fails on indentation error."""
        content = """
def my_function():
pass
"""
        result = validate_strategy(content)
        assert result.valid is False

    def test_invalid_import(self):
        """Test validation handles invalid imports gracefully."""
        content = """
from nonexistent import something

class MyScheduler:
    def onJobSubmission(self, job):
        pass
"""
        # Should still validate structure, not execution
        result = validate_strategy(content)
        # Parse should succeed even if import is invalid
        assert result.metadata["scheduler_class"] == "MyScheduler"


class TestStrategyValidatorNoScheduler:
    """Test strategy validator when no scheduler is detected."""

    def test_no_classes_or_functions_error(self):
        """Test validation fails when no classes or functions present."""
        content = """
x = 1
y = 2
"""
        result = validate_strategy(content)
        assert result.valid is False
        assert any("No classes or functions" in e.error for e in result.errors)

    def test_non_scheduler_function_warning(self):
        """Test validation warns on functions without scheduler param."""
        content = """
def my_function(x):
    return x + 1
"""
        result = validate_strategy(content)
        assert result.valid is True
        assert any("No PyBatsim-compatible scheduler" in w.message for w in result.warnings)

    def test_non_scheduler_class_warning(self):
        """Test validation warns on class without handler methods."""
        content = """
class MyClass:
    def __init__(self):
        pass
"""
        result = validate_strategy(content)
        assert result.valid is True
        assert any("No PyBatsim-compatible scheduler" in w.message for w in result.warnings)


class TestStrategyValidatorHandlers:
    """Test strategy validator handler method detection."""

    def test_missing_onJobSubmission_error(self):
        """Test validation fails when onJobSubmission is missing."""
        content = """
class MyScheduler:
    def onJobCompletion(self, job):
        pass
"""
        result = validate_strategy(content)
        assert result.valid is False
        assert any("onJobSubmission" in e.error for e in result.errors)

    def test_missing_optional_handlers_warning(self):
        """Test validation warns on missing optional handlers."""
        content = """
class MyScheduler:
    def onJobSubmission(self, job):
        pass
"""
        result = validate_strategy(content)
        assert result.valid is True
        # Should have warnings about missing handlers
        assert len(result.warnings) > 0
        assert any("onJobCompletion" in w.message for w in result.warnings)

    def test_all_handlers_present(self):
        """Test validation succeeds with all expected handlers."""
        content = """
from pybatsim.scheduler import Scheduler

class MyScheduler(Scheduler):
    def onJobSubmission(self, job):
        pass

    def onJobCompletion(self, job):
        pass

    def onSimulationBegins(self):
        pass
"""
        result = validate_strategy(content)
        assert result.valid is True
        # Only batsim import warning, no handler warnings
        assert not any("Missing recommended" in w.message for w in result.warnings)

    def test_optional_handlers_no_warning(self):
        """Test validation with optional handlers doesn't warn."""
        content = """
class MyScheduler:
    def onJobSubmission(self, job):
        pass

    def onJobCompletion(self, job):
        pass

    def onSimulationBegins(self):
        pass

    def onSimulationEnds(self):
        pass

    def onJobKilled(self, job):
        pass
"""
        result = validate_strategy(content)
        assert result.valid is True
        assert not any("Missing recommended" in w.message for w in result.warnings)


class TestStrategyValidatorImports:
    """Test strategy validator import checks."""

    def test_no_batsim_import_warning(self):
        """Test validation warns when no batsim import."""
        content = """
class MyScheduler:
    def onJobSubmission(self, job):
        pass
"""
        result = validate_strategy(content)
        assert result.valid is True
        assert any("batsim" in w.message for w in result.warnings)

    def test_with_batsim_import_no_warning(self):
        """Test validation doesn't warn with batsim import."""
        content = """
from pybatsim.scheduler import Scheduler

class MyScheduler(Scheduler):
    def onJobSubmission(self, job):
        pass
"""
        result = validate_strategy(content)
        assert not any("batsim" in w.message for w in result.warnings)


class TestStrategyValidatorClassNameMatching:
    """Test strategy validator class name matching."""

    def test_class_name_matches_filename(self):
        """Test validation with matching class name."""
        content = """
from pybatsim.scheduler import Scheduler

class MyScheduler(Scheduler):
    def onJobSubmission(self, job):
        pass
"""
        result = validate_strategy(content, "MyScheduler.py")
        assert result.valid is True
        assert not any("doesn't match expected" in w.message for w in result.warnings)

    def test_class_name_mismatches_filename(self):
        """Test validation warns when class name doesn't match filename."""
        content = """
from pybatsim.scheduler import Scheduler

class DifferentName(Scheduler):
    def onJobSubmission(self, job):
        pass
"""
        result = validate_strategy(content, "my_scheduler.py")
        assert result.valid is True
        assert any("doesn't match expected" in w.message for w in result.warnings)

    def test_filename_conversion_kebab_to_camelcase(self):
        """Test filename conversion from kebab to CamelCase."""
        content = """
class MyScheduler:
    def onJobSubmission(self, job):
        pass
"""
        result = validate_strategy(content, "my-scheduler.py")
        # "my-scheduler" -> "My-scheduler" which doesn't match "MyScheduler"
        assert any("doesn't match expected" in w.message for w in result.warnings)

    def test_filename_single_char(self):
        """Test filename with single character."""
        content = """
class A:
    def onJobSubmission(self, job):
        pass
"""
        result = validate_strategy(content, "a.py")
        assert result.valid is True
        assert not any("doesn't match expected" in w.message for w in result.warnings)


class TestStrategyValidatorMetadata:
    """Test strategy validator metadata extraction."""

    def test_metadata_handler_methods(self):
        """Test metadata includes handler methods."""
        content = """
class MyScheduler:
    def onJobSubmission(self, job):
        pass

    def onJobCompletion(self, job):
        pass

    def onSimulationBegins(self):
        pass
"""
        result = validate_strategy(content)
        handlers = result.metadata["handler_methods"]
        assert "onJobSubmission" in handlers
        assert "onJobCompletion" in handlers
        assert "onSimulationBegins" in handlers

    def test_metadata_no_main(self):
        """Test metadata reflects no main function."""
        content = """
class MyScheduler:
    def onJobSubmission(self, job):
        pass
"""
        result = validate_strategy(content)
        assert result.metadata["has_main"] is False

    def test_metadata_with_main(self):
        """Test metadata reflects main function presence."""
        content = """
class MyScheduler:
    def onJobSubmission(self, job):
        pass

def main():
    pass
"""
        result = validate_strategy(content)
        assert result.metadata["has_main"] is True

    def test_metadata_with_name_guard(self):
        """Test metadata reflects name guard."""
        content = """
class MyScheduler:
    def onJobSubmission(self, job):
        pass

if __name__ == "__main__":
    pass
"""
        result = validate_strategy(content)
        assert result.metadata["has_name_guard"] is True

    def test_metadata_no_name_guard(self):
        """Test metadata reflects missing name guard."""
        content = """
class MyScheduler:
    def onJobSubmission(self, job):
        pass
"""
        result = validate_strategy(content)
        assert result.metadata["has_name_guard"] is False


class TestStrategyValidatorComplexScenarios:
    """Test strategy validator with complex real-world scenarios."""

    def test_complex_scheduler_with_helper_methods(self):
        """Test validation of complex scheduler with helper methods."""
        content = """
from pybatsim.scheduler import Scheduler

def main():
    print("Test")

class ComplexScheduler(Scheduler):
    def __init__(self):
        self.queue = []

    def onJobSubmission(self, job):
        self.queue.append(job)
        self._process_queue()

    def onJobCompletion(self, job):
        self._log_completion(job)

    def onSimulationBegins(self):
        self._initialize()

    def _process_queue(self):
        pass

    def _log_completion(self, job):
        pass

    def _initialize(self):
        pass

if __name__ == "__main__":
    main()
"""
        result = validate_strategy(content, "complex_scheduler.py")
        assert result.valid is True
        assert result.metadata["scheduler_class"] == "ComplexScheduler"
        assert result.metadata["has_main"] is True
        assert result.metadata["has_name_guard"] is True

    def test_scheduler_with_multiple_classes(self):
        """Test validation picks first scheduler class with handlers."""
        content = """
class Helper:
    def onJobSubmission(self, job):
        pass

class MyScheduler:
    def onJobSubmission(self, job):
        pass
"""
        result = validate_strategy(content)
        # Should pick the first one with onJobSubmission
        assert result.metadata["scheduler_class"] in ["Helper", "MyScheduler"]

    def test_async_scheduler_methods(self):
        """Test validation recognizes async methods."""
        content = """
class MyScheduler:
    async def onJobSubmission(self, job):
        pass
"""
        result = validate_strategy(content)
        assert result.valid is True
        assert result.metadata["scheduler_class"] == "MyScheduler"

    def test_mixed_sync_async_methods(self):
        """Test validation with mixed sync/async methods."""
        content = """
from pybatsim.scheduler import Scheduler

class MyScheduler(Scheduler):
    def onJobSubmission(self, job):
        pass

    async def onJobCompletion(self, job):
        pass

    def onSimulationBegins(self):
        pass
"""
        result = validate_strategy(content)
        assert result.valid is True
        assert not any("Missing recommended" in w.message for w in result.warnings)
