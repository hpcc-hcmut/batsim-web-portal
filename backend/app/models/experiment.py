from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class ExperimentStatus(str, enum.Enum):
    CREATED = "created"       # Initial state when experiment is created
    QUEUED = "queued"         # Waiting in execution queue
    PENDING = "pending"       # Legacy - kept for compatibility
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    scenario_id = Column(Integer, ForeignKey("scenarios.id"), nullable=False)
    strategy_id = Column(Integer, ForeignKey("strategies.id"), nullable=False)
    status = Column(Enum(ExperimentStatus), default=ExperimentStatus.PENDING)

    # Container information
    batsim_container_id = Column(String)
    pybatsim_container_id = Column(String)

    # Timing
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    estimated_duration = Column(Integer)  # in seconds

    # Progress tracking
    total_jobs = Column(Integer)
    completed_jobs = Column(Integer, default=0)
    progress_percentage = Column(Integer, default=0)

    # Configuration
    config = Column(Text)  # JSON string of experiment configuration
    # Execution details
    simulation_dir = Column(String)  # Directory where simulation files are stored
    batsim_logs = Column(Text)  # Batsim execution logs
    pybatsim_logs = Column(Text)  # Pybatsim execution logs

    # Grafana integration
    grafana_dashboard_uid = Column(String)  # UID of dynamically created Grafana dashboard

    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Project association (FR2)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

    # Relationships
    scenario = relationship("Scenario", back_populates="experiments")
    strategy = relationship("Strategy", back_populates="experiments")
    creator = relationship("User", back_populates="experiments")
    results = relationship("Result", back_populates="experiment")
    project = relationship("Project", back_populates="experiments")
