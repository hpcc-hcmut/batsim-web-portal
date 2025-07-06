from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import os
import json
import subprocess
import docker
from datetime import datetime
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
        scenario_id=experiment_create.scenario_id,
        strategy_id=experiment_create.strategy_id,
        status=ExperimentStatus.PENDING,
        config=(
            json.dumps(experiment_create.config) if experiment_create.config else None
        ),
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
    """Start an experiment by running batsim and pybatsim"""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")

    if exp.status != ExperimentStatus.PENDING:
        raise HTTPException(
            status_code=400, detail="Experiment can only be started from PENDING status"
        )

    try:
        # Create simulation directory
        simulation_dir = os.path.join(
            settings.STORAGE_PATH, "experiments", f"exp_{exp.id}"
        )
        os.makedirs(simulation_dir, exist_ok=True)

        # Get platform and workload from scenario
        if not exp.scenario or not exp.scenario.platform or not exp.scenario.workload:
            raise HTTPException(
                status_code=400, detail="Invalid scenario configuration"
            )

        platform = exp.scenario.platform
        workload = exp.scenario.workload

        # Copy platform and workload files to simulation directory
        platform_file = os.path.join(simulation_dir, "platform.xml")
        workload_file = os.path.join(simulation_dir, "workload.json")
        strategy_file = os.path.join(simulation_dir, "strategy.py")

        # Copy files (simplified - in real implementation, you'd copy the actual files)
        # For now, we'll just create placeholder files
        with open(platform_file, "w") as f:
            f.write(f"# Platform file for experiment {exp.id} - {platform.name}")
        with open(workload_file, "w") as f:
            f.write(f"# Workload file for experiment {exp.id} - {workload.name}")
        with open(strategy_file, "w") as f:
            f.write(f"# Strategy file for experiment {exp.id} - {exp.strategy.name}")

        # Update experiment status
        exp.status = ExperimentStatus.RUNNING
        exp.start_time = datetime.now()
        exp.simulation_dir = simulation_dir
        db.commit()

        # TODO: In a real implementation, you would:
        # 1. Start batsim container with platform and workload
        # 2. Start pybatsim container with strategy
        # 3. Monitor the execution
        # 4. Update progress and logs

        return {
            "message": "Experiment started successfully",
            "simulation_dir": simulation_dir,
        }

    except Exception as e:
        exp.status = ExperimentStatus.FAILED
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

    if exp.status != ExperimentStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Experiment is not running")

    # TODO: Stop containers and cleanup
    exp.status = ExperimentStatus.CANCELLED
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
        "progress_percentage": exp.progress_percentage,
        "completed_jobs": exp.completed_jobs,
        "total_jobs": exp.total_jobs,
        "start_time": exp.start_time,
        "end_time": exp.end_time,
    }
