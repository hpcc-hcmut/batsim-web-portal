"""Unit tests for batsim_log_parser regex patterns and state machine.

Uses lines derived from the real batsim_stdout in experiments/14/batsim.log.
No Docker or DB dependencies — pure logic tests.

Task 7.5 — Live Progress Tracking
"""

import pytest
from app.services.orchestrator.progress_parser import (
    ProgressState,
    parse_line,
    RE_SUBMITTED as _RE_SUBMITTED,
    RE_COMPLETED as _RE_COMPLETED,
    RE_SIM_END as _RE_SIM_END,
)

pytestmark = pytest.mark.integration

# ---------------------------------------------------------------------------
# Real log lines from experiments/14/batsim.log
# ---------------------------------------------------------------------------

LINE_SUBMITTED_1 = "[master_host:server:(2) 0.000000] [server/INFO] Job w0!0 SUBMITTED. 1 jobs submitted so far"
LINE_SUBMITTED_2 = "[master_host:server:(2) 1.000000] [server/INFO] Job w0!1 SUBMITTED. 2 jobs submitted so far"
LINE_SUBMITTED_3 = "[master_host:server:(2) 2.000000] [server/INFO] Job w0!2 SUBMITTED. 3 jobs submitted so far"
LINE_SUBMITTED_4 = "[master_host:server:(2) 5.000000] [server/INFO] Job w0!3 SUBMITTED. 4 jobs submitted so far"
LINE_COMPLETED_1 = "[master_host:server:(2) 2.000000] [server/INFO] Job w0!0 has COMPLETED. 1 jobs completed so far"
LINE_COMPLETED_2 = "[master_host:server:(2) 3.000000] [server/INFO] Job w0!1 has COMPLETED. 2 jobs completed so far"
LINE_COMPLETED_3 = "[master_host:server:(2) 7.000000] [server/INFO] Job w0!2 has COMPLETED. 3 jobs completed so far"
LINE_COMPLETED_4 = "[master_host:server:(2) 7.000000] [server/INFO] Job w0!3 has COMPLETED. 4 jobs completed so far"
LINE_SIM_ENDED = "[master_host:server:(2) 7.000000] [server/INFO] The simulation seems finished."

NOISE_LINES = [
    "[0.000000] [batsim/INFO] Workload 'w0' corresponds to workload file '/data/workload.json'.",
    "[master_host:Scheduler REQ-REP:(3) 0.000000] [network/INFO] Sending '{\"now\":0.0}'",
    "[c-0:job_w0!0:(5) 0.000000] [jobs_execution/INFO] Sleeping the whole task length",
    "[7.000000] [export/INFO] jobs=4, finished=4, success=4, killed=0",
    "",
    "   ",
    "random garbage line",
]

ALL_SUBMITTED = [LINE_SUBMITTED_1, LINE_SUBMITTED_2, LINE_SUBMITTED_3, LINE_SUBMITTED_4]
ALL_COMPLETED = [LINE_COMPLETED_1, LINE_COMPLETED_2, LINE_COMPLETED_3, LINE_COMPLETED_4]

# ---------------------------------------------------------------------------
# Pattern-level tests
# ---------------------------------------------------------------------------

class TestSubmittedPattern:
    def test_matches_real_line(self):
        m = _RE_SUBMITTED.match(LINE_SUBMITTED_1)
        assert m is not None

    def test_extracts_sim_time(self):
        m = _RE_SUBMITTED.match(LINE_SUBMITTED_1)
        assert float(m.group("sim_time")) == pytest.approx(0.0)

    def test_extracts_count(self):
        m = _RE_SUBMITTED.match(LINE_SUBMITTED_2)
        assert int(m.group("count")) == 2

    def test_does_not_match_completed_line(self):
        assert _RE_SUBMITTED.match(LINE_COMPLETED_1) is None

    def test_does_not_match_noise(self):
        for line in NOISE_LINES:
            assert _RE_SUBMITTED.match(line) is None


class TestCompletedPattern:
    def test_matches_real_line(self):
        m = _RE_COMPLETED.match(LINE_COMPLETED_1)
        assert m is not None

    def test_extracts_sim_time(self):
        m = _RE_COMPLETED.match(LINE_COMPLETED_1)
        assert float(m.group("sim_time")) == pytest.approx(2.0)

    def test_extracts_count(self):
        m = _RE_COMPLETED.match(LINE_COMPLETED_2)
        assert int(m.group("count")) == 2

    def test_does_not_match_submitted_line(self):
        assert _RE_COMPLETED.match(LINE_SUBMITTED_1) is None


class TestSimEndedPattern:
    def test_matches_real_line(self):
        m = _RE_SIM_END.match(LINE_SIM_ENDED)
        assert m is not None

    def test_extracts_sim_time(self):
        m = _RE_SIM_END.match(LINE_SIM_ENDED)
        assert float(m.group("sim_time")) == pytest.approx(7.0)

    def test_does_not_match_noise(self):
        for line in NOISE_LINES:
            assert _RE_SIM_END.match(line) is None


# ---------------------------------------------------------------------------
# State machine tests (parse_line + ProgressState)
# ---------------------------------------------------------------------------

class TestApplyLine:
    def test_submitted_advances_state(self):
        st = ProgressState()
        result = parse_line(LINE_SUBMITTED_1, st)
        assert result is True
        assert st.submitted == 1
        assert st.last_sim_time == pytest.approx(0.0)
        assert st.dirty is True

    def test_completed_advances_state(self):
        st = ProgressState()
        # Feed a submitted first so running count makes sense
        parse_line(LINE_SUBMITTED_1, st)
        result = parse_line(LINE_COMPLETED_1, st)
        assert result is True
        assert st.completed == 1
        assert st.last_sim_time == pytest.approx(2.0)

    def test_five_lines_correct_counts(self):
        """3 SUBMITTED + 2 COMPLETED → submitted=3, completed=2, running=1."""
        st = ProgressState()
        for line in [LINE_SUBMITTED_1, LINE_SUBMITTED_2, LINE_SUBMITTED_3,
                     LINE_COMPLETED_1, LINE_COMPLETED_2]:
            parse_line(line, st)
        assert st.submitted == 3
        assert st.completed == 2
        assert st.running == 1

    def test_unmatched_returns_false(self):
        st = ProgressState()
        for line in NOISE_LINES:
            assert parse_line(line, st) is False
        assert st.submitted == 0
        assert st.completed == 0

    def test_full_run_from_fixture(self):
        """Replay all events from experiments/14 — expect submitted=4, completed=4."""
        st = ProgressState()
        all_lines = (
            ALL_SUBMITTED + ALL_COMPLETED + [LINE_SIM_ENDED] + NOISE_LINES
        )
        for line in all_lines:
            parse_line(line, st)
        assert st.submitted == 4
        assert st.completed == 4
        assert st.running == 0
        assert st.last_sim_time == pytest.approx(7.0)

    def test_idempotent_replay(self):
        """Replaying identical lines twice must not double-count (count guard)."""
        st = ProgressState()
        lines = ALL_SUBMITTED + ALL_COMPLETED
        for line in lines:
            parse_line(line, st)
        submitted_after_first = st.submitted
        completed_after_first = st.completed
        for line in lines:
            parse_line(line, st)
        assert st.submitted == submitted_after_first
        assert st.completed == completed_after_first

    def test_running_count_clamped_at_zero(self):
        """More COMPLETED than SUBMITTED should not produce negative running."""
        st = ProgressState()
        parse_line(LINE_SUBMITTED_1, st)   # submitted=1
        parse_line(LINE_COMPLETED_1, st)   # completed=1
        parse_line(LINE_COMPLETED_2, st)   # completed=2 (more than submitted)
        assert st.running == 0             # clamped by max(0, ...)

    def test_sim_ended_updates_sim_time(self):
        st = ProgressState()
        parse_line(LINE_SIM_ENDED, st)
        assert st.last_sim_time == pytest.approx(7.0)
        assert st.dirty is True

    def test_garbage_lines_do_not_raise(self):
        """Malformed or random lines must not raise exceptions."""
        st = ProgressState()
        garbage = [
            "!!!not a valid line!!!",
            "\x00\x01\x02binary bytes",
            "[malformed [bracket",
            "a" * 5000,
        ]
        for line in garbage:
            try:
                result = parse_line(line, st)
                assert result is False
            except Exception as exc:
                pytest.fail(f"parse_line raised on garbage input: {exc!r}")
