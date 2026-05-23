from typing import List
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File, Form
from sqlalchemy.orm import Session
import os
import shutil
from app.core.database import get_db
from app.core.config import settings
from app.core.list_helpers import apply_sort, set_total_count
from app.models.user import User
from app.models.workload import Workload
from app.schemas.workload import (
    Workload as WorkloadSchema,
    WorkloadUpdate,
    WorkloadWithCreator,
)
from app.api.auth import get_current_user
from app.services.validators import validate_workload
from app.services.file_utils import sanitize_filename, safe_file_path
import json

router = APIRouter()

STORAGE_DIR = os.path.join(settings.STORAGE_PATH, "workloads")

WORKLOAD_SORT_FIELDS = {"id", "name", "created_at", "updated_at", "file_size"}


def ensure_storage_directory():
    os.makedirs(STORAGE_DIR, exist_ok=True)


def _parse_and_validate_workload(file_path: str, filename: str):
    """Validate workload file and extract metadata. Returns (result, data)."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    result = validate_workload(content)
    data = result.metadata.get("_parsed_data")
    return result, data


@router.get("/", response_model=List[WorkloadWithCreator])
def get_workloads(
    response: Response,
    skip: int = 0,
    limit: int = 20,
    sort_by: str = "created_at",
    order: str = "desc",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base = db.query(Workload)
    set_total_count(response, base.count())
    sorted_q = apply_sort(base, Workload, sort_by, order, WORKLOAD_SORT_FIELDS)
    workloads = sorted_q.offset(skip).limit(limit).all()
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

    # Check duplicate name
    if db.query(Workload).filter(Workload.name == name).first():
        raise HTTPException(status_code=400, detail="Workload with this name already exists")

    # Check file extension
    if not (file.content_type == "application/json" or file.filename.endswith(".json")):
        raise HTTPException(status_code=422, detail={
            "valid": False,
            "errors": [{"field": "file", "error": "Workload must be a JSON file (.json)",
                        "suggestion": "Upload a BatSim JSON workload file"}],
            "warnings": [],
        })

    # Save file (sanitize filename to prevent path traversal)
    safe_name = sanitize_filename(f"{name}_{file.filename}")
    file_path = safe_file_path(STORAGE_DIR, safe_name)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Validate content
    try:
        validation, data = _parse_and_validate_workload(file_path, file.filename)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=422, detail={
            "valid": False,
            "errors": [{"field": "file", "error": f"Failed to read file: {e}", "suggestion": ""}],
            "warnings": [],
        })

    if not validation.valid:
        os.remove(file_path)
        raise HTTPException(status_code=422, detail=validation.to_dict())

    # Create record with extracted metadata
    workload = Workload(
        name=name,
        description=description,
        file_path=file_path,
        file_size=file.size,
        file_type=file.content_type,
        created_by=current_user.id,
        nb_res=data.get("nb_res") if data else None,
        jobs=json.dumps(data.get("jobs")) if data and data.get("jobs") else None,
        profiles=json.dumps(data.get("profiles")) if data and data.get("profiles") else None,
        version=1,
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

    if workload.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")

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


@router.put("/{workload_id}/file", response_model=WorkloadSchema)
async def update_workload_file(
    workload_id: int,
    name: str = Form(None),
    description: str = Form(None),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workload = db.query(Workload).filter(Workload.id == workload_id).first()
    if workload is None:
        raise HTTPException(status_code=404, detail="Workload not found")

    if workload.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")

    if name is not None:
        workload.name = name
    if description is not None:
        workload.description = description

    if file is not None:
        ensure_storage_directory()
        # Save new file first (sanitize filename)
        safe_name = sanitize_filename(f"{workload.name}_{file.filename}")
        new_path = safe_file_path(STORAGE_DIR, safe_name)
        with open(new_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Validate if JSON
        if file.content_type == "application/json" or file.filename.endswith(".json"):
            try:
                validation, data = _parse_and_validate_workload(new_path, file.filename)
            except Exception:
                os.remove(new_path)
                raise HTTPException(status_code=422, detail={
                    "valid": False,
                    "errors": [{"field": "file", "error": "Failed to read file", "suggestion": ""}],
                    "warnings": [],
                })

            if not validation.valid:
                os.remove(new_path)
                raise HTTPException(status_code=422, detail=validation.to_dict())

            workload.nb_res = data.get("nb_res") if data else None
            workload.jobs = json.dumps(data.get("jobs")) if data and data.get("jobs") else None
            workload.profiles = json.dumps(data.get("profiles")) if data and data.get("profiles") else None

        # Remove old file and update record
        if workload.file_path and os.path.exists(workload.file_path):
            os.remove(workload.file_path)
        workload.file_path = new_path
        workload.file_size = file.size
        workload.file_type = file.content_type
        workload.version = (workload.version or 0) + 1

    db.commit()
    db.refresh(workload)
    return workload
