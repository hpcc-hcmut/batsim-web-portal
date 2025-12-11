from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class StrategyType(str, enum.Enum):
    FCFS = "fcfs"
    BACKFILLING = "backfilling"
    EASY_BACKFILL = "easy_backfill"
    PRIORITY = "priority"
    FAIR_SHARE = "fair_share"
    ENERGY_AWARE = "energy_aware"
    RL_BASED = "rl_based"
    CUSTOM = "custom"


class Strategy(Base):
    __tablename__ = "strategies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer)
    file_type = Column(String, default="python")
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    # Strategy metadata
    nb_files = Column(Integer, nullable=True)
    main_entry = Column(String, nullable=True)  # Main entry point file
    strategy_files = Column(Text, nullable=True)  # Store as JSON string

    # Versioning and classification (FR5)
    version = Column(Integer, default=1)
    parent_id = Column(Integer, ForeignKey("strategies.id"), nullable=True)
    strategy_type = Column(Enum(StrategyType), default=StrategyType.CUSTOM)
    is_baseline = Column(Boolean, default=False)

    # Project association (FR2)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

    # Relationships
    creator = relationship("User", back_populates="strategies")
    experiments = relationship("Experiment", back_populates="strategy")
    parent = relationship("Strategy", remote_side=[id], backref="versions")
    project = relationship("Project", back_populates="strategies")
