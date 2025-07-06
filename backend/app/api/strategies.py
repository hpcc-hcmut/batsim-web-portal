from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import os
import shutil
from app.core.database import get_db
from app.core.config import settings
from app.models.user import User
from app.models.strategy import Strategy
from app.schemas.strategy import (
    Strategy as StrategySchema,
    StrategyCreate,
    StrategyUpdate,
    StrategyWithCreator,
)
from app.api.auth import get_current_user

router = APIRouter()


def ensure_storage_directory():
    os.makedirs(os.path.join(settings.STORAGE_PATH, "strategies"), exist_ok=True)


@router.get("/", response_model=List[StrategyWithCreator])
def get_strategies(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    strategies = db.query(Strategy).offset(skip).limit(limit).all()
    result = []
    for strategy in strategies:
        strategy_dict = StrategyWithCreator.from_orm(strategy)
        if strategy.creator:
            strategy_dict.creator_username = strategy.creator.username
        result.append(strategy_dict)
    return result


@router.get("/{strategy_id}", response_model=StrategyWithCreator)
def get_strategy(
    strategy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    strategy = db.query(Strategy).filter(Strategy.id == strategy_id).first()
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")
    strategy_dict = StrategyWithCreator.from_orm(strategy)
    if strategy.creator:
        strategy_dict.creator_username = strategy.creator.username
    return strategy_dict


@router.post("/", response_model=StrategySchema)
async def create_strategy(
    name: str = Form(...),
    description: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_storage_directory()
    # Check if strategy with same name exists
    existing_strategy = db.query(Strategy).filter(Strategy.name == name).first()
    if existing_strategy:
        raise HTTPException(
            status_code=400, detail="Strategy with this name already exists"
        )
    # Save file
    file_path = os.path.join(
        settings.STORAGE_PATH, "strategies", f"{name}_{file.filename}"
    )
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    # Create strategy record
    strategy = Strategy(
        name=name,
        description=description,
        file_path=file_path,
        file_size=file.size,
        file_type=file.content_type or "python",
        created_by=current_user.id,
    )
    db.add(strategy)
    db.commit()
    db.refresh(strategy)
    return strategy


@router.put("/{strategy_id}", response_model=StrategySchema)
def update_strategy(
    strategy_id: int,
    strategy_update: StrategyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    strategy = db.query(Strategy).filter(Strategy.id == strategy_id).first()
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")
    # Check permissions (only creator or admin can update)
    if strategy.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    for field, value in strategy_update.dict(exclude_unset=True).items():
        setattr(strategy, field, value)
    db.commit()
    db.refresh(strategy)
    return strategy


@router.delete("/{strategy_id}")
def delete_strategy(
    strategy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    strategy = db.query(Strategy).filter(Strategy.id == strategy_id).first()
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")
    # Check permissions (only creator or admin can delete)
    if strategy.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    # Delete file
    if os.path.exists(strategy.file_path):
        os.remove(strategy.file_path)
    db.delete(strategy)
    db.commit()
    return {"message": "Strategy deleted successfully"}


@router.get("/{strategy_id}/download")
def download_strategy(
    strategy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    strategy = db.query(Strategy).filter(Strategy.id == strategy_id).first()
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")
    if not os.path.exists(strategy.file_path):
        raise HTTPException(status_code=404, detail="Strategy file not found")
    return {
        "file_path": strategy.file_path,
        "file_name": os.path.basename(strategy.file_path),
    }
