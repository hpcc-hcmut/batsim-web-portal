"""Parser thread lifecycle — start/stop, DB flush, Prometheus emit, registry.

Owns the module-level dict of running ProgressState objects and their threads.
DB writes are coalesced: one UPDATE per 2s when dirty=True (D6 locked decision).
Prometheus gauge series are dropped 1.5s after the parser stops (D7 locked decision).

Task 7.5 — Live Progress Tracking
"""

import logging
import threading
import time

from app.core.database import SessionLocal
from app.models.experiment import Experiment
from ._state import ProgressState
from ._regex import parse_line

logger = logging.getLogger(__name__)

_DB_FLUSH_INTERVAL_S = 2.0

# ---------------------------------------------------------------------------
# Module-level per-experiment registry (protected by lock)
# ---------------------------------------------------------------------------

_state_lock = threading.Lock()
_progress_state: dict = {}   # int -> ProgressState
_threads: dict = {}          # int -> Thread
_stop_events: dict = {}      # int -> Event


# ---------------------------------------------------------------------------
# Public API used by orchestrator_service and experiments endpoint
# ---------------------------------------------------------------------------

def get_state(experiment_id: int):
    """Return live ProgressState or None."""
    with _state_lock:
        return _progress_state.get(experiment_id)


def get_history(experiment_id: int):
    """Return ring buffer as [[wall_s, completed], ...] for ?history=1 endpoint."""
    with _state_lock:
        st = _progress_state.get(experiment_id)
    if not st:
        return []
    return [[w, c] for (w, c) in list(st.history)]


def start_parser(experiment_id: int, batsim_container) -> threading.Event:
    """Spawn daemon parser thread; returns stop_event for the orchestrator."""
    if batsim_container is None:
        logger.warning(f"[Exp {experiment_id}] batsim_container is None — skipping parser")
        return threading.Event()

    stop_event = threading.Event()
    state = ProgressState()
    with _state_lock:
        _progress_state[experiment_id] = state
        _stop_events[experiment_id] = stop_event

    t = threading.Thread(
        target=_run,
        args=(experiment_id, batsim_container, stop_event, state),
        name=f"parser-exp-{experiment_id}",
        daemon=True,
    )
    with _state_lock:
        _threads[experiment_id] = t
    t.start()
    logger.info(f"[Exp {experiment_id}] Progress parser thread started")
    return stop_event


def stop_parser(experiment_id: int, drop_metrics_after: float = 1.5) -> None:
    """Signal parser to stop, join with 5s timeout, schedule deferred gauge sweep."""
    with _state_lock:
        ev = _stop_events.get(experiment_id)
        t = _threads.get(experiment_id)

    if ev:
        ev.set()
    if t and t.is_alive():
        t.join(timeout=5.0)

    def _deferred_cleanup():
        time.sleep(drop_metrics_after)
        _drop_metrics(experiment_id)
        with _state_lock:
            _progress_state.pop(experiment_id, None)
            _threads.pop(experiment_id, None)
            _stop_events.pop(experiment_id, None)

    threading.Thread(target=_deferred_cleanup, daemon=True).start()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _emit_prom(experiment_id: int, state: ProgressState) -> None:
    """Update 5 Prometheus gauges; import deferred to avoid circular dep at module load."""
    try:
        from app.services.metrics.metrics_exporter import (
            live_jobs_submitted, live_jobs_completed,
            live_jobs_running, live_jobs_failed, last_sim_time_seconds,
        )
        eid = str(experiment_id)
        live_jobs_submitted.labels(experiment_id=eid).set(state.submitted)
        live_jobs_completed.labels(experiment_id=eid).set(state.completed)
        live_jobs_running.labels(experiment_id=eid).set(state.running)
        live_jobs_failed.labels(experiment_id=eid).set(state.failed)
        last_sim_time_seconds.labels(experiment_id=eid).set(state.last_sim_time)
    except Exception as e:
        logger.debug(f"[Exp {experiment_id}] Prom emit failed: {e}")


def _drop_metrics(experiment_id: int) -> None:
    """Remove per-experiment gauge series from Prometheus registry."""
    try:
        from app.services.metrics.metrics_exporter import (
            live_jobs_submitted, live_jobs_completed,
            live_jobs_running, live_jobs_failed, last_sim_time_seconds,
        )
        eid = (str(experiment_id),)
        for gauge in (live_jobs_submitted, live_jobs_completed,
                      live_jobs_running, live_jobs_failed, last_sim_time_seconds):
            gauge._metrics.pop(eid, None)
    except Exception as e:
        logger.debug(f"[Exp {experiment_id}] Prom drop failed: {e}")


def _flush_db(db, experiment_id: int, state: ProgressState) -> None:
    """Coalesced UPDATE: 5 live_* columns + completed_jobs + progress_percentage."""
    try:
        exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
        if not exp:
            return
        exp.live_jobs_submitted = state.submitted
        exp.live_jobs_completed = state.completed
        exp.live_jobs_running = state.running
        exp.live_jobs_failed = state.failed
        exp.last_sim_time = state.last_sim_time
        # Keep existing fields in sync (D2 — additive)
        exp.completed_jobs = state.completed
        if exp.total_jobs and exp.total_jobs > 0:
            exp.progress_percentage = min(100, int(state.completed * 100 / exp.total_jobs))
        db.commit()
    except Exception as e:
        logger.warning(f"[Exp {experiment_id}] DB flush failed: {e}")
        try:
            db.rollback()
        except Exception:
            pass


def _run(experiment_id: int, batsim_container, stop_event: threading.Event, state: ProgressState) -> None:
    """Parser thread body — consumes container log stream until done or signalled."""
    db = SessionLocal()
    last_flush = time.monotonic()
    try:
        # BatSim writes [server/INFO] progress lines to STDERR (via SimGrid's logging
        # which defaults to stderr). Requesting only stderr also avoids Docker's
        # multiplexed stream headers that corrupt the regex-matched line content.
        for chunk in batsim_container.logs(stream=True, follow=True, stdout=False, stderr=True):
            if stop_event.is_set():
                break
            if not chunk:
                continue
            for line in chunk.decode("utf-8", "replace").splitlines():
                if parse_line(line, state):
                    _emit_prom(experiment_id, state)
            now = time.monotonic()
            if now - last_flush >= _DB_FLUSH_INTERVAL_S and state.dirty:
                _flush_db(db, experiment_id, state)
                state.dirty = False
                last_flush = now
    except Exception as e:
        # docker.errors.NotFound raised when container removed — expected exit
        logger.debug(f"[Exp {experiment_id}] Parser stream ended: {e}")
    finally:
        try:
            if state.dirty:
                _flush_db(db, experiment_id, state)
            _emit_prom(experiment_id, state)
        finally:
            db.close()
        logger.info(f"[Exp {experiment_id}] Progress parser thread exiting")
