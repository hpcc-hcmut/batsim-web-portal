"""
Prediction Model - ML model registry for job duration prediction.

Stores metadata about trained ML models used for predicting job durations
before simulation. Models are stored as joblib files.
"""

import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, Boolean, Float
from sqlalchemy.sql import func
from app.core.database import Base


class PredictionMode(str, enum.Enum):
    """How to apply predictions to workload jobs."""
    NO_PREDICTION = "no_prediction"      # Use original walltime (default)
    PREDICTION_ONLY = "prediction_only"  # Replace walltime with prediction
    HYBRID = "hybrid"                    # Keep both original and predicted


class ModelType(str, enum.Enum):
    """Supported ML model types."""
    XGBOOST = "xgboost"
    RANDOM_FOREST = "random_forest"
    LINEAR = "linear"
    MOCK = "mock"  # For placeholder/testing


class PredictionModel(Base):
    """
    ML model registry for job duration prediction.

    Attributes:
        name: Unique model identifier
        description: Human-readable description
        model_path: Path to serialized model file (.joblib)
        model_type: Type of ML algorithm
        is_active: Whether model is available for use
        accuracy: Training accuracy metric (R² or MAE)
        features: JSON list of required input features
    """
    __tablename__ = "prediction_models"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    model_path = Column(String, nullable=False)  # Path to .joblib file
    model_type = Column(Enum(ModelType), default=ModelType.MOCK)
    is_active = Column(Boolean, default=True)

    # Model performance metrics
    accuracy = Column(Float, nullable=True)  # R² score or similar
    mae = Column(Float, nullable=True)       # Mean Absolute Error

    # Feature configuration (JSON array of feature names)
    features = Column(Text, nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, nullable=True)
