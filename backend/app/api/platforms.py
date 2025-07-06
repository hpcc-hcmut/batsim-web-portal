from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import os
import shutil
from app.core.database import get_db
from app.core.config import settings
from app.models.user import User
from app.models.platform import Platform
from app.schemas.platform import (
    Platform as PlatformSchema,
    PlatformCreate,
    PlatformUpdate,
    PlatformWithCreator,
)
from app.api.auth import get_current_user

router = APIRouter()


def ensure_storage_directory():
    os.makedirs(os.path.join(settings.STORAGE_PATH, "platforms"), exist_ok=True)


@router.get("/", response_model=List[PlatformWithCreator])
def get_platforms(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    platforms = db.query(Platform).offset(skip).limit(limit).all()
    result = []
    for platform in platforms:
        platform_dict = PlatformWithCreator.from_orm(platform)
        if platform.creator:
            platform_dict.creator_username = platform.creator.username
        result.append(platform_dict)
    return result


@router.get("/{platform_id}", response_model=PlatformWithCreator)
def get_platform(
    platform_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    platform = db.query(Platform).filter(Platform.id == platform_id).first()
    if platform is None:
        raise HTTPException(status_code=404, detail="Platform not found")
    platform_dict = PlatformWithCreator.from_orm(platform)
    if platform.creator:
        platform_dict.creator_username = platform.creator.username
    return platform_dict


@router.post("/", response_model=PlatformSchema)
async def create_platform(
    name: str = Form(...),
    description: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_storage_directory()
    # Check if platform with same name exists
    existing_platform = db.query(Platform).filter(Platform.name == name).first()
    if existing_platform:
        raise HTTPException(
            status_code=400, detail="Platform with this name already exists"
        )
    # Save file
    file_path = os.path.join(
        settings.STORAGE_PATH, "platforms", f"{name}_{file.filename}"
    )
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    # Create platform record
    platform = Platform(
        name=name,
        description=description,
        file_path=file_path,
        file_size=file.size,
        file_type=file.content_type,
        created_by=current_user.id,
    )
    db.add(platform)
    db.commit()
    db.refresh(platform)
    return platform


@router.put("/{platform_id}", response_model=PlatformSchema)
def update_platform(
    platform_id: int,
    platform_update: PlatformUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    platform = db.query(Platform).filter(Platform.id == platform_id).first()
    if platform is None:
        raise HTTPException(status_code=404, detail="Platform not found")
    # Check permissions (only creator or admin can update)
    if platform.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    for field, value in platform_update.dict(exclude_unset=True).items():
        setattr(platform, field, value)
    db.commit()
    db.refresh(platform)
    return platform


@router.delete("/{platform_id}")
def delete_platform(
    platform_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    platform = db.query(Platform).filter(Platform.id == platform_id).first()
    if platform is None:
        raise HTTPException(status_code=404, detail="Platform not found")
    # Check permissions (only creator or admin can delete)
    if platform.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    # Delete file
    if os.path.exists(platform.file_path):
        os.remove(platform.file_path)
    db.delete(platform)
    db.commit()
    return {"message": "Platform deleted successfully"}


@router.get("/{platform_id}/download")
def download_platform(
    platform_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    platform = db.query(Platform).filter(Platform.id == platform_id).first()
    if platform is None:
        raise HTTPException(status_code=404, detail="Platform not found")
    if not os.path.exists(platform.file_path):
        raise HTTPException(status_code=404, detail="Platform file not found")
    return {
        "file_path": platform.file_path,
        "file_name": os.path.basename(platform.file_path),
    }
