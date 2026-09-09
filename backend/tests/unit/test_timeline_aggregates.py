"""Unit tests for post_processing/timeline.py — Replay-tab aggregate derivation.

Pure-function module: feed synthetic out_jobs.csv strings, assert the
TimelineResponse-shaped dict. No DB / Docker needed.
"""
from app.services.post_processing.timeline import (
    _parse_allocated_resources,
    _safe_float,
    _row_to_timeline_job,
    _build_waiting_cdf,
    derive_timeline_aggregates,
)

# Columns that _row_to_timeline_job reads from BatSim's out_jobs.csv
_HEADER = (
    "job_id,submission_time,starting_time,finish_time,waiting_time,"
    "execution_time,turnaround_time,requested_number_of_resources,"
    "allocated_resources,success,final_state,stretch"
)


def _csv(*rows: str) -> str:
    return _HEADER + "\n" + "\n".join(rows) + ("\n" if rows else "")


# --------------------------------------------------------------------------
# _parse_allocated_resources
# --------------------------------------------------------------------------
class TestParseAllocatedResources:
    def test_space_separated_ids(self):
        assert _parse_allocated_resources("0 1 2 3") == [0, 1, 2, 3]

    def test_range_syntax(self):
        assert _parse_allocated_resources("0-3") == [0, 1, 2, 3]

    def test_mixed_single_and_range(self):
        assert _parse_allocated_resources("0 2-4 7") == [0, 2, 3, 4, 7]

    def test_negative_token_rejected(self):
        assert _parse_allocated_resources("-5") == []

    def test_empty_and_none(self):
        assert _parse_allocated_resources("") == []
        assert _parse_allocated_resources(None) == []

    def test_inverted_range_is_empty(self):
        assert _parse_allocated_resources("3-1") == []


# --------------------------------------------------------------------------
# _safe_float
# --------------------------------------------------------------------------
class TestSafeFloat:
    def test_valid_numbers(self):
        assert _safe_float("3.5") == 3.5
        assert _safe_float(3) == 3.0

    def test_none_and_empty_return_none(self):
        assert _safe_float(None) is None
        assert _safe_float("") is None

    def test_invalid_returns_none(self):
        assert _safe_float("abc") is None


# --------------------------------------------------------------------------
# _row_to_timeline_job
# --------------------------------------------------------------------------
class TestRowToTimelineJob:
    def test_missing_submission_time_defaults_zero(self):
        job = _row_to_timeline_job({"job_id": "1"}, row_index=0)
        assert job["submission_time"] == 0.0

    def test_slowdown_derived_when_stretch_absent(self):
        row = {"job_id": "1", "submission_time": "0", "turnaround_time": "20",
               "execution_time": "10"}
        job = _row_to_timeline_job(row)
        assert job["slowdown"] == 2.0  # 20 / 10

    def test_stretch_column_takes_precedence(self):
        row = {"job_id": "1", "submission_time": "0", "turnaround_time": "20",
               "execution_time": "10", "stretch": "5.5"}
        assert _row_to_timeline_job(row)["slowdown"] == 5.5

    def test_success_flag_from_string(self):
        assert _row_to_timeline_job({"submission_time": "0", "success": "1"})["success"] is True
        assert _row_to_timeline_job({"submission_time": "0", "success": "0"})["success"] is False


# --------------------------------------------------------------------------
# _build_waiting_cdf
# --------------------------------------------------------------------------
class TestWaitingCdf:
    def test_empty_when_no_waits(self):
        assert _build_waiting_cdf([{"waiting_time": None}]) == []

    def test_starts_at_origin_and_ends_at_one(self):
        jobs = [{"waiting_time": 10.0}, {"waiting_time": 5.0}, {"waiting_time": 20.0}]
        cdf = _build_waiting_cdf(jobs)
        assert cdf[0] == {"t": 0.0, "value": 0.0}
        assert cdf[-1]["value"] == 1.0
        # x must be sorted ascending
        xs = [p["t"] for p in cdf]
        assert xs == sorted(xs)


# --------------------------------------------------------------------------
# derive_timeline_aggregates
# --------------------------------------------------------------------------
class TestDeriveTimelineAggregates:
    def test_empty_csv_returns_zeros(self):
        out = derive_timeline_aggregates(_csv(), n_hosts_hint=8)
        assert out["total_jobs"] == 0
        assert out["n_hosts"] == 8
        assert out["makespan"] == 0.0
        assert out["jobs"] == []
        assert out["utilization_series"] == []
        assert out["waiting_cdf"] == []

    def test_basic_two_jobs(self):
        csv_text = _csv(
            "0,0,0,10,0,10,10,2,0 1,1,COMPLETED_SUCCESSFULLY,1.0",
            "1,5,10,20,5,10,15,2,2 3,1,COMPLETED_SUCCESSFULLY,1.5",
        )
        out = derive_timeline_aggregates(csv_text, n_hosts_hint=4)
        assert out["total_jobs"] == 2
        assert out["n_hosts"] == 4
        assert out["makespan"] == 20.0          # max finish 20 - min submit 0
        assert len(out["jobs"]) == 2
        assert out["utilization_series"]         # non-empty
        assert out["waiting_cdf"][0] == {"t": 0.0, "value": 0.0}
        assert out["waiting_cdf"][-1]["value"] == 1.0

    def test_n_hosts_fallback_from_allocations(self):
        csv_text = _csv("0,0,0,10,0,10,10,3,0 1 2,1,COMPLETED_SUCCESSFULLY,1.0")
        out = derive_timeline_aggregates(csv_text)  # no hint
        assert out["n_hosts"] == 3                   # max alloc id (2) + 1

    def test_limit_truncates_jobs_not_aggregates(self):
        rows = [f"{i},{i},{i},{i + 5},0,5,5,1,{i},1,COMPLETED_SUCCESSFULLY,1.0"
                for i in range(5)]
        out = derive_timeline_aggregates(_csv(*rows), n_hosts_hint=5, limit=2)
        assert out["total_jobs"] == 5      # aggregate over full set
        assert out["truncated"] is True
        assert len(out["jobs"]) == 2       # bars capped
