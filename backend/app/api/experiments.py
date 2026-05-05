"""Experiment API endpoints — CRUD, lifecycle, and simulation orchestration."""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
import json
import os
import shutil

from app.core.database import get_db
from app.core.config import settings
from app.models.user import User
from app.models.experiment import Experiment, ExperimentStatus
from app.models.scenario import Scenario
from app.models.strategy import Strategy
from app.schemas.experiment import (
    Experiment as ExperimentSchema,
    ExperimentCreate,
    ExperimentUpdate,
    ExperimentWithDetails,
)
from app.api.auth import get_current_user
from app.services.experiment_bundle_service import freeze_experiment_config
from app.services.experiment_queue_service import (
    enqueue_experiment,
    cancel_experiment,
    get_queue_status,
    process_queue,
    InvalidTransitionError,
)
from app.services.orchestrator.orchestrator_service import (
    run_experiment,
    stop_experiment_containers,
)

router = APIRouter()


def _enrich_experiment(exp: Experiment) -> ExperimentWithDetails:
    """Add related names to experiment response."""
    exp_dict = ExperimentWithDetails.from_orm(exp)
    if exp.scenario:
        exp_dict.scenario_name = exp.scenario.name
    if exp.strategy:
        exp_dict.strategy_name = exp.strategy.name
    if exp.creator:
        exp_dict.creator_username = exp.creator.username
    return exp_dict


@router.get("/", response_model=List[ExperimentWithDetails])
def get_experiments(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    experiments = db.query(Experiment).offset(skip).limit(limit).all()
    return [_enrich_experiment(exp) for exp in experiments]


@router.get("/queue", response_model=None)
def get_experiment_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current queue status."""
    return get_queue_status(db)


@router.get("/{experiment_id}", response_model=ExperimentWithDetails)
def get_experiment(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return _enrich_experiment(exp)


@router.post("/", response_model=ExperimentSchema)
def create_experiment(
    experiment_create: ExperimentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create experiment with frozen config snapshot."""
    scenario = db.query(Scenario).filter(
        Scenario.id == experiment_create.scenario_id
    ).first()
    strategy = db.query(Strategy).filter(
        Strategy.id == experiment_create.strategy_id
    ).first()
    if not scenario or not strategy:
        raise HTTPException(status_code=400, detail="Invalid scenario or strategy")

    seed = experiment_create.seed
    params = experiment_create.params
    exp = Experiment(
        name=experiment_create.name,
        description=experiment_create.description,
        scenario_id=experiment_create.scenario_id,
        strategy_id=experiment_create.strategy_id,
        status=ExperimentStatus.PENDING,
        config=json.dumps(experiment_create.config) if experiment_create.config else None,
        seed=seed,
        params=json.dumps(params) if params else None,
        created_by=current_user.id,
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)

    # Freeze config — copy files and snapshot versions
    try:
        frozen = freeze_experiment_config(
            db=db,
            experiment_id=exp.id,
            scenario_id=experiment_create.scenario_id,
            strategy_id=experiment_create.strategy_id,
            seed=seed,
            params=params,
        )
        exp.frozen_config = json.dumps(frozen)
        exp.simulation_dir = os.path.dirname(frozen["frozen_files"].get("workload_path", ""))
        db.commit()
        db.refresh(exp)
    except ValueError as e:
        exp_dir = os.path.join(settings.SIMULATION_DATA_PATH, str(exp.id))
        if os.path.exists(exp_dir):
            shutil.rmtree(exp_dir, ignore_errors=True)
        db.delete(exp)
        db.commit()
        raise HTTPException(status_code=400, detail=str(e))

    return exp


@router.put("/{experiment_id}", response_model=ExperimentSchema)
def update_experiment(
    experiment_id: int,
    experiment_update: ExperimentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    for field, value in experiment_update.dict(exclude_unset=True).items():
        setattr(exp, field, value)
    db.commit()
    db.refresh(exp)
    return exp


@router.delete("/{experiment_id}")
def delete_experiment(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    # Stop containers if running
    if exp.status == ExperimentStatus.RUNNING:
        stop_experiment_containers(experiment_id)
    # Cleanup frozen files on disk
    exp_dir = os.path.join(settings.SIMULATION_DATA_PATH, str(exp.id))
    if os.path.exists(exp_dir):
        shutil.rmtree(exp_dir, ignore_errors=True)
    db.delete(exp)
    db.commit()
    return {"message": "Experiment deleted successfully"}


@router.post("/{experiment_id}/start")
def start_experiment(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Enqueue experiment and start execution if slot available.

    PENDING → QUEUED → RUNNING (if slot available, triggers Docker containers).
    """
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    try:
        exp = enqueue_experiment(db, experiment_id)
        promoted = process_queue(db)

        # If this experiment was promoted to RUNNING, launch containers
        if experiment_id in promoted:
            run_experiment(experiment_id)

        return {
            "message": "Experiment started" if experiment_id in promoted else "Experiment queued",
            "status": exp.status.value if experiment_id not in promoted else "running",
            "queue": get_queue_status(db),
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except InvalidTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{experiment_id}/stop")
def stop_experiment(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel/stop an experiment (from QUEUED or RUNNING)."""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # If running, stop containers first
    if exp.status == ExperimentStatus.RUNNING:
        stop_experiment_containers(experiment_id)

    try:
        exp = cancel_experiment(db, experiment_id)
        promoted = process_queue(db)

        # Launch newly promoted experiments
        for pid in promoted:
            run_experiment(pid)

        return {
            "message": "Experiment cancelled",
            "status": exp.status.value,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except InvalidTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{experiment_id}/status")
def get_experiment_status(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current status, progress, and frozen config of an experiment."""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")

    frozen = None
    if exp.frozen_config:
        try:
            frozen = json.loads(exp.frozen_config)
        except json.JSONDecodeError:
            frozen = None

    return {
        "status": exp.status,
        "progress_percentage": exp.progress_percentage,
        "completed_jobs": exp.completed_jobs,
        "total_jobs": exp.total_jobs,
        "start_time": exp.start_time,
        "end_time": exp.end_time,
        "seed": exp.seed,
        "frozen_config": frozen,
        "error_message": exp.error_message,
    }


# ---------------------------------------------------------------------------
# Task 7.6 — 4-stream log endpoints
# ---------------------------------------------------------------------------

# Per-stream hard cap served to clients (5 MB).
# Prevents sending huge payloads; truncated flag signals the client.
_STREAM_CAP_BYTES = 5 * 1024 * 1024

# Valid stream names for download endpoint
_VALID_STREAM_NAMES = frozenset(
    ["batsim_stdout", "batsim_stderr", "pybatsim_stdout", "pybatsim_stderr"]
)

# Map stream name → (DB column attr name, disk filename)
_STREAM_MAP = {
    "batsim_stdout":   ("batsim_logs",    "batsim.stdout.log"),
    "batsim_stderr":   ("batsim_stderr",  "batsim.stderr.log"),
    "pybatsim_stdout": ("pybatsim_logs",  "pybatsim.stdout.log"),
    "pybatsim_stderr": ("pybatsim_stderr", "pybatsim.stderr.log"),
}


def _get_stream_content(exp: Experiment, stream_name: str) -> tuple[str, int, bool]:
    """Return (content, full_size_bytes, truncated) for a stored experiment stream.

    Reads DB column first; falls back to disk file if DB value is empty.
    Applies 5 MB hard cap. full_size_bytes reflects the pre-truncation length.
    """
    db_attr, disk_filename = _STREAM_MAP[stream_name]
    content = getattr(exp, db_attr, None) or ""

    # Fallback: if DB empty and disk file exists, read from disk (capped)
    if not content and exp.simulation_dir:
        disk_path = os.path.join(exp.simulation_dir, disk_filename)
        if os.path.exists(disk_path):
            try:
                with open(disk_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read(_STREAM_CAP_BYTES + 1)  # read 1 byte extra to detect overflow
            except OSError:
                content = ""

    full_size = len(content.encode("utf-8"))
    if full_size > _STREAM_CAP_BYTES:
        # Keep the TAIL (errors appear near end)
        content = content[-_STREAM_CAP_BYTES:]
        return content, full_size, True
    return content, full_size, False


@router.get("/{experiment_id}/logs/streams")
def get_experiment_log_streams(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all 4 log streams for an experiment.

    Returns batsim_stdout, batsim_stderr, pybatsim_stdout, pybatsim_stderr
    each as { content, truncated, size_bytes }. Content is capped at 5 MB
    per stream; truncated=true when cap was applied, size_bytes reflects the
    full pre-cap size.

    When the experiment is RUNNING, content is fetched live from Docker
    containers (live=true). Otherwise, DB columns are used with disk-file
    fallback (live=false).
    """
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Live path: experiment is running — fetch directly from containers
    if exp.status == ExperimentStatus.RUNNING:
        from app.services.orchestrator.orchestrator_service import _running_managers, _lock
        with _lock:
            manager = _running_managers.get(experiment_id)
        if manager:
            try:
                bs_out_raw = manager.get_logs(container_type="batsim",    tail=0, stream="stdout").get("batsim_logs", "")
                bs_err_raw = manager.get_logs(container_type="batsim",    tail=0, stream="stderr").get("batsim_logs", "")
                py_out_raw = manager.get_logs(container_type="pybatsim",  tail=0, stream="stdout").get("pybatsim_logs", "")
                py_err_raw = manager.get_logs(container_type="pybatsim",  tail=0, stream="stderr").get("pybatsim_logs", "")

                def _cap(text: str):
                    size = len(text.encode("utf-8"))
                    if size > _STREAM_CAP_BYTES:
                        return text[-_STREAM_CAP_BYTES:], size, True
                    return text, size, False

                bs_out, bs_out_sz, bs_out_trunc = _cap(bs_out_raw)
                bs_err, bs_err_sz, bs_err_trunc = _cap(bs_err_raw)
                py_out, py_out_sz, py_out_trunc = _cap(py_out_raw)
                py_err, py_err_sz, py_err_trunc = _cap(py_err_raw)

                return {
                    "batsim_stdout":   {"content": bs_out, "truncated": bs_out_trunc, "size_bytes": bs_out_sz},
                    "batsim_stderr":   {"content": bs_err, "truncated": bs_err_trunc, "size_bytes": bs_err_sz},
                    "pybatsim_stdout": {"content": py_out, "truncated": py_out_trunc, "size_bytes": py_out_sz},
                    "pybatsim_stderr": {"content": py_err, "truncated": py_err_trunc, "size_bytes": py_err_sz},
                    "live": True,
                }
            except Exception:
                pass  # Fall through to stored path on live-fetch error

    # Stored path: read DB columns with disk fallback
    streams = {}
    for stream_name in ["batsim_stdout", "batsim_stderr", "pybatsim_stdout", "pybatsim_stderr"]:
        content, size, truncated = _get_stream_content(exp, stream_name)
        streams[stream_name] = {"content": content, "truncated": truncated, "size_bytes": size}

    streams["live"] = False
    return streams


@router.get("/{experiment_id}/logs/streams/{stream_name}/download")
def download_experiment_log_stream(
    experiment_id: int,
    stream_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download a single log stream as a plain-text file attachment.

    stream_name must be one of: batsim_stdout, batsim_stderr,
    pybatsim_stdout, pybatsim_stderr.
    Content is capped at 5 MB (last 5 MB if truncated).
    """
    if stream_name not in _VALID_STREAM_NAMES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid stream name '{stream_name}'. "
                   f"Must be one of: {sorted(_VALID_STREAM_NAMES)}",
        )

    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")

    content, _size, _truncated = _get_stream_content(exp, stream_name)
    filename = f"exp-{experiment_id}-{stream_name}.txt"
    return Response(
        content=content,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Legacy endpoint — kept for backwards compatibility
# ---------------------------------------------------------------------------

@router.get("/{experiment_id}/logs")
def get_experiment_logs(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # DEPRECATED: prefer /logs/streams (4-stream split). Remove in Phase 9.
    # Returns the original 2-field shape { batsim_logs, pybatsim_logs, live }.
    # Both fields contain merged stdout+stderr for backwards compat with older
    # frontend versions and any external scripts that call this endpoint directly.
    """Get experiment logs — DEPRECATED.

    Returns merged stdout+stderr for batsim and pybatsim as a 2-field shape.
    Prefer GET /experiments/{id}/logs/streams for the 4-stream split introduced
    in Task 7.6. This endpoint will be removed in Phase 9.
    """
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # If running, try to get live logs from containers
    if exp.status == ExperimentStatus.RUNNING:
        from app.services.orchestrator.orchestrator_service import _running_managers, _lock
        with _lock:
            manager = _running_managers.get(experiment_id)
        if manager:
            try:
                live_logs = manager.get_logs(tail=200)
                return {
                    "batsim_logs": live_logs.get("batsim_logs", ""),
                    "pybatsim_logs": live_logs.get("pybatsim_logs", ""),
                    "live": True,
                }
            except Exception:
                pass

    # Fall back to stored logs
    return {
        "batsim_logs": exp.batsim_logs or "",
        "pybatsim_logs": exp.pybatsim_logs or "",
        "live": False,
    }
