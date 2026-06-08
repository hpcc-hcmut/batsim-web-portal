"""Orchestrator service — runs BatSim experiments end-to-end in background threads.

Lifecycle: prepare → start PyBatsim → start BatSim → wait → collect → cleanup.
Each experiment runs in its own thread with its own DB session.
"""

import json
import logging
import os
import time
import threading
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.experiment import Experiment, ExperimentStatus
from app.services.orchestrator.container_manager import ContainerManager
from app.services.metrics.metrics_exporter import (
    experiments_started_total,
    experiments_completed_total,
    experiments_failed_total,
    experiment_duration_seconds,
)

logger = logging.getLogger(__name__)

# Track running experiments for cancellation
_running_managers: dict[int, ContainerManager] = {}
_lock = threading.Lock()

# Delay between starting PyBatsim (BINDS) and BatSim (CONNECTS)
PYBATSIM_STARTUP_DELAY = 3  # seconds


def run_experiment(experiment_id: int):
    """Run an experiment in a background thread.

    This is the main entry point called from the API layer.
    Creates its own DB session and manages the full container lifecycle.
    """
    with _lock:
        if experiment_id in _running_managers:
            logger.warning(f"[Exp {experiment_id}] Already running, skipping duplicate")
            return
    thread = threading.Thread(
        target=_run_experiment_thread,
        args=(experiment_id,),
        name=f"exp-{experiment_id}",
        daemon=True,
    )
    thread.start()
    logger.info(f"[Exp {experiment_id}] Background thread started")


def stop_experiment_containers(experiment_id: int):
    """Stop containers for a running experiment (called from /stop endpoint)."""
    with _lock:
        manager = _running_managers.get(experiment_id)
    if manager:
        logger.info(f"[Exp {experiment_id}] Stop requested — killing containers")
        manager.stop_containers()


def _run_experiment_thread(experiment_id: int):
    """Thread function — full experiment lifecycle."""
    db: Session = SessionLocal()
    manager = ContainerManager(experiment_id)

    with _lock:
        _running_managers[experiment_id] = manager

    try:
        _execute_experiment(db, experiment_id, manager)
    except Exception as e:
        logger.exception(f"[Exp {experiment_id}] Unexpected error: {e}")
        _update_experiment_status(
            db, experiment_id, ExperimentStatus.FAILED, error_message=str(e)
        )
        experiments_failed_total.inc()
    finally:
        # Stop progress parser thread (Task 7.5) — before container cleanup so it can
        # do a final DB flush while containers still exist
        try:
            from app.services.orchestrator.progress_parser import stop_parser
            stop_parser(experiment_id)
        except Exception as e:
            logger.debug(f"[Exp {experiment_id}] Parser stop failed: {e}")
        # Collect logs before cleanup (don't let log errors block cleanup)
        try:
            _save_logs(db, experiment_id, manager)
        except Exception as e:
            logger.error(f"[Exp {experiment_id}] Failed to save logs: {e}")
        # Emit final stats snapshot BEFORE containers are removed so Prometheus
        # can scrape at least one data point even for sub-second simulations
        try:
            from app.services.metrics import get_stats_collector
            stats = get_stats_collector()
            if stats is not None:
                if manager.batsim_container is not None:
                    stats.emit_snapshot_for(
                        manager.batsim_container, experiment_id, "batsim"
                    )
                if manager.pybatsim_container is not None:
                    stats.emit_snapshot_for(
                        manager.pybatsim_container, experiment_id, "pybatsim"
                    )
        except Exception as e:
            logger.debug(f"[Exp {experiment_id}] Final stats snapshot failed: {e}")
        manager.cleanup()
        with _lock:
            _running_managers.pop(experiment_id, None)
        # Slot just freed (COMPLETED/FAILED/CANCELLED) — promote the next QUEUED
        # experiment(s). Without this, a queued experiment stays stranded until an
        # unrelated start/cancel event happens to call process_queue, because the
        # completion path itself never advanced the queue (no periodic reconciler).
        try:
            from app.services.experiment_queue_service import process_queue
            for promoted_id in process_queue(db):
                logger.info(
                    f"[Exp {experiment_id}] freed slot → promoting queued exp {promoted_id}"
                )
                run_experiment(promoted_id)
        except Exception as e:
            logger.warning(f"[Exp {experiment_id}] queue drain after finish failed: {e}")
        db.close()


def _execute_experiment(db: Session, experiment_id: int, manager: ContainerManager):
    """Core execution logic — called within the thread."""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        logger.error(f"[Exp {experiment_id}] Not found in DB")
        return

    # Parse frozen config to get file paths
    frozen = json.loads(exp.frozen_config) if exp.frozen_config else None
    if not frozen or "frozen_files" not in frozen:
        _update_experiment_status(
            db, experiment_id, ExperimentStatus.FAILED,
            error_message="Missing frozen config — cannot run simulation",
        )
        experiments_failed_total.inc()
        return

    files = frozen["frozen_files"]
    workload_path = files.get("workload_path")
    platform_path = files.get("platform_path")
    strategy_path = files.get("strategy_path")

    if not all([workload_path, platform_path, strategy_path]):
        _update_experiment_status(
            db, experiment_id, ExperimentStatus.FAILED,
            error_message="Missing workload, platform, or strategy file path",
        )
        experiments_failed_total.inc()
        return

    # Ensure experiment directory exists for results output
    exp_dir = os.path.join(settings.SIMULATION_DATA_PATH, str(experiment_id))
    os.makedirs(exp_dir, exist_ok=True)

    # Record start time + increment started counter
    exp.start_time = datetime.now(timezone.utc)
    db.commit()
    experiments_started_total.inc()

    # --- Container lifecycle ---
    try:
        # 1. Create network
        network_name = manager.create_network()
        exp.container_network = network_name
        db.commit()

        # 2. Start PyBatsim (BINDS — must start first); seed goes in as
        # BATSIM_SEED env var for strategies with random components
        pybatsim_id = manager.start_pybatsim(strategy_path, exp_dir, seed=exp.seed)
        exp.pybatsim_container_id = pybatsim_id
        db.commit()

        # 3. Wait for PyBatsim to bind its ZMQ socket
        time.sleep(PYBATSIM_STARTUP_DELAY)

        # 4. Start BatSim (CONNECTS to PyBatsim)
        batsim_id = manager.start_batsim(workload_path, platform_path, exp_dir)
        exp.batsim_container_id = batsim_id
        db.commit()

        # 4.5. Start live progress parser thread (Task 7.5)
        from app.services.orchestrator.progress_parser import start_parser
        if manager.batsim_container is not None:
            start_parser(experiment_id, manager.batsim_container)

        # 5. Wait for completion
        result = manager.wait_for_completion(timeout=settings.SIMULATION_TIMEOUT_SECONDS)

    except Exception as e:
        _update_experiment_status(
            db, experiment_id, ExperimentStatus.FAILED,
            error_message=f"Container error: {e}",
        )
        return

    # 6. Determine outcome
    batsim_exit = result.get("batsim_exit", -1)
    pybatsim_exit = result.get("pybatsim_exit", -1)

    # Record duration (start_time from SQLite is naive; make it UTC-aware before diff)
    if exp.start_time:
        start = exp.start_time
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        duration = (datetime.now(timezone.utc) - start).total_seconds()
        experiment_duration_seconds.labels(experiment_id=str(experiment_id)).observe(duration)

    if batsim_exit == 0:
        _update_experiment_status(db, experiment_id, ExperimentStatus.COMPLETED)
        experiments_completed_total.inc()
        # Try to parse output for job count
        _parse_simulation_output(db, experiment_id, exp_dir)
        # Auto post-process: create Result record with computed metrics
        try:
            from app.services.post_processing import process_experiment_results
            process_experiment_results(db, experiment_id, exp_dir)
        except Exception as e:
            logger.warning(f"[Exp {experiment_id}] Post-processing failed: {e}")
    else:
        error_msg = (
            f"BatSim exit code: {batsim_exit}, PyBatsim exit code: {pybatsim_exit}"
        )
        _update_experiment_status(
            db, experiment_id, ExperimentStatus.FAILED, error_message=error_msg
        )
        experiments_failed_total.inc()


def _update_experiment_status(
    db: Session,
    experiment_id: int,
    status: ExperimentStatus,
    error_message: str | None = None,
):
    """Update experiment status and end time in DB."""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        return
    exp.status = status
    exp.end_time = datetime.now(timezone.utc)
    if error_message:
        exp.error_message = error_message
    if status == ExperimentStatus.COMPLETED:
        exp.progress_percentage = 100
    db.commit()
    logger.info(f"[Exp {experiment_id}] Status → {status.value}")


def _save_logs(db: Session, experiment_id: int, manager: ContainerManager):
    """Capture 4 log streams (batsim stdout/stderr, pybatsim stdout/stderr).

    DB caps: stdout 50 KB tail, stderr 100 KB tail (errors live near the end).
    Disk: writes 4 files (batsim.stdout.log, batsim.stderr.log,
          pybatsim.stdout.log, pybatsim.stderr.log).
    Legacy batsim.log / pybatsim.log are NOT written (existing files left alone).
    ANSI escape sequences are stripped by ContainerManager.get_logs().
    """
    max_stdout_bytes = 50 * 1024   # 50 KB cap for stdout
    max_stderr_bytes = 100 * 1024  # 100 KB cap for stderr (errors are more diagnostic)

    # Fetch 4 separate streams (tail=0 = all lines)
    batsim_stdout_logs = manager.get_logs(container_type="batsim", tail=0, stream="stdout")
    batsim_stderr_logs = manager.get_logs(container_type="batsim", tail=0, stream="stderr")
    pybatsim_stdout_logs = manager.get_logs(container_type="pybatsim", tail=0, stream="stdout")
    pybatsim_stderr_logs = manager.get_logs(container_type="pybatsim", tail=0, stream="stderr")

    batsim_out = batsim_stdout_logs.get("batsim_logs", "")
    batsim_err = batsim_stderr_logs.get("batsim_logs", "")
    pybatsim_out = pybatsim_stdout_logs.get("pybatsim_logs", "")
    pybatsim_err = pybatsim_stderr_logs.get("pybatsim_logs", "")

    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        return

    # Truncate for DB storage — keep the TAIL (errors typically appear near end)
    if len(batsim_out) > max_stdout_bytes:
        batsim_out_db = "... (truncated) ...\n" + batsim_out[-max_stdout_bytes:]
    else:
        batsim_out_db = batsim_out

    if len(batsim_err) > max_stderr_bytes:
        batsim_err_db = "... (truncated) ...\n" + batsim_err[-max_stderr_bytes:]
    else:
        batsim_err_db = batsim_err

    if len(pybatsim_out) > max_stdout_bytes:
        pybatsim_out_db = "... (truncated) ...\n" + pybatsim_out[-max_stdout_bytes:]
    else:
        pybatsim_out_db = pybatsim_out

    if len(pybatsim_err) > max_stderr_bytes:
        pybatsim_err_db = "... (truncated) ...\n" + pybatsim_err[-max_stderr_bytes:]
    else:
        pybatsim_err_db = pybatsim_err

    exp.batsim_logs = batsim_out_db
    exp.batsim_stderr = batsim_err_db
    exp.pybatsim_logs = pybatsim_out_db
    exp.pybatsim_stderr = pybatsim_err_db
    db.commit()

    # Write 4 disk files (full content, no DB cap applied)
    exp_dir = os.path.join(settings.SIMULATION_DATA_PATH, str(experiment_id))
    os.makedirs(exp_dir, exist_ok=True)
    for filename, content in [
        ("batsim.stdout.log", batsim_out),
        ("batsim.stderr.log", batsim_err),
        ("pybatsim.stdout.log", pybatsim_out),
        ("pybatsim.stderr.log", pybatsim_err),
    ]:
        log_path = os.path.join(exp_dir, filename)
        with open(log_path, "w", encoding="utf-8") as f:
            f.write(content)


def _parse_simulation_output(db: Session, experiment_id: int, exp_dir: str):
    """Try to parse BatSim output files to extract job count and metrics."""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        return

    # BatSim writes out_jobs.csv in the results directory
    jobs_csv = os.path.join(exp_dir, "out_jobs.csv")
    if os.path.exists(jobs_csv):
        try:
            with open(jobs_csv, "r") as f:
                lines = f.readlines()
            # First line is header, rest are jobs
            total_jobs = len(lines) - 1 if len(lines) > 1 else 0
            exp.total_jobs = total_jobs
            exp.completed_jobs = total_jobs
            exp.progress_percentage = 100
            db.commit()
            logger.info(f"[Exp {experiment_id}] Parsed {total_jobs} jobs from output")
        except Exception as e:
            logger.warning(f"[Exp {experiment_id}] Failed to parse output: {e}")
