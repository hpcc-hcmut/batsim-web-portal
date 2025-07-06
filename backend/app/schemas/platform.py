from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PlatformBase(BaseModel):
    name: str
    description: Optional[str] = None


class PlatformCreate(PlatformBase):
    pass


class PlatformUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class PlatformInDB(PlatformBase):
    id: int
    file_path: str
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Platform(PlatformInDB):
    pass


class PlatformWithCreator(Platform):
    creator_username: Optional[str] = None
