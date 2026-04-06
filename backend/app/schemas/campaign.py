from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CampaignBase(BaseModel):
    name: str
    description: Optional[str] = None
    notes: Optional[str] = None


class CampaignCreate(CampaignBase):
    scenario_ids: List[int] = Field(default_factory=list)
    strategy_ids: List[int] = Field(default_factory=list)
    seeds: List[int] = Field(default_factory=lambda: [1])
    parameter_variants: List[Dict[str, Any]] = Field(default_factory=lambda: [{}])


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class CampaignInDB(CampaignBase):
    id: int
    status: str
    matrix_definition_json: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Campaign(CampaignInDB):
    pass


class CampaignWithSummary(Campaign):
    total_runs: int = 0
    completed_runs: int = 0
    failed_runs: int = 0
    running_runs: int = 0
    pending_runs: int = 0
