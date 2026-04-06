from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class ExperimentStatus(str, enum.Enum):
    PENDING = "pending"
    PREPARING = "preparing"
    RUNNING = "running"
    PARSING = "parsing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    QUEUED = "queued"


class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True)
    scenario_id = Column(Integer, ForeignKey("scenarios.id"), nullable=False)
    strategy_id = Column(Integer, ForeignKey("strategies.id"), nullable=False)
    status = Column(Enum(ExperimentStatus), default=ExperimentStatus.PENDING)

    # Immutable run metadata
    run_uuid = Column(String, unique=True, index=True)
    seed = Column(Integer)
    parameter_json = Column(Text)
    execution_backend = Column(String, default="subprocess")
    batsim_version = Column(String)
    scheduler_version = Column(String)
    strategy_commit_hash = Column(String)
    platform_checksum = Column(String)
    workload_checksum = Column(String)

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
    status_detail = Column(Text)
    failure_reason = Column(Text)

    # Execution details
    simulation_dir = Column(String)  # Directory where simulation files are stored
    manifest_path = Column(String)
    stdout_log_path = Column(String)
    stderr_log_path = Column(String)
    batsim_stdout_log_path = Column(String)
    batsim_stderr_log_path = Column(String)
    scheduler_stdout_log_path = Column(String)
    scheduler_stderr_log_path = Column(String)
    exit_code = Column(Integer)
    batsim_pid = Column(Integer)
    scheduler_pid = Column(Integer)
    batsim_logs = Column(Text)  # Batsim execution logs
    pybatsim_logs = Column(Text)  # Pybatsim execution logs

    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    scenario = relationship("Scenario", back_populates="experiments")
    strategy = relationship("Strategy", back_populates="experiments")
    campaign = relationship("Campaign", back_populates="experiments")
    creator = relationship("User", back_populates="experiments")
    results = relationship("Result", back_populates="experiment")
