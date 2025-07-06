from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from app.models.experiment import ExperimentStatus


class ExperimentBase(BaseModel):
    name: str
    description: Optional[str] = None
    scenario_id: int
    strategy_id: int


class ExperimentCreate(ExperimentBase):
    config: Optional[Dict[str, Any]] = None


class ExperimentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ExperimentStatus] = None
    config: Optional[Dict[str, Any]] = None


class ExperimentInDB(ExperimentBase):
    id: int
    status: ExperimentStatus
    batsim_container_id: Optional[str] = None
    pybatsim_container_id: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    estimated_duration: Optional[int] = None
    total_jobs: Optional[int] = None
    completed_jobs: int = 0
    progress_percentage: int = 0
    config: Optional[str] = None
    simulation_dir: Optional[str] = None
    batsim_logs: Optional[str] = None
    pybatsim_logs: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Experiment(ExperimentInDB):
    pass


class ExperimentWithDetails(Experiment):
    scenario_name: Optional[str] = None
    strategy_name: Optional[str] = None
    creator_username: Optional[str] = None


class ExperimentStatusUpdate(BaseModel):
    status: ExperimentStatus
    progress_percentage: Optional[int] = None
    completed_jobs: Optional[int] = None
