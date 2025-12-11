"""
Prediction API - Endpoints for managing prediction models and previewing transformations.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import shutil

from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.prediction_model import PredictionModel, PredictionMode, ModelType
from app.models.workload import Workload
from app.schemas.prediction import (
    PredictionModel as PredictionModelSchema,
    PredictionModelCreate,
    PredictionModelUpdate,
    PredictionPreviewRequest,
    PredictionPreviewResponse,
    PredictionStats,
)
from app.services.prediction_service import prediction_service

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.get("/models", response_model=List[PredictionModelSchema])
async def list_models(
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List available prediction models."""
    query = db.query(PredictionModel)
    if active_only:
        query = query.filter(PredictionModel.is_active == True)
    return query.all()


@router.get("/models/{model_id}", response_model=PredictionModelSchema)
async def get_model(
    model_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific prediction model."""
    model = db.query(PredictionModel).filter(PredictionModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model


@router.post("/models", response_model=PredictionModelSchema, status_code=status.HTTP_201_CREATED)
async def create_model(
    model_data: PredictionModelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a new prediction model."""
    # Check if name already exists
    existing = db.query(PredictionModel).filter(PredictionModel.name == model_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Model name already exists")
    
    model = PredictionModel(
        name=model_data.name,
        description=model_data.description,
        model_path=model_data.model_path,
        model_type=ModelType(model_data.model_type) if model_data.model_type else ModelType.MOCK,
        features=model_data.features,
        created_by=current_user.id,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return model


@router.put("/models/{model_id}", response_model=PredictionModelSchema)
async def update_model(
    model_id: int,
    model_data: PredictionModelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a prediction model."""
    model = db.query(PredictionModel).filter(PredictionModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    update_data = model_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(model, field, value)
    
    db.commit()
    db.refresh(model)
    return model


@router.delete("/models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(
    model_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a prediction model (soft delete - sets is_active=False)."""
    model = db.query(PredictionModel).filter(PredictionModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    model.is_active = False
    db.commit()
    return None


@router.post("/preview", response_model=PredictionPreviewResponse)
async def preview_prediction(
    request: PredictionPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Preview how predictions would transform a workload."""
    workload = db.query(Workload).filter(Workload.id == request.workload_id).first()
    if not workload:
        raise HTTPException(status_code=404, detail="Workload not found")
    
    if not workload.file_path or not os.path.exists(workload.file_path):
        raise HTTPException(status_code=400, detail="Workload file not found")
    
    try:
        mode = PredictionMode(request.mode)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid prediction mode: {request.mode}")
    
    result = await prediction_service.preview_transformation(
        workload_path=workload.file_path,
        model_id=request.model_id,
        mode=mode,
        sample_size=request.sample_size,
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result


@router.get("/stats", response_model=PredictionStats)
async def get_prediction_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get prediction system statistics."""
    total_models = db.query(PredictionModel).count()
    active_models = db.query(PredictionModel).filter(PredictionModel.is_active == True).count()
    
    return PredictionStats(
        total_models=total_models,
        active_models=active_models,
        available_modes=["no_prediction", "prediction_only", "hybrid"],
    )


@router.post("/models/{model_id}/upload")
async def upload_model_file(
    model_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a model file (.joblib) for a prediction model."""
    model = db.query(PredictionModel).filter(PredictionModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    if not file.filename.endswith(".joblib"):
        raise HTTPException(status_code=400, detail="Only .joblib files are supported")
    
    # Create models directory if not exists
    models_dir = os.path.join(os.getcwd(), "models")
    os.makedirs(models_dir, exist_ok=True)
    
    # Save file
    file_path = os.path.join(models_dir, f"model_{model_id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update model record
    model.model_path = file_path
    db.commit()
    
    return {"message": "Model file uploaded", "path": file_path}
