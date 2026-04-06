import json

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.core.database import get_db
from app.models.campaign import Campaign
from app.models.experiment import Experiment
from app.models.user import User
from app.schemas.campaign import Campaign as CampaignSchema, CampaignCreate, CampaignWithSummary
from app.schemas.experiment import ExperimentWithDetails
from app.services.campaign_service import (
    campaign_summary,
    create_campaign_with_runs,
    export_campaign_bundle,
    retry_failed_campaign_runs,
    start_campaign,
    stop_campaign,
    update_campaign_status,
)

router = APIRouter()


def _campaign_payload(campaign: Campaign) -> CampaignWithSummary:
    payload = CampaignWithSummary.from_orm(campaign)
    for key, value in campaign_summary(campaign).items():
        setattr(payload, key, value)
    return payload


@router.get("/", response_model=List[CampaignWithSummary])
def get_campaigns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaigns = db.query(Campaign).all()
    return [_campaign_payload(campaign) for campaign in campaigns]


@router.get("/{campaign_id}", response_model=CampaignWithSummary)
def get_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    update_campaign_status(db, campaign)
    db.refresh(campaign)
    return _campaign_payload(campaign)


@router.post("/", response_model=CampaignSchema)
def create_campaign(
    payload: CampaignCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        campaign = create_campaign_with_runs(
            db,
            name=payload.name,
            description=payload.description,
            notes=payload.notes,
            created_by=current_user.id,
            scenario_ids=payload.scenario_ids,
            strategy_ids=payload.strategy_ids,
            seeds=payload.seeds,
            parameter_variants=payload.parameter_variants,
        )
        return campaign
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/{campaign_id}/experiments", response_model=List[ExperimentWithDetails])
def get_campaign_experiments(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    experiments = db.query(Experiment).filter(Experiment.campaign_id == campaign_id).all()
    items = []
    for experiment in experiments:
        payload = ExperimentWithDetails.from_orm(experiment)
        payload.scenario_name = experiment.scenario.name if experiment.scenario else None
        payload.strategy_name = experiment.strategy.name if experiment.strategy else None
        payload.creator_username = experiment.creator.username if experiment.creator else None
        items.append(payload)
    return items


@router.post("/{campaign_id}/start")
def start_campaign_runs(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    start_campaign(db, campaign)
    return {"message": "Campaign started"}


@router.post("/{campaign_id}/stop")
def stop_campaign_runs(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    stop_campaign(db, campaign)
    return {"message": "Campaign stopped"}


@router.post("/{campaign_id}/retry-failed")
def retry_failed_runs(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    retried = retry_failed_campaign_runs(db, campaign)
    return {"message": "Retry requested", "retried": retried}


@router.get("/{campaign_id}/export")
def export_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    archive_path = export_campaign_bundle(campaign)
    return FileResponse(
        archive_path,
        media_type="application/zip",
        filename=f"campaign-{campaign.id}.zip",
    )
