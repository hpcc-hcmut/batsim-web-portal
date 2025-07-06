from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class StrategyBase(BaseModel):
    name: str
    description: Optional[str] = None


class StrategyCreate(StrategyBase):
    pass


class StrategyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class StrategyInDB(StrategyBase):
    id: int
    file_path: str
    file_size: Optional[int] = None
    file_type: str = "python"
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    nb_files: Optional[int] = None
    main_entry: Optional[str] = None
    strategy_files: Optional[str] = None

    class Config:
        from_attributes = True


class Strategy(StrategyInDB):
    pass


class StrategyWithCreator(Strategy):
    creator_username: Optional[str] = None
