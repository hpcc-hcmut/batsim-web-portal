from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime


class AuditLogBase(BaseModel):
    action: str
    entity_type: str
    entity_id: int
    entity_name: Optional[str] = None
    project_id: Optional[int] = None
    changes: Optional[Dict[str, Any]] = None


class AuditLogCreate(AuditLogBase):
    user_id: int
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class AuditLogResponse(AuditLogBase):
    id: int
    user_id: int
    created_at: datetime
    username: Optional[str] = None  # Populated via join
    ip_address: Optional[str] = None

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    items: List[AuditLogResponse]
    total: int
    next_cursor: Optional[str] = None  # Cursor-based pagination
