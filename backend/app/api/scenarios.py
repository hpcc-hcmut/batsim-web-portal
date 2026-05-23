from typing import List
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.list_helpers import apply_sort, set_total_count
from app.models.user import User
from app.models.scenario import Scenario
from app.models.workload import Workload
from app.models.platform import Platform
from app.schemas.scenario import (
    Scenario as ScenarioSchema,
    ScenarioCreate,
    ScenarioUpdate,
    ScenarioWithDetails,
)
from app.api.auth import get_current_user

router = APIRouter()

SCENARIO_SORT_FIELDS = {"id", "name", "created_at", "updated_at"}


@router.get("/", response_model=List[ScenarioWithDetails])
def get_scenarios(
    response: Response,
    skip: int = 0,
    limit: int = 20,
    sort_by: str = "created_at",
    order: str = "desc",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base = db.query(Scenario)
    set_total_count(response, base.count())
    sorted_q = apply_sort(base, Scenario, sort_by, order, SCENARIO_SORT_FIELDS)
    scenarios = sorted_q.offset(skip).limit(limit).all()
    return [_enrich_scenario(s) for s in scenarios]


def _enrich_scenario(scenario: Scenario) -> ScenarioWithDetails:
    """Add related names and versions to scenario response."""
    d = ScenarioWithDetails.from_orm(scenario)
    if scenario.workload:
        d.workload_name = scenario.workload.name
        d.workload_version = getattr(scenario.workload, "version", None) or 1
    if scenario.platform:
        d.platform_name = scenario.platform.name
        d.platform_version = getattr(scenario.platform, "version", None) or 1
    if scenario.creator:
        d.creator_username = scenario.creator.username
    return d


@router.get("/{scenario_id}", response_model=ScenarioWithDetails)
def get_scenario(
    scenario_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return _enrich_scenario(scenario)


@router.post("/", response_model=ScenarioSchema)
def create_scenario(
    scenario_create: ScenarioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check if workload and platform exist
    workload = (
        db.query(Workload).filter(Workload.id == scenario_create.workload_id).first()
    )
    platform = (
        db.query(Platform).filter(Platform.id == scenario_create.platform_id).first()
    )
    if not workload or not platform:
        raise HTTPException(status_code=400, detail="Invalid workload or platform")
    scenario = Scenario(
        name=scenario_create.name,
        description=scenario_create.description,
        workload_id=scenario_create.workload_id,
        platform_id=scenario_create.platform_id,
        created_by=current_user.id,
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario


@router.put("/{scenario_id}", response_model=ScenarioSchema)
def update_scenario(
    scenario_id: int,
    scenario_update: ScenarioUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    # Check permissions (only creator or admin can update)
    if scenario.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    for field, value in scenario_update.dict(exclude_unset=True).items():
        setattr(scenario, field, value)
    db.commit()
    db.refresh(scenario)
    return scenario


@router.delete("/{scenario_id}")
def delete_scenario(
    scenario_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    # Check permissions (only creator or admin can delete)
    if scenario.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    db.delete(scenario)
    db.commit()
    return {"message": "Scenario deleted successfully"}
