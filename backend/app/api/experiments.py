from typing import List
from fastapi import APIRouter, Depends, HTTPException
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

    # Create experiment record first (need ID for bundle dir)
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
        exp.simulation_dir = frozen["frozen_files"].get("workload_path", "").rsplit("/", 1)[0]
        db.commit()
        db.refresh(exp)
    except ValueError as e:
        # Cleanup DB record and any partially-copied files
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
    """Enqueue experiment for execution (PENDING → QUEUED).

    The queue service will promote QUEUED → RUNNING when a slot is available.
    Actual container orchestration happens in Phase 3.
    """
    try:
        exp = enqueue_experiment(db, experiment_id)
        # Try to promote queued experiments immediately
        promoted = process_queue(db)
        return {
            "message": f"Experiment queued (position in queue)",
            "status": exp.status.value,
            "promoted": promoted,
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
    """Cancel an experiment (from QUEUED or RUNNING)."""
    try:
        exp = cancel_experiment(db, experiment_id)
        # Process queue — may promote next queued experiment
        promoted = process_queue(db)
        return {
            "message": "Experiment cancelled",
            "status": exp.status.value,
            "promoted": promoted,
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
    }
