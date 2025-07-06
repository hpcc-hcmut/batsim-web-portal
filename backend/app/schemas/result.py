from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class ResultBase(BaseModel):
    experiment_id: int


class ResultCreate(ResultBase):
    simulation_time: Optional[float] = None
    total_jobs: Optional[int] = None
    completed_jobs: Optional[int] = None
    failed_jobs: int = 0
    makespan: Optional[float] = None
    average_waiting_time: Optional[float] = None
    average_turnaround_time: Optional[float] = None
    resource_utilization: Optional[float] = None
    config: Optional[Dict[str, Any]] = None
    metrics: Optional[Dict[str, Any]] = None
    logs: Optional[str] = None
    result_file_path: Optional[str] = None
    log_file_path: Optional[str] = None


class ResultUpdate(BaseModel):
    simulation_time: Optional[float] = None
    total_jobs: Optional[int] = None
    completed_jobs: Optional[int] = None
    failed_jobs: Optional[int] = None
    makespan: Optional[float] = None
    average_waiting_time: Optional[float] = None
    average_turnaround_time: Optional[float] = None
    resource_utilization: Optional[float] = None
    config: Optional[Dict[str, Any]] = None
    metrics: Optional[Dict[str, Any]] = None
    logs: Optional[str] = None
    result_file_path: Optional[str] = None
    log_file_path: Optional[str] = None


class ResultInDB(ResultBase):
    id: int
    simulation_time: Optional[float] = None
    total_jobs: Optional[int] = None
    completed_jobs: Optional[int] = None
    failed_jobs: int = 0
    makespan: Optional[float] = None
    average_waiting_time: Optional[float] = None
    average_turnaround_time: Optional[float] = None
    resource_utilization: Optional[float] = None
    config: Optional[str] = None
    metrics: Optional[str] = None
    logs: Optional[str] = None
    result_file_path: Optional[str] = None
    log_file_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class Result(ResultInDB):
    pass


class ResultWithExperiment(Result):
    experiment_name: Optional[str] = None
    scenario_name: Optional[str] = None
    strategy_name: Optional[str] = None
