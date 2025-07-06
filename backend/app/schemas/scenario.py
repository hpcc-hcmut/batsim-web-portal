from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ScenarioBase(BaseModel):
    name: str
    description: Optional[str] = None
    workload_id: int
    platform_id: int


class ScenarioCreate(ScenarioBase):
    pass


class ScenarioUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    workload_id: Optional[int] = None
    platform_id: Optional[int] = None


class ScenarioInDB(ScenarioBase):
    id: int
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Scenario(ScenarioInDB):
    pass


class ScenarioWithDetails(Scenario):
    workload_name: Optional[str] = None
    platform_name: Optional[str] = None
    creator_username: Optional[str] = None
