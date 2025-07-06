from pydantic import BaseModel
from typing import Optional
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

    class Config:
        from_attributes = True


class Workload(WorkloadInDB):
    pass


class WorkloadWithCreator(Workload):
    creator_username: Optional[str] = None
