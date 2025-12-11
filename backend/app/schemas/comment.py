from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class CommentBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class CommentCreate(CommentBase):
    entity_type: str = Field(..., pattern="^(experiment|scenario|project)$")
    entity_id: int
    parent_id: Optional[int] = None


class CommentUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class CommentResponse(CommentBase):
    id: int
    entity_type: str
    entity_id: int
    parent_id: Optional[int] = None
    thread_level: int
    user_id: int
    username: Optional[str] = None
    is_deleted: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    reply_count: int = 0

    class Config:
        from_attributes = True


class CommentThread(CommentResponse):
    """Comment with nested replies (for threaded display)."""
    replies: List["CommentThread"] = []


CommentThread.model_rebuild()  # Required for self-referential model
