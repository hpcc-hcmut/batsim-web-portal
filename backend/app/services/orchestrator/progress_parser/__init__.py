"""progress_parser — live batsim_stdout parser for job tracking.

Public surface:
    start_parser(experiment_id, batsim_container) -> threading.Event
    stop_parser(experiment_id)
    get_state(experiment_id) -> ProgressState | None
    get_history(experiment_id) -> list[list[float]]
    parse_line(line, state) -> bool          # exposed for unit tests

Internal modules (not imported directly):
    _state.py   — ProgressState class + ring buffer
    _regex.py   — compiled patterns + parse_line
    _runner.py  — thread lifecycle, DB flush, Prometheus emit, registry

Task 7.5 — Live Progress Tracking
"""

from ._state import ProgressState
from ._regex import RE_SUBMITTED, RE_COMPLETED, RE_SIM_END, parse_line
from ._runner import start_parser, stop_parser, get_state, get_history

__all__ = [
    "ProgressState",
    "RE_SUBMITTED",
    "RE_COMPLETED",
    "RE_SIM_END",
    "parse_line",
    "start_parser",
    "stop_parser",
    "get_state",
    "get_history",
]
