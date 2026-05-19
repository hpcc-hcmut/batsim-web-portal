"""ProgressState — per-experiment in-memory counters and ring buffer.

Task 7.5 — Live Progress Tracking
"""

import time
from collections import deque

# Ring buffer: 60 samples × 2s cadence ≈ 2 min window
HISTORY_MAXLEN = 60
HISTORY_SAMPLE_INTERVAL_S = 2.0


class ProgressState:
    """Per-experiment in-memory state owned by a single parser thread.

    Thread safety: only the owning parser thread writes to this object.
    The endpoint reads submitted/completed/etc under no lock (stale read is fine).
    """

    __slots__ = (
        "submitted", "completed", "failed", "last_sim_time",
        "history", "started_at", "dirty", "_last_history_t",
    )

    def __init__(self):
        self.submitted: int = 0
        self.completed: int = 0
        self.failed: int = 0          # v2: KILLED/WALLTIME_REACHED; always 0 in v1
        self.last_sim_time: float = 0.0
        self.history: deque = deque(maxlen=HISTORY_MAXLEN)
        self.started_at: float = time.monotonic()
        self.dirty: bool = False
        self._last_history_t: float = 0.0

    @property
    def running(self) -> int:
        """Derived: submitted - completed - failed, clamped to 0."""
        return max(0, self.submitted - self.completed - self.failed)

    @property
    def wall_seconds(self) -> float:
        return time.monotonic() - self.started_at

    def maybe_record_history(self) -> None:
        """Append (wall_seconds, completed) to ring buffer if interval elapsed."""
        wall = self.wall_seconds
        if wall - self._last_history_t >= HISTORY_SAMPLE_INTERVAL_S:
            self.history.append((round(wall, 2), self.completed))
            self._last_history_t = wall
