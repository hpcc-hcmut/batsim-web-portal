"""Tests for ValidationResult data class."""

import pytest
from app.services.validators.validation_result import ValidationResult, ValidationError, ValidationWarning


class TestValidationResult:
    """Test ValidationResult class methods and behavior."""

    def test_initial_state(self):
        """Test ValidationResult initializes with valid=True and empty lists."""
        result = ValidationResult()
        assert result.valid is True
        assert result.errors == []
        assert result.warnings == []
        assert result.metadata == {}

    def test_add_error_sets_invalid(self):
        """Test adding an error sets valid=False."""
        result = ValidationResult()
        result.add_error("field1", "error message")
        assert result.valid is False
        assert len(result.errors) == 1
        assert result.errors[0].field == "field1"
        assert result.errors[0].error == "error message"
        assert result.errors[0].suggestion == ""

    def test_add_error_with_suggestion(self):
        """Test adding an error with suggestion."""
        result = ValidationResult()
        result.add_error("field1", "error message", "suggestion text")
        assert result.errors[0].suggestion == "suggestion text"

    def test_add_multiple_errors(self):
        """Test adding multiple errors."""
        result = ValidationResult()
        result.add_error("field1", "error1")
        result.add_error("field2", "error2")
        assert len(result.errors) == 2
        assert result.valid is False

    def test_add_warning(self):
        """Test adding a warning keeps valid=True."""
        result = ValidationResult()
        result.add_warning("field1", "warning message")
        assert result.valid is True
        assert len(result.warnings) == 1
        assert result.warnings[0].field == "field1"
        assert result.warnings[0].message == "warning message"

    def test_add_warning_with_errors_keeps_invalid(self):
        """Test adding warning after error doesn't change valid status."""
        result = ValidationResult()
        result.add_error("field1", "error")
        result.add_warning("field2", "warning")
        assert result.valid is False
        assert len(result.errors) == 1
        assert len(result.warnings) == 1

    def test_to_dict_valid_result(self):
        """Test to_dict() for valid result."""
        result = ValidationResult()
        result.metadata["key"] = "value"
        data = result.to_dict()
        assert data["valid"] is True
        assert data["errors"] == []
        assert data["warnings"] == []
        assert data["metadata"] == {"key": "value"}

    def test_to_dict_invalid_result(self):
        """Test to_dict() for invalid result with errors."""
        result = ValidationResult()
        result.add_error("field1", "error message", "suggestion")
        data = result.to_dict()
        assert data["valid"] is False
        assert len(data["errors"]) == 1
        assert data["errors"][0]["field"] == "field1"
        assert data["errors"][0]["error"] == "error message"
        assert data["errors"][0]["suggestion"] == "suggestion"

    def test_to_dict_with_warnings(self):
        """Test to_dict() includes warnings."""
        result = ValidationResult()
        result.add_warning("field1", "warning message")
        data = result.to_dict()
        assert len(data["warnings"]) == 1
        assert data["warnings"][0]["field"] == "field1"
        assert data["warnings"][0]["message"] == "warning message"

    def test_validation_error_dataclass(self):
        """Test ValidationError dataclass."""
        error = ValidationError("field1", "error text", "suggestion text")
        assert error.field == "field1"
        assert error.error == "error text"
        assert error.suggestion == "suggestion text"

    def test_validation_warning_dataclass(self):
        """Test ValidationWarning dataclass."""
        warning = ValidationWarning("field1", "warning text")
        assert warning.field == "field1"
        assert warning.message == "warning text"
