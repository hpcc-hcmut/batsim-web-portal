"""
Experiments API - Simulation Control Endpoints
"""

import json
import logging
from typing import List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

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
    ExperimentStatusUpdate,
)
from app.api.auth import get_current_user
from app.services.simulation_service import simulation_service
from app.services.docker_service import docker_service

logger = logging.getLogger(__name__)
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
    scenario = db.query(Scenario).filter(Scenario.id == experiment_create.scenario_id).first()
    strategy = db.query(Strategy).filter(Strategy.id == experiment_create.strategy_id).first()
    if not scenario or not strategy:
        raise HTTPException(status_code=400, detail="Invalid scenario or strategy")
    if not scenario.platform or not scenario.workload:
        raise HTTPException(status_code=400, detail="Scenario needs platform and workload")

    exp = Experiment(
        name=experiment_create.name,
        description=experiment_create.description,
        scenario_id=experiment_create.scenario_id,
        strategy_id=experiment_create.strategy_id,
        status=ExperimentStatus.PENDING,
        config=json.dumps(experiment_create.config) if experiment_create.config else None,
        created_by=current_user.id,
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)
    logger.info(f"Created experiment {exp.id}: {exp.name}")
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
    if exp.status == ExperimentStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Cannot update running experiment")
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
    if exp.status == ExperimentStatus.RUNNING:
        try:
            import asyncio
            asyncio.run(simulation_service.stop_simulation(experiment_id))
        except Exception as e:
            logger.warning(f"Error stopping experiment: {e}")
    db.delete(exp)
    db.commit()
    return {"message": "Experiment deleted successfully"}


@router.post("/{experiment_id}/start")
async def start_experiment(
    experiment_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a simulation experiment asynchronously."""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")

    if exp.status != ExperimentStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Cannot start from {exp.status.value}")

    if not exp.scenario or not exp.scenario.platform or not exp.scenario.workload:
        raise HTTPException(status_code=400, detail="Invalid scenario configuration")
    if not exp.strategy:
        raise HTTPException(status_code=400, detail="No strategy assigned")

    if not docker_service.is_available():
        raise HTTPException(status_code=503, detail="Docker daemon not available")

    running_count = len(simulation_service.get_running_experiments())
    if running_count >= settings.MAX_CONCURRENT_SIMULATIONS:
        raise HTTPException(status_code=429, detail="Max concurrent simulations reached")

    try:
        await simulation_service.start_simulation(experiment_id)
        logger.info(f"Started experiment {experiment_id} by {current_user.username}")
        return {"message": "Simulation started", "experiment_id": experiment_id, "status": "running"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{experiment_id}/stop")
async def stop_experiment(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stop a running experiment."""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.status not in (ExperimentStatus.RUNNING, ExperimentStatus.PAUSED):
        raise HTTPException(status_code=400, detail=f"Not running: {exp.status.value}")
    try:
        await simulation_service.stop_simulation(experiment_id)
        logger.info(f"Stopped experiment {experiment_id}")
        return {"message": "Stopped", "experiment_id": experiment_id, "status": "cancelled"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{experiment_id}/pause")
async def pause_experiment(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pause a running experiment."""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.status != ExperimentStatus.RUNNING:
        raise HTTPException(status_code=400, detail=f"Not running: {exp.status.value}")
    try:
        await simulation_service.pause_simulation(experiment_id)
        return {"message": "Paused", "experiment_id": experiment_id, "status": "paused"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{experiment_id}/resume")
async def resume_experiment(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resume a paused experiment."""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.status != ExperimentStatus.PAUSED:
        raise HTTPException(status_code=400, detail=f"Not paused: {exp.status.value}")
    try:
        await simulation_service.resume_simulation(experiment_id)
        return {"message": "Resumed", "experiment_id": experiment_id, "status": "running"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{experiment_id}/status")
def get_experiment_status(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current status and progress."""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")

    elapsed = None
    if exp.start_time:
        end = exp.end_time or datetime.now()
        elapsed = int((end - exp.start_time).total_seconds())

    return {
        "experiment_id": experiment_id,
        "name": exp.name,
        "status": exp.status.value,
        "progress_percentage": exp.progress_percentage or 0,
        "completed_jobs": exp.completed_jobs or 0,
        "total_jobs": exp.total_jobs or 0,
        "start_time": exp.start_time.isoformat() if exp.start_time else None,
        "end_time": exp.end_time.isoformat() if exp.end_time else None,
        "elapsed_seconds": elapsed,
        "is_running": simulation_service.is_running(experiment_id),
    }


@router.get("/{experiment_id}/logs")
def get_experiment_logs(
    experiment_id: int,
    tail: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get logs for an experiment."""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")

    def last_lines(text, n):
        if not text:
            return ""
        return "\n".join(text.strip().split("\n")[-n:])

    return {
        "experiment_id": experiment_id,
        "batsim_logs": last_lines(exp.batsim_logs or "", tail),
        "pybatsim_logs": last_lines(exp.pybatsim_logs or "", tail),
    }


@router.get("/{experiment_id}/stats")
async def get_experiment_stats(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get container resource statistics."""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")

    if exp.status != ExperimentStatus.RUNNING:
        return {"experiment_id": experiment_id, "status": exp.status.value, "stats": None}

    try:
        stats = await docker_service.get_container_stats(experiment_id)
        return {
            "experiment_id": experiment_id,
            "status": exp.status.value,
            "stats": {
                name: {
                    "cpu_percent": s.cpu_percent,
                    "memory_usage_mb": s.memory_usage_mb,
                    "memory_limit_mb": s.memory_limit_mb,
                    "memory_percent": s.memory_percent,
                }
                for name, s in stats.items()
            }
        }
    except Exception as e:
        logger.warning(f"Failed to get stats: {e}")
        return {"experiment_id": experiment_id, "status": exp.status.value, "stats": None}
