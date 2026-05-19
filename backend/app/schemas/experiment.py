from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.models.experiment import ExperimentStatus


class ExperimentBase(BaseModel):
    name: str
    description: Optional[str] = None
    scenario_id: int
    strategy_id: int


class ExperimentCreate(ExperimentBase):
    config: Optional[Dict[str, Any]] = None
    seed: Optional[int] = None
    params: Optional[Dict[str, Any]] = None


class ExperimentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    # status intentionally excluded — use /start and /stop endpoints for state transitions


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
    # Live progress fields (Task 7.5 — populated by progress_parser thread)
    live_jobs_submitted: Optional[int] = 0
    live_jobs_completed: Optional[int] = 0
    live_jobs_running: Optional[int] = 0
    live_jobs_failed: Optional[int] = 0
    last_sim_time: Optional[float] = 0.0
    config: Optional[str] = None
    frozen_config: Optional[str] = None
    seed: Optional[int] = None
    params: Optional[str] = None
    simulation_dir: Optional[str] = None
    batsim_logs: Optional[str] = None
    pybatsim_logs: Optional[str] = None
    error_message: Optional[str] = None
    container_network: Optional[str] = None
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


class LiveProgressResponse(BaseModel):
    """Response schema for GET /experiments/{id}/progress endpoint (Task 7.5)."""
    live_jobs_submitted: int = 0
    live_jobs_completed: int = 0
    live_jobs_running: int = 0
    live_jobs_failed: int = 0
    last_sim_time: float = 0.0
    progress_percentage: int = 0
    total_jobs: int = 0
    completed_jobs: int = 0
    wall_seconds: float = 0.0
    status: str = ""
    history: Optional[List[List[float]]] = None  # [[wall_s, completed], ...]
