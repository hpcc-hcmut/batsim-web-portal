from typing import List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os
import json
from datetime import datetime
import shutil
from app.core.database import get_db
from app.models.user import User
from app.models.experiment import Experiment, ExperimentStatus
from app.models.scenario import Scenario
from app.models.strategy import Strategy
from app.models.result import Result
from app.schemas.experiment import (
    Experiment as ExperimentSchema,
    ExperimentCreate,
    ExperimentUpdate,
    ExperimentWithDetails,
    ExperimentStatusUpdate,
)
from app.api.auth import get_current_user
from app.services.experiment_runner import (
    launch_experiment_async,
    stop_experiment_processes,
)

router = APIRouter()


@router.get("/", response_model=List[ExperimentWithDetails])
def get_experiments(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    experiments = db.query(Experiment).offset(skip).limit(limit).all()
    result = []
    for exp in experiments:
        exp_dict = ExperimentWithDetails.from_orm(exp)
        if exp.scenario:
            exp_dict.scenario_name = exp.scenario.name
        if exp.strategy:
            exp_dict.strategy_name = exp.strategy.name
        if exp.creator:
            exp_dict.creator_username = exp.creator.username
        result.append(exp_dict)
    return result


@router.get("/{experiment_id}", response_model=ExperimentWithDetails)
def get_experiment(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    exp_dict = ExperimentWithDetails.from_orm(exp)
    if exp.scenario:
        exp_dict.scenario_name = exp.scenario.name
    if exp.strategy:
        exp_dict.strategy_name = exp.strategy.name
    if exp.creator:
        exp_dict.creator_username = exp.creator.username
    return exp_dict


@router.post("/", response_model=ExperimentSchema)
def create_experiment(
    experiment_create: ExperimentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check if scenario and strategy exist
    scenario = (
        db.query(Scenario).filter(Scenario.id == experiment_create.scenario_id).first()
    )
    strategy = (
        db.query(Strategy).filter(Strategy.id == experiment_create.strategy_id).first()
    )
    if not scenario or not strategy:
        raise HTTPException(status_code=400, detail="Invalid scenario or strategy")
    exp = Experiment(
        name=experiment_create.name,
        description=experiment_create.description,
        campaign_id=getattr(experiment_create, "campaign_id", None),
        scenario_id=experiment_create.scenario_id,
        strategy_id=experiment_create.strategy_id,
        status=ExperimentStatus.PENDING,
        config=(
            json.dumps(experiment_create.config) if experiment_create.config else None
        ),
        seed=(experiment_create.config or {}).get("seed")
        if experiment_create.config
        else None,
        created_by=current_user.id,
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)
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
    # Check permissions (only creator or admin can update)
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
    # Check permissions (only creator or admin can delete)
    if exp.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    db.delete(exp)
    db.commit()
    return {"message": "Experiment deleted successfully"}


@router.post("/{experiment_id}/start")
def start_experiment(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start an experiment by running batsim and the scheduler."""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")

    if exp.status not in [ExperimentStatus.PENDING, ExperimentStatus.FAILED]:
        raise HTTPException(
            status_code=400,
            detail="Experiment can only be started from PENDING or FAILED status",
        )

    try:
        exp.status = ExperimentStatus.QUEUED
        exp.status_detail = "Experiment queued for execution"
        exp.failure_reason = None
        exp.exit_code = None
        exp.progress_percentage = 0
        exp.completed_jobs = 0
        exp.end_time = None
        db.commit()
        launch_experiment_async(exp.id)

        return {
            "message": "Experiment queued successfully",
            "experiment_id": exp.id,
            "status": exp.status,
        }

    except Exception as e:
        exp.status = ExperimentStatus.FAILED
        exp.failure_reason = str(e)
        db.commit()
        raise HTTPException(
            status_code=500, detail=f"Failed to start experiment: {str(e)}"
        )


@router.post("/{experiment_id}/stop")
def stop_experiment(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stop a running experiment"""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")

    if exp.status not in [ExperimentStatus.RUNNING, ExperimentStatus.PREPARING, ExperimentStatus.QUEUED]:
        raise HTTPException(status_code=400, detail="Experiment is not running")

    stop_experiment_processes(exp)
    exp.status = ExperimentStatus.CANCELLED
    exp.status_detail = "Cancellation requested"
    exp.end_time = datetime.now()
    db.commit()

    return {"message": "Experiment stopped successfully"}


@router.get("/{experiment_id}/status")
def get_experiment_status(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current status and progress of an experiment"""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")

    return {
        "status": exp.status,
        "status_detail": exp.status_detail,
        "failure_reason": exp.failure_reason,
        "progress_percentage": exp.progress_percentage,
        "completed_jobs": exp.completed_jobs,
        "total_jobs": exp.total_jobs,
        "start_time": exp.start_time,
        "end_time": exp.end_time,
    }


@router.post("/{experiment_id}/clone", response_model=ExperimentSchema)
def clone_experiment(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")

    clone = Experiment(
        name=f"{exp.name} Clone {int(datetime.now().timestamp())}",
        description=exp.description,
        campaign_id=exp.campaign_id,
        scenario_id=exp.scenario_id,
        strategy_id=exp.strategy_id,
        status=ExperimentStatus.PENDING,
        config=exp.config,
        seed=exp.seed,
        created_by=current_user.id,
    )
    db.add(clone)
    db.commit()
    db.refresh(clone)
    return clone


@router.post("/{experiment_id}/rerun", response_model=ExperimentSchema)
def rerun_experiment(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rerun = clone_experiment(experiment_id, db, current_user)
    db_exp = db.query(Experiment).filter(Experiment.id == rerun.id).first()
    db_exp.status = ExperimentStatus.QUEUED
    db_exp.status_detail = "Experiment queued for rerun"
    db.commit()
    launch_experiment_async(db_exp.id)
    db.refresh(db_exp)
    return db_exp


@router.get("/{experiment_id}/logs")
def get_experiment_logs(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")

    def _read(path: str):
        if not path or not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8", errors="replace") as handle:
            return handle.read()

    return {
        "batsim_stdout": _read(exp.batsim_stdout_log_path),
        "batsim_stderr": _read(exp.batsim_stderr_log_path),
        "scheduler_stdout": _read(exp.scheduler_stdout_log_path),
        "scheduler_stderr": _read(exp.scheduler_stderr_log_path),
    }


@router.get("/{experiment_id}/manifest")
def get_experiment_manifest(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if not exp.manifest_path or not os.path.exists(exp.manifest_path):
        raise HTTPException(status_code=404, detail="Manifest not found")
    with open(exp.manifest_path, "r", encoding="utf-8") as handle:
        return json.load(handle)


@router.get("/{experiment_id}/artifacts")
def download_experiment_artifacts(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if not exp.simulation_dir or not os.path.isdir(exp.simulation_dir):
        raise HTTPException(status_code=404, detail="Artifact directory not found")

    archive_path = shutil.make_archive(exp.simulation_dir, "zip", exp.simulation_dir)
    return FileResponse(
        archive_path,
        media_type="application/zip",
        filename=f"{exp.run_uuid or f'experiment-{exp.id}'}.zip",
    )
