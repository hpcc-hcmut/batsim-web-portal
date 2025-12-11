"""
Prediction Schema - Pydantic models for prediction API.
"""

from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class PredictionModelBase(BaseModel):
    name: str
    description: Optional[str] = None
    model_type: str = "mock"  # xgboost, random_forest, linear, mock
    features: Optional[str] = None  # JSON array of feature names


class PredictionModelCreate(PredictionModelBase):
    model_path: str


class PredictionModelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class PredictionModelInDB(PredictionModelBase):
    id: int
    model_path: str
    is_active: bool = True
    accuracy: Optional[float] = None
    mae: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None

    class Config:
        from_attributes = True


class PredictionModel(PredictionModelInDB):
    pass


class PredictionPreviewRequest(BaseModel):
    workload_id: int
    model_id: Optional[int] = None
    mode: str = "no_prediction"  # no_prediction, prediction_only, hybrid
    sample_size: int = 5


class JobPredictionSample(BaseModel):
    job_id: str
    original_walltime: float
    predicted_duration: float
    confidence: float
    mode: str


class PredictionPreviewResponse(BaseModel):
    total_jobs: int
    sample_size: int
    mode: str
    model_id: Optional[int]
    samples: List[JobPredictionSample]


class PredictionStats(BaseModel):
    total_models: int
    active_models: int
    available_modes: List[str] = ["no_prediction", "prediction_only", "hybrid"]
