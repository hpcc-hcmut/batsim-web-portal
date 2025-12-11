from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    workload_id = Column(Integer, ForeignKey("workloads.id"), nullable=False)
    platform_id = Column(Integer, ForeignKey("platforms.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Configuration (FR6) - JSON: {seed, duration_limit, options}
    config = Column(Text, nullable=True)

    # Clone tracking (FR6)
    parent_scenario_id = Column(Integer, ForeignKey("scenarios.id"), nullable=True)

    # Project association (FR2)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

    # Prediction configuration (Phase 7)
    prediction_enabled = Column(Boolean, default=False)
    prediction_model_id = Column(Integer, ForeignKey("prediction_models.id"), nullable=True)
    prediction_mode = Column(String, default="no_prediction")  # no_prediction, prediction_only, hybrid

    # Relationships
    workload = relationship("Workload", back_populates="scenarios")
    platform = relationship("Platform", back_populates="scenarios")
    creator = relationship("User", back_populates="scenarios")
    experiments = relationship("Experiment", back_populates="scenario")
    parent = relationship("Scenario", remote_side=[id], backref="clones")
    project = relationship("Project", back_populates="scenarios")
    prediction_model = relationship("PredictionModel")
