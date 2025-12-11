from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.project_member import ProjectRole


class ProjectMemberBase(BaseModel):
    user_id: int
    role: ProjectRole = ProjectRole.MEMBER


class ProjectMemberCreate(ProjectMemberBase):
    pass


class ProjectMemberResponse(ProjectMemberBase):
    id: int
    project_id: int
    created_at: datetime
    username: Optional[str] = None
    email: Optional[str] = None

    class Config:
        from_attributes = True


class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class Project(ProjectBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProjectWithDetails(Project):
    owner_username: Optional[str] = None
    member_count: int = 0
    workload_count: int = 0
    platform_count: int = 0
    scenario_count: int = 0
    strategy_count: int = 0
    experiment_count: int = 0


class ProjectWithMembers(Project):
    owner_username: Optional[str] = None
    members: List[ProjectMemberResponse] = []
