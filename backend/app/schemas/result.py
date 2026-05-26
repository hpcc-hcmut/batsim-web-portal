from pydantic import BaseModel
from typing import Optional, Dict, Any, List
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
    jobs_data: Optional[str] = None
    schedule_data: Optional[str] = None
    computed_metrics: Optional[str] = None

    class Config:
        from_attributes = True


class Result(ResultInDB):
    pass


class ResultWithExperiment(Result):
    experiment_name: Optional[str] = None
    scenario_name: Optional[str] = None
    strategy_name: Optional[str] = None


class ResultListItem(BaseModel):
    """Lightweight list schema — excludes multi-MB CSV blobs.

    Used by GET /results/ with load_only() so SQLite never reads blob pages.
    Revert: switch response_model back to List[ResultWithExperiment] and remove load_only().
    """
    id: int
    experiment_id: int
    simulation_time: Optional[float] = None
    total_jobs: Optional[int] = None
    completed_jobs: Optional[int] = None
    failed_jobs: int = 0
    makespan: Optional[float] = None
    average_waiting_time: Optional[float] = None
    average_turnaround_time: Optional[float] = None
    resource_utilization: Optional[float] = None
    created_at: datetime
    experiment_name: Optional[str] = None
    scenario_name: Optional[str] = None
    strategy_name: Optional[str] = None

    class Config:
        from_attributes = True


class TimelineJob(BaseModel):
    """One job's timeline event for Gantt rendering."""
    job_id: str
    submission_time: float
    starting_time: Optional[float] = None
    finish_time: Optional[float] = None
    waiting_time: Optional[float] = None
    execution_time: Optional[float] = None
    turnaround_time: Optional[float] = None
    slowdown: Optional[float] = None
    requested_resources: int = 0
    allocated_resources: List[int] = []
    success: bool = False
    final_state: Optional[str] = None


class TimelineSeriesPoint(BaseModel):
    """One (t, value) point — used for utilization, queue depth, CDF."""
    t: float
    value: float


class TimelineResponse(BaseModel):
    """Aggregated timeline data for Replay tab (Gantt + 3 charts)."""
    result_id: int
    total_jobs: int
    n_hosts: int
    makespan: float
    truncated: bool = False  # True if jobs list capped via limit param
    jobs: List[TimelineJob]
    utilization_series: List[TimelineSeriesPoint]
    queue_series: List[TimelineSeriesPoint]
    waiting_cdf: List[TimelineSeriesPoint]
