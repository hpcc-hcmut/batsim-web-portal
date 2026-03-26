"""Tests for workload validator."""

import json
import pytest
from app.services.validators.workload_validator import validate_workload


class TestWorkloadValidatorValidInputs:
    """Test workload validator with valid inputs."""

    def test_valid_minimal_workload(self):
        """Test validation of minimal valid workload."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": [{"id": 0, "subtime": 0, "res": 2, "walltime": 10, "profile": "1"}],
            "profiles": {"1": {"type": "delay", "delay": 10}}
        })
        result = validate_workload(content)
        assert result.valid is True
        assert len(result.errors) == 0
        assert result.metadata["nb_res"] == 4
        assert result.metadata["job_count"] == 1
        assert result.metadata["profile_count"] == 1

    def test_valid_complex_workload(self):
        """Test validation of complex workload with multiple jobs and profiles."""
        content = json.dumps({
            "nb_res": 16,
            "jobs": [
                {"id": 0, "subtime": 0, "res": 4, "walltime": 100, "profile": "compute1"},
                {"id": 1, "subtime": 10, "res": 8, "walltime": 200, "profile": "compute2"},
                {"id": 2, "subtime": 50, "res": 2, "walltime": 50, "profile": "io1"}
            ],
            "profiles": {
                "compute1": {"type": "parallel", "cpu": 4000},
                "compute2": {"type": "parallel", "cpu": 8000},
                "io1": {"type": "send", "src": 0, "dst": 1, "amount": 1000000}
            }
        })
        result = validate_workload(content)
        assert result.valid is True
        assert result.metadata["job_count"] == 3
        assert result.metadata["profile_count"] == 3

    def test_valid_various_profile_types(self):
        """Test validation with various valid profile types."""
        profiles = {
            "delay": {"type": "delay"},
            "parallel": {"type": "parallel"},
            "parallel_homogeneous": {"type": "parallel_homogeneous"},
            "parallel_homogeneous_total": {"type": "parallel_homogeneous_total"},
            "composed": {"type": "composed"},
            "parallel_homogeneous_pfs": {"type": "parallel_homogeneous_pfs"},
            "data_staging": {"type": "data_staging"},
            "send": {"type": "send"},
            "receive": {"type": "receive"}
        }
        content = json.dumps({
            "nb_res": 10,
            "jobs": [{"id": i, "subtime": i*10, "res": 1, "walltime": 10, "profile": name}
                     for i, name in enumerate(profiles.keys())],
            "profiles": profiles
        })
        result = validate_workload(content)
        assert result.valid is True

    def test_valid_float_timestamps_and_walltime(self):
        """Test validation accepts float values for subtime and walltime."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": [{"id": 0, "subtime": 0.5, "res": 2, "walltime": 10.75, "profile": "1"}],
            "profiles": {"1": {"type": "delay", "delay": 10}}
        })
        result = validate_workload(content)
        assert result.valid is True


class TestWorkloadValidatorInvalidJSON:
    """Test workload validator with invalid JSON."""

    def test_invalid_json_syntax(self):
        """Test validation fails on invalid JSON syntax."""
        result = validate_workload("{invalid json")
        assert result.valid is False
        assert len(result.errors) == 1
        assert result.errors[0].field == "file"
        assert "Invalid JSON" in result.errors[0].error

    def test_not_json_object_root(self):
        """Test validation fails when root is not a JSON object."""
        result = validate_workload("[1, 2, 3]")
        assert result.valid is False
        assert result.errors[0].field == "file"
        assert "must be a JSON object" in result.errors[0].error


class TestWorkloadValidatorNbRes:
    """Test workload validator nb_res field."""

    def test_missing_nb_res(self):
        """Test validation fails when nb_res is missing."""
        content = json.dumps({
            "jobs": [{"id": 0, "subtime": 0, "res": 2, "walltime": 10, "profile": "1"}],
            "profiles": {"1": {"type": "delay"}}
        })
        result = validate_workload(content)
        assert result.valid is False
        assert any(e.field == "nb_res" for e in result.errors)

    def test_nb_res_not_positive_integer(self):
        """Test validation fails when nb_res is not positive integer."""
        for val in [0, -1, 3.14, "4", None]:
            content = json.dumps({
                "nb_res": val,
                "jobs": [{"id": 0, "subtime": 0, "res": 2, "walltime": 10, "profile": "1"}],
                "profiles": {"1": {"type": "delay"}}
            })
            result = validate_workload(content)
            assert result.valid is False
            assert any(e.field == "nb_res" for e in result.errors)

    def test_nb_res_positive_integer(self):
        """Test validation succeeds with positive integer nb_res."""
        for val in [1, 4, 1000]:
            content = json.dumps({
                "nb_res": val,
                "jobs": [{"id": 0, "subtime": 0, "res": 1, "walltime": 10, "profile": "1"}],
                "profiles": {"1": {"type": "delay"}}
            })
            result = validate_workload(content)
            assert result.valid is True


class TestWorkloadValidatorProfiles:
    """Test workload validator profiles field."""

    def test_missing_profiles(self):
        """Test validation fails when profiles is missing."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": [{"id": 0, "subtime": 0, "res": 2, "walltime": 10, "profile": "1"}]
        })
        result = validate_workload(content)
        assert result.valid is False
        assert any(e.field == "profiles" for e in result.errors)

    def test_profiles_not_dict(self):
        """Test validation fails when profiles is not a dict."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": [{"id": 0, "subtime": 0, "res": 2, "walltime": 10, "profile": "1"}],
            "profiles": ["1", "2"]
        })
        result = validate_workload(content)
        assert result.valid is False
        assert any(e.field == "profiles" for e in result.errors)

    def test_empty_profiles(self):
        """Test validation fails when profiles dict is empty."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": [{"id": 0, "subtime": 0, "res": 2, "walltime": 10, "profile": "1"}],
            "profiles": {}
        })
        result = validate_workload(content)
        assert result.valid is False
        assert any(e.field == "profiles" for e in result.errors)

    def test_profile_not_dict(self):
        """Test validation fails when profile value is not a dict."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": [{"id": 0, "subtime": 0, "res": 2, "walltime": 10, "profile": "1"}],
            "profiles": {"1": "not_a_dict"}
        })
        result = validate_workload(content)
        assert result.valid is False
        assert any("profiles" in e.field for e in result.errors)

    def test_profile_missing_type(self):
        """Test validation fails when profile is missing 'type' field."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": [{"id": 0, "subtime": 0, "res": 2, "walltime": 10, "profile": "1"}],
            "profiles": {"1": {"delay": 10}}
        })
        result = validate_workload(content)
        assert result.valid is False
        assert any("type" in e.error for e in result.errors)

    def test_profile_unknown_type_warning(self):
        """Test validation warns on unknown profile type."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": [{"id": 0, "subtime": 0, "res": 2, "walltime": 10, "profile": "1"}],
            "profiles": {"1": {"type": "unknown_type"}}
        })
        result = validate_workload(content)
        assert result.valid is True  # Unknown type is warning, not error
        assert any("Unknown profile type" in w.message for w in result.warnings)


class TestWorkloadValidatorJobs:
    """Test workload validator jobs field."""

    def test_missing_jobs(self):
        """Test validation fails when jobs is missing."""
        content = json.dumps({
            "nb_res": 4,
            "profiles": {"1": {"type": "delay"}}
        })
        result = validate_workload(content)
        assert result.valid is False
        assert any(e.field == "jobs" for e in result.errors)

    def test_jobs_not_array(self):
        """Test validation fails when jobs is not an array."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": {"0": {}},
            "profiles": {"1": {"type": "delay"}}
        })
        result = validate_workload(content)
        assert result.valid is False
        assert any(e.field == "jobs" for e in result.errors)

    def test_empty_jobs_array(self):
        """Test validation fails when jobs array is empty."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": [],
            "profiles": {"1": {"type": "delay"}}
        })
        result = validate_workload(content)
        assert result.valid is False
        assert any(e.field == "jobs" for e in result.errors)

    def test_job_not_dict(self):
        """Test validation fails when job is not a dict."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": ["not_a_dict"],
            "profiles": {"1": {"type": "delay"}}
        })
        result = validate_workload(content)
        assert result.valid is False
        assert any("jobs[0]" in e.field for e in result.errors)


class TestWorkloadValidatorJobFields:
    """Test workload validator job field requirements."""

    def test_missing_job_id(self):
        """Test validation fails when job id is missing."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": [{"subtime": 0, "res": 2, "walltime": 10, "profile": "1"}],
            "profiles": {"1": {"type": "delay"}}
        })
        result = validate_workload(content)
        assert result.valid is False
        assert any("id" in e.field for e in result.errors)

    def test_invalid_job_id(self):
        """Test validation fails with invalid job id."""
        for val in [-1, 3.14, "0"]:
            content = json.dumps({
                "nb_res": 4,
                "jobs": [{"id": val, "subtime": 0, "res": 2, "walltime": 10, "profile": "1"}],
                "profiles": {"1": {"type": "delay"}}
            })
            result = validate_workload(content)
            assert result.valid is False
            assert any("id" in e.field for e in result.errors)

    def test_duplicate_job_ids(self):
        """Test validation fails with duplicate job ids."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": [
                {"id": 0, "subtime": 0, "res": 2, "walltime": 10, "profile": "1"},
                {"id": 0, "subtime": 10, "res": 2, "walltime": 10, "profile": "1"}
            ],
            "profiles": {"1": {"type": "delay"}}
        })
        result = validate_workload(content)
        assert result.valid is False
        assert any("Duplicate job ID" in e.error for e in result.errors)

    def test_missing_job_subtime(self):
        """Test validation fails when job subtime is missing."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": [{"id": 0, "res": 2, "walltime": 10, "profile": "1"}],
            "profiles": {"1": {"type": "delay"}}
        })
        result = validate_workload(content)
        assert result.valid is False
        assert any("subtime" in e.field for e in result.errors)

    def test_invalid_job_subtime(self):
        """Test validation fails with invalid subtime."""
        for val in [-1, "0"]:
            content = json.dumps({
                "nb_res": 4,
                "jobs": [{"id": 0, "subtime": val, "res": 2, "walltime": 10, "profile": "1"}],
                "profiles": {"1": {"type": "delay"}}
            })
            result = validate_workload(content)
            assert result.valid is False
            assert any("subtime" in e.field for e in result.errors)

    def test_missing_job_res(self):
        """Test validation fails when job res is missing."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": [{"id": 0, "subtime": 0, "walltime": 10, "profile": "1"}],
            "profiles": {"1": {"type": "delay"}}
        })
        result = validate_workload(content)
        assert result.valid is False
        assert any("res" in e.field for e in result.errors)

    def test_invalid_job_res(self):
        """Test validation fails with invalid res."""
        for val in [0, -1, 3.14, "2"]:
            content = json.dumps({
                "nb_res": 4,
                "jobs": [{"id": 0, "subtime": 0, "res": val, "walltime": 10, "profile": "1"}],
                "profiles": {"1": {"type": "delay"}}
            })
            result = validate_workload(content)
            assert result.valid is False
            assert any("res" in e.field for e in result.errors)

    def test_missing_job_profile(self):
        """Test validation fails when job profile is missing."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": [{"id": 0, "subtime": 0, "res": 2, "walltime": 10}],
            "profiles": {"1": {"type": "delay"}}
        })
        result = validate_workload(content)
        assert result.valid is False
        assert any("profile" in e.field for e in result.errors)

    def test_job_profile_nonexistent(self):
        """Test validation fails when job references non-existent profile."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": [{"id": 0, "subtime": 0, "res": 2, "walltime": 10, "profile": "999"}],
            "profiles": {"1": {"type": "delay"}}
        })
        result = validate_workload(content)
        assert result.valid is False
        assert any("non-existent profile" in e.error for e in result.errors)

    def test_missing_walltime_warning(self):
        """Test validation warns when walltime is missing."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": [{"id": 0, "subtime": 0, "res": 2, "profile": "1"}],
            "profiles": {"1": {"type": "delay"}}
        })
        result = validate_workload(content)
        assert result.valid is True
        assert any("walltime" in w.field for w in result.warnings)

    def test_invalid_walltime_error(self):
        """Test validation fails with invalid walltime."""
        for val in [0, -1, "10"]:
            content = json.dumps({
                "nb_res": 4,
                "jobs": [{"id": 0, "subtime": 0, "res": 2, "walltime": val, "profile": "1"}],
                "profiles": {"1": {"type": "delay"}}
            })
            result = validate_workload(content)
            assert result.valid is False
            assert any("walltime" in e.field for e in result.errors)


class TestWorkloadValidatorCrossReferences:
    """Test workload validator cross-reference checks."""

    def test_job_res_exceeds_nb_res_warning(self):
        """Test validation warns when job requests more resources than available."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": [{"id": 0, "subtime": 0, "res": 8, "walltime": 10, "profile": "1"}],
            "profiles": {"1": {"type": "delay"}}
        })
        result = validate_workload(content)
        assert result.valid is True
        assert any("Requests" in w.message and "platform" in w.message for w in result.warnings)

    def test_valid_job_res_within_nb_res(self):
        """Test validation succeeds when job res <= nb_res."""
        content = json.dumps({
            "nb_res": 4,
            "jobs": [{"id": 0, "subtime": 0, "res": 4, "walltime": 10, "profile": "1"}],
            "profiles": {"1": {"type": "delay"}}
        })
        result = validate_workload(content)
        assert result.valid is True
        assert not any("requests" in w.message for w in result.warnings)


class TestWorkloadValidatorMetadata:
    """Test workload validator metadata extraction."""

    def test_metadata_extraction_valid(self):
        """Test metadata is properly extracted for valid workload."""
        content = json.dumps({
            "nb_res": 16,
            "jobs": [
                {"id": 0, "subtime": 0, "res": 4, "walltime": 100, "profile": "p1"},
                {"id": 1, "subtime": 10, "res": 4, "walltime": 100, "profile": "p2"}
            ],
            "profiles": {
                "p1": {"type": "delay"},
                "p2": {"type": "parallel"},
                "p3": {"type": "send"}
            }
        })
        result = validate_workload(content)
        assert result.metadata["nb_res"] == 16
        assert result.metadata["job_count"] == 2
        assert result.metadata["profile_count"] == 3
