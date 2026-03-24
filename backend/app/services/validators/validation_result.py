"""Shared validation result type used by all validators."""

from dataclasses import dataclass, field


@dataclass
class ValidationError:
    field: str
    error: str
    suggestion: str = ""


@dataclass
class ValidationWarning:
    field: str
    message: str


@dataclass
class ValidationResult:
    valid: bool = True
    errors: list[ValidationError] = field(default_factory=list)
    warnings: list[ValidationWarning] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

    def add_error(self, field_name: str, error: str, suggestion: str = ""):
        self.valid = False
        self.errors.append(ValidationError(field_name, error, suggestion))

    def add_warning(self, field_name: str, message: str):
        self.warnings.append(ValidationWarning(field_name, message))

    def to_dict(self) -> dict:
        return {
            "valid": self.valid,
            "errors": [
                {"field": e.field, "error": e.error, "suggestion": e.suggestion}
                for e in self.errors
            ],
            "warnings": [
                {"field": w.field, "message": w.message}
                for w in self.warnings
            ],
            "metadata": self.metadata,
        }
