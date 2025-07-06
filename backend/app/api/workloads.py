from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import os
import shutil
from app.core.database import get_db
from app.core.config import settings
from app.models.user import User
from app.models.workload import Workload
from app.schemas.workload import (
    Workload as WorkloadSchema,
    WorkloadCreate,
    WorkloadUpdate,
    WorkloadWithCreator,
)
from app.api.auth import get_current_user

router = APIRouter()


def ensure_storage_directory():
    os.makedirs(os.path.join(settings.STORAGE_PATH, "workloads"), exist_ok=True)


@router.get("/", response_model=List[WorkloadWithCreator])
def get_workloads(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workloads = db.query(Workload).offset(skip).limit(limit).all()
    result = []
    for workload in workloads:
        workload_dict = WorkloadWithCreator.from_orm(workload)
        if workload.creator:
            workload_dict.creator_username = workload.creator.username
        result.append(workload_dict)
    return result


@router.get("/{workload_id}", response_model=WorkloadWithCreator)
def get_workload(
    workload_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workload = db.query(Workload).filter(Workload.id == workload_id).first()
    if workload is None:
        raise HTTPException(status_code=404, detail="Workload not found")

    workload_dict = WorkloadWithCreator.from_orm(workload)
    if workload.creator:
        workload_dict.creator_username = workload.creator.username
    return workload_dict


@router.post("/", response_model=WorkloadSchema)
async def create_workload(
    name: str = Form(...),
    description: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_storage_directory()

    # Check if workload with same name exists
    existing_workload = db.query(Workload).filter(Workload.name == name).first()
    if existing_workload:
        raise HTTPException(
            status_code=400, detail="Workload with this name already exists"
        )

    # Save file
    file_path = os.path.join(
        settings.STORAGE_PATH, "workloads", f"{name}_{file.filename}"
    )
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create workload record
    workload = Workload(
        name=name,
        description=description,
        file_path=file_path,
        file_size=file.size,
        file_type=file.content_type,
        created_by=current_user.id,
    )
    db.add(workload)
    db.commit()
    db.refresh(workload)
    return workload


@router.put("/{workload_id}", response_model=WorkloadSchema)
def update_workload(
    workload_id: int,
    workload_update: WorkloadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workload = db.query(Workload).filter(Workload.id == workload_id).first()
    if workload is None:
        raise HTTPException(status_code=404, detail="Workload not found")

    # Check permissions (only creator or admin can update)
    if workload.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")

    for field, value in workload_update.dict(exclude_unset=True).items():
        setattr(workload, field, value)

    db.commit()
    db.refresh(workload)
    return workload


@router.delete("/{workload_id}")
def delete_workload(
    workload_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workload = db.query(Workload).filter(Workload.id == workload_id).first()
    if workload is None:
        raise HTTPException(status_code=404, detail="Workload not found")

    # Check permissions (only creator or admin can delete)
    if workload.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Delete file
    if os.path.exists(workload.file_path):
        os.remove(workload.file_path)

    db.delete(workload)
    db.commit()
    return {"message": "Workload deleted successfully"}


@router.get("/{workload_id}/download")
def download_workload(
    workload_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workload = db.query(Workload).filter(Workload.id == workload_id).first()
    if workload is None:
        raise HTTPException(status_code=404, detail="Workload not found")

    if not os.path.exists(workload.file_path):
        raise HTTPException(status_code=404, detail="Workload file not found")

    return {
        "file_path": workload.file_path,
        "file_name": os.path.basename(workload.file_path),
    }
