from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class WorkloadBase(BaseModel):
    name: str
    description: Optional[str] = None


class WorkloadCreate(WorkloadBase):
    pass


class WorkloadUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class WorkloadInDB(WorkloadBase):
    id: int
    file_path: str
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    nb_res: Optional[int] = None
    jobs: Optional[str] = None  # JSON string stored in DB
    profiles: Optional[str] = None  # JSON string stored in DB
    version: int = 1

    class Config:
        from_attributes = True


class Workload(WorkloadInDB):
    pass


class WorkloadWithCreator(Workload):
    creator_username: Optional[str] = None


class WorkloadListItem(BaseModel):
    """Lightweight list schema — excludes multi-MB jobs/profiles TEXT blobs.

    Used by GET /workloads/ with load_only() so SQLite never reads blob pages from disk.
    Revert: switch response_model back to List[WorkloadWithCreator] and remove load_only().
    """
    id: int
    name: str
    description: Optional[str] = None
    file_path: str
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    nb_res: Optional[int] = None
    version: int = 1
    creator_username: Optional[str] = None

    class Config:
        from_attributes = True


class WorkloadSummary(BaseModel):
    """Aggregate stats of a workload without dumping full jobs list."""
    workload_id: int
    name: str
    nb_res: Optional[int] = None
    n_jobs: int
    n_profiles: int
    min_walltime: Optional[float] = None
    max_walltime: Optional[float] = None
    mean_walltime: Optional[float] = None
    total_walltime: Optional[float] = None
    min_res: Optional[int] = None
    max_res: Optional[int] = None
    earliest_subtime: Optional[float] = None
    latest_subtime: Optional[float] = None


class WorkloadJobsPage(BaseModel):
    """Paginated jobs slice for preview UI (virtual list source)."""
    workload_id: int
    offset: int
    limit: int
    total: int
    jobs: List[Dict[str, Any]]
