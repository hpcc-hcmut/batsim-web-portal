from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Result(Base):
    __tablename__ = "results"

    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(Integer, ForeignKey("experiments.id"), nullable=False)

    # Simulation metrics
    simulation_time = Column(Float)  # Total simulation time in seconds
    total_jobs = Column(Integer)
    completed_jobs = Column(Integer)
    failed_jobs = Column(Integer, default=0)

    # Scheduling metrics
    makespan = Column(Float)
    average_waiting_time = Column(Float)
    average_turnaround_time = Column(Float)
    resource_utilization = Column(Float)

    # Detailed results
    config = Column(Text)  # JSON string of experiment configuration
    metrics = Column(Text)  # JSON string of detailed metrics
    logs = Column(Text)  # Simulation logs

    # File paths
    result_file_path = Column(String)  # Path to result files
    log_file_path = Column(String)  # Path to log files

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    experiment = relationship("Experiment", back_populates="results")
