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


class ScenarioWorkloadBrief(BaseModel):
    """Cheap-column workload summary for scenario cards (no TEXT blobs)."""
    id: int
    name: str
    version: int = 1
    nb_res: Optional[int] = None
    file_size: Optional[int] = None

    class Config:
        from_attributes = True


class ScenarioPlatformBrief(BaseModel):
    """Cheap-column platform summary for scenario cards (no TEXT blobs)."""
    id: int
    name: str
    version: int = 1
    nb_hosts: Optional[int] = None
    nb_clusters: Optional[int] = None

    class Config:
        from_attributes = True


class ScenarioWithDetails(Scenario):
    # Legacy flat fields — kept so existing clients don't break
    workload_name: Optional[str] = None
    workload_version: Optional[int] = None
    platform_name: Optional[str] = None
    platform_version: Optional[int] = None
    creator_username: Optional[str] = None
    # Nested briefs for composition rows on the Scenarios page
    workload: Optional[ScenarioWorkloadBrief] = None
    platform: Optional[ScenarioPlatformBrief] = None
