"""Unit tests for post_processing/heatmap.py — host x time utilization heatmap.

Pure function over out_jobs.csv; asserts busy-fraction grid shape + values.
"""
from app.services.post_processing.heatmap import derive_host_utilization_heatmap

_HEADER = (
    "job_id,submission_time,starting_time,finish_time,waiting_time,"
    "execution_time,turnaround_time,requested_number_of_resources,"
    "allocated_resources,success,final_state,stretch"
)


def _csv(*rows: str) -> str:
    return _HEADER + "\n" + "\n".join(rows) + ("\n" if rows else "")


class TestDeriveHeatmap:
    def test_empty_csv_returns_empty(self):
        out = derive_host_utilization_heatmap(_csv(), n_hosts_hint=4)
        assert out["rows"] == []
        assert out["n_hosts"] == 4

    def test_single_job_full_span_is_fully_busy(self):
        # one job on host 0 covering the whole [0,10] span, 10 buckets of width 1
        csv_text = _csv("0,0,0,10,0,10,10,1,0,1,COMPLETED_SUCCESSFULLY,1.0")
        out = derive_host_utilization_heatmap(csv_text, n_hosts_hint=1, buckets=10)
        assert out["n_hosts"] == 1
        assert out["buckets"] == 10
        assert out["t0"] == 0.0 and out["t1"] == 10.0
        assert len(out["rows"]) == 1
        assert len(out["rows"][0]) == 10
        assert out["rows"][0][0] == 1.0      # host fully busy in every bucket
        assert all(v == 1.0 for v in out["rows"][0])

    def test_n_hosts_fallback_from_allocations(self):
        csv_text = _csv("0,0,0,10,0,10,10,2,0 1,1,COMPLETED_SUCCESSFULLY,1.0")
        out = derive_host_utilization_heatmap(csv_text, buckets=4)  # no hint
        assert out["n_hosts"] == 2           # max alloc id (1) + 1

    def test_allocation_beyond_n_hosts_skipped(self):
        # job claims host 5 but platform only has 1 host -> ignored, grid stays empty
        csv_text = _csv("0,0,0,10,0,10,10,1,5,1,COMPLETED_SUCCESSFULLY,1.0")
        out = derive_host_utilization_heatmap(csv_text, n_hosts_hint=1, buckets=4)
        assert out["rows"] == [[0.0, 0.0, 0.0, 0.0]]

    def test_zero_span_returns_empty(self):
        # start == finish for the only job -> no positive span -> empty grid
        csv_text = _csv("0,5,5,5,0,0,0,1,0,1,COMPLETED_SUCCESSFULLY,1.0")
        out = derive_host_utilization_heatmap(csv_text, n_hosts_hint=1, buckets=4)
        assert out["rows"] == []

    def test_half_span_job_partial_busy(self):
        # two jobs on host 0: [0,5] then nothing in [5,10]; 2 buckets width 5
        csv_text = _csv("0,0,0,5,0,5,5,1,0,1,COMPLETED_SUCCESSFULLY,1.0",
                        "1,0,0,10,0,10,10,1,0,1,COMPLETED_SUCCESSFULLY,1.0")
        out = derive_host_utilization_heatmap(csv_text, n_hosts_hint=1, buckets=2)
        # bucket0 [0,5): both jobs busy -> capped at 1.0; bucket1 [5,10): only job1 -> 1.0
        assert out["rows"][0][0] == 1.0
        assert out["rows"][0][1] == 1.0
