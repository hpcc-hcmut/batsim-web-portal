"""Unit tests for core/workload_helpers.py — workload jobs parsing + summary + pagination.

Pure functions over JSON text; no DB needed.
"""
import json

import pytest

from app.core import workload_helpers
from app.core.workload_helpers import (
    parse_workload_payload,
    compute_summary,
    slice_jobs,
    WorkloadPayloadTooLarge,
)


# --------------------------------------------------------------------------
# parse_workload_payload / _safe_parse
# --------------------------------------------------------------------------
class TestParseWorkloadPayload:
    def test_valid_jobs_and_profiles(self):
        jobs_text = json.dumps([{"id": 0, "walltime": 10, "res": 2, "subtime": 0}])
        profiles_text = json.dumps({"p1": {"type": "delay", "delay": 10}})
        jobs, profiles = parse_workload_payload(jobs_text, profiles_text)
        assert len(jobs) == 1
        assert profiles == {"p1": {"type": "delay", "delay": 10}}

    def test_invalid_json_returns_empty(self):
        jobs, profiles = parse_workload_payload("{not json", "also bad")
        assert jobs == []
        assert profiles == {}

    def test_non_list_jobs_ignored(self):
        jobs, profiles = parse_workload_payload(json.dumps({"a": 1}), None)
        assert jobs == []
        assert profiles == {}

    def test_none_inputs(self):
        assert parse_workload_payload(None, None) == ([], {})

    def test_too_large_payload_raises(self, monkeypatch):
        # Lower the ceiling so we don't need a 150MB string
        monkeypatch.setattr(workload_helpers, "MAX_PARSE_BYTES", 10)
        with pytest.raises(WorkloadPayloadTooLarge):
            parse_workload_payload("x" * 50, None)  # unique str -> not lru-cached


# --------------------------------------------------------------------------
# compute_summary
# --------------------------------------------------------------------------
class TestComputeSummary:
    def test_empty_jobs(self):
        s = compute_summary([], {"p1": {}})
        assert s["n_jobs"] == 0
        assert s["n_profiles"] == 1
        assert s["min_walltime"] is None
        assert s["mean_walltime"] is None

    def test_aggregates(self):
        jobs = [
            {"walltime": 10, "res": 2, "subtime": 0},
            {"walltime": 20, "res": 4, "subtime": 5},
        ]
        s = compute_summary(jobs, {})
        assert s["n_jobs"] == 2
        assert s["min_walltime"] == 10
        assert s["max_walltime"] == 20
        assert s["mean_walltime"] == 15.0
        assert s["total_walltime"] == 30.0
        assert s["min_res"] == 2
        assert s["max_res"] == 4
        assert s["earliest_subtime"] == 0
        assert s["latest_subtime"] == 5

    def test_invalid_fields_skipped(self):
        jobs = [
            {"walltime": 0, "res": "x", "subtime": -1},   # all invalid
            {"walltime": 8, "res": 1, "subtime": 2},
        ]
        s = compute_summary(jobs, {})
        assert s["n_jobs"] == 2          # count is raw length
        assert s["min_walltime"] == 8    # walltime 0 skipped
        assert s["min_res"] == 1         # res "x" skipped
        assert s["earliest_subtime"] == 2  # subtime -1 skipped


# --------------------------------------------------------------------------
# slice_jobs
# --------------------------------------------------------------------------
class TestSliceJobs:
    JOBS = [{"id": i} for i in range(10)]

    def test_normal_slice(self):
        assert slice_jobs(self.JOBS, offset=1, limit=2) == [{"id": 1}, {"id": 2}]

    def test_negative_offset_clamped(self):
        assert slice_jobs(self.JOBS, offset=-5, limit=2) == [{"id": 0}, {"id": 1}]

    def test_limit_below_one_clamped(self):
        assert slice_jobs(self.JOBS, offset=0, limit=0) == [{"id": 0}]

    def test_limit_capped_at_500(self):
        big = [{"id": i} for i in range(600)]
        assert len(slice_jobs(big, offset=0, limit=1000)) == 500
