from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, event, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class ExperimentStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
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
    scenario_id = Column(Integer, ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=False)
    strategy_id = Column(Integer, ForeignKey("strategies.id", ondelete="CASCADE"), nullable=False)
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

    # Live progress (Task 7.5 — populated by progress_parser thread during RUNNING)
    live_jobs_submitted = Column(Integer, default=0)   # cumulative submitted count from batsim_stdout
    live_jobs_completed = Column(Integer, default=0)   # cumulative completed count from batsim_stdout
    live_jobs_running = Column(Integer, default=0)     # derived: submitted - completed - failed
    live_jobs_failed = Column(Integer, default=0)      # killed/walltime-reached jobs (v2; 0 in v1)
    last_sim_time = Column(Float, default=0.0)         # batsim simulation-time (virtual seconds)

    # Configuration
    config = Column(Text)  # JSON string of experiment configuration
    frozen_config = Column(Text)  # Immutable JSON snapshot of workload/platform/strategy versions + paths
    seed = Column(Integer)  # Random seed for reproducibility
    params = Column(Text)  # JSON string of additional simulation parameters
    # Execution details
    simulation_dir = Column(String)  # Directory where simulation files are stored
    batsim_logs = Column(Text)  # Batsim stdout logs (repurposed from merged; rename in Phase 9)
    batsim_stderr = Column(Text)  # Batsim stderr logs (added in Task 7.6 — 4-stream split)
    pybatsim_logs = Column(Text)  # Pybatsim stdout logs (repurposed from merged; rename in Phase 9)
    pybatsim_stderr = Column(Text)  # Pybatsim stderr logs (added in Task 7.6 — 4-stream split)
    error_message = Column(Text)  # Error details on failure
    container_network = Column(String)  # Docker network name for this experiment

    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    scenario = relationship("Scenario", back_populates="experiments")
    strategy = relationship("Strategy", back_populates="experiments")
    creator = relationship("User", back_populates="experiments")
    results = relationship("Result", back_populates="experiment", cascade="all, delete-orphan", passive_deletes=True)


# ORM-level cleanup hook: fires for both direct API deletes AND FK CASCADE deletes
# triggered by parent removal (workload/platform/strategy/scenario). The API handler
# (api/experiments.py) also wipes exp_dir on direct delete; this listener is the
# safety net for cascade paths that bypass the handler.
@event.listens_for(Experiment, "before_delete")
def _wipe_experiment_storage(_mapper, _connection, target):
    import os
    import shutil
    from app.core.config import settings
    exp_dir = os.path.join(settings.SIMULATION_DATA_PATH, str(target.id))
    if os.path.exists(exp_dir):
        shutil.rmtree(exp_dir, ignore_errors=True)
