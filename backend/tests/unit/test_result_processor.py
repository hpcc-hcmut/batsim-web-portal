"""Unit tests for post-processing result_processor — CSV parsers."""

import os
import pytest

from app.services.post_processing.result_processor import _parse_jobs_csv, _parse_schedule_csv

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# _parse_jobs_csv tests
# ---------------------------------------------------------------------------

class TestParseJobsCsv:

    def _write_csv(self, tmp_path, header, rows):
        path = tmp_path / "out_jobs.csv"
        lines = [header] + rows
        path.write_text("\n".join(lines))
        return str(path)

    def test_basic_parsing(self, tmp_path):
        """4 successful jobs with known timing values."""
        header = "job_id,submission_time,waiting_time,execution_time,turnaround_time,finish_time,success"
        rows = [
            "w0!0,0,0,10,10,10,1",
            "w0!1,0,10,20,30,30,1",
            "w0!2,5,0,5,5,10,1",
            "w0!3,10,0,20,20,30,1",
        ]
        path = self._write_csv(tmp_path, header, rows)
        content, m = _parse_jobs_csv(path)

        assert m["total_jobs"] == 4
        assert m["completed_jobs"] == 4
        assert m["failed_jobs_count"] == 0
        assert m["mean_waiting_time_jobs"] == 2.5  # (0+10+0+0)/4
        assert m["max_waiting_time_jobs"] == 10.0
        assert m["makespan_jobs"] == 30.0  # max_finish=30, min_sub=0
        assert m["throughput"] > 0

    def test_empty_file(self, tmp_path):
        """CSV with only headers, no data rows."""
        path = self._write_csv(tmp_path, "job_id,submission_time", [])
        content, m = _parse_jobs_csv(path)
        assert m["total_jobs"] == 0

    def test_missing_columns(self, tmp_path):
        """CSV with only job_id and submission_time — no crash."""
        header = "job_id,submission_time"
        rows = ["w0!0,0", "w0!1,5"]
        path = self._write_csv(tmp_path, header, rows)
        content, m = _parse_jobs_csv(path)
        assert m["total_jobs"] == 2
        assert "mean_waiting_time_jobs" not in m

    def test_mixed_success_failure(self, tmp_path):
        """2 successes, 1 failure."""
        header = "job_id,submission_time,waiting_time,execution_time,turnaround_time,finish_time,success"
        rows = [
            "w0!0,0,0,10,10,10,1",
            "w0!1,0,5,10,15,15,1",
            "w0!2,0,0,0,0,5,0",
        ]
        path = self._write_csv(tmp_path, header, rows)
        _, m = _parse_jobs_csv(path)
        assert m["completed_jobs"] == 2
        assert m["failed_jobs_count"] == 1

    def test_nonexistent_file(self):
        """Missing file returns empty content and total_jobs=0."""
        content, m = _parse_jobs_csv("/nonexistent/out_jobs.csv")
        assert content == ""
        assert m["total_jobs"] == 0

    def test_slowdown_calculation(self, tmp_path):
        """Slowdown = turnaround / execution."""
        header = "job_id,submission_time,waiting_time,execution_time,turnaround_time,finish_time,success"
        rows = [
            "w0!0,0,5,5,10,10,1",   # slowdown=10/5=2.0
            "w0!1,0,10,10,20,20,1",  # slowdown=20/10=2.0
        ]
        path = self._write_csv(tmp_path, header, rows)
        _, m = _parse_jobs_csv(path)
        assert m["mean_slowdown_jobs"] == 2.0

    def test_throughput_calculation(self, tmp_path):
        """Throughput = total_jobs / makespan."""
        header = "job_id,submission_time,finish_time,success"
        rows = ["w0!0,0,100,1", "w0!1,0,100,1"]
        path = self._write_csv(tmp_path, header, rows)
        _, m = _parse_jobs_csv(path)
        assert m["makespan_jobs"] == 100.0
        assert abs(m["throughput"] - 0.02) < 0.001


# ---------------------------------------------------------------------------
# _parse_schedule_csv tests
# ---------------------------------------------------------------------------

class TestParseScheduleCsv:

    def _write_csv(self, tmp_path, header, rows):
        path = tmp_path / "out_schedule.csv"
        lines = [header] + rows
        path.write_text("\n".join(lines))
        return str(path)

    def test_basic_parsing(self, tmp_path):
        """Standard schedule CSV with known values."""
        header = "makespan,nb_jobs,nb_jobs_success,nb_computing_machines,success_rate,time_computing,consumed_joules"
        rows = ["100.0,10,10,4,1.0,300.0,5000.0"]
        path = self._write_csv(tmp_path, header, rows)
        content, m = _parse_schedule_csv(path)

        assert m["makespan"] == 100.0
        assert m["nb_jobs"] == 10
        assert m["nb_jobs_success"] == 10
        assert m["nb_computing_machines"] == 4
        assert m["success_rate"] == 1.0
        assert m["consumed_joules"] == 5000.0
        # resource_utilization = 300 / (100*4) = 0.75
        assert m["resource_utilization"] == 0.75

    def test_empty_file(self, tmp_path):
        """CSV with headers but no data row."""
        path = self._write_csv(tmp_path, "makespan,nb_jobs", [])
        content, m = _parse_schedule_csv(path)
        assert m == {}

    def test_missing_file(self):
        """Non-existent file returns empty dict."""
        content, m = _parse_schedule_csv("/nonexistent/out_schedule.csv")
        assert content == ""
        assert m == {}

    def test_resource_utilization_calculation(self, tmp_path):
        """resource_utilization = time_computing / (makespan * nb_machines)."""
        header = "makespan,nb_computing_machines,time_computing"
        rows = ["2000.0,5,1000.0"]
        path = self._write_csv(tmp_path, header, rows)
        _, m = _parse_schedule_csv(path)
        assert m["resource_utilization"] == 0.1

    def test_zero_makespan_no_utilization(self, tmp_path):
        """Zero makespan should not produce resource_utilization (div-by-zero guard)."""
        header = "makespan,nb_computing_machines,time_computing"
        rows = ["0.0,5,0.0"]
        path = self._write_csv(tmp_path, header, rows)
        _, m = _parse_schedule_csv(path)
        assert "resource_utilization" not in m
