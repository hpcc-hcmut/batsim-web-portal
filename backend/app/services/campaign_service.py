import json
import os
import shutil
from collections import Counter
from itertools import product
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.campaign import Campaign
from app.models.experiment import Experiment, ExperimentStatus
from app.models.scenario import Scenario
from app.models.strategy import Strategy
from app.services.experiment_runner import launch_experiment_async, stop_experiment_processes


def _matrix_payload(
    scenario_ids: List[int],
    strategy_ids: List[int],
    seeds: List[int],
    parameter_variants: List[Dict],
) -> Dict:
    return {
        "scenario_ids": scenario_ids,
        "strategy_ids": strategy_ids,
        "seeds": seeds or [1],
        "parameter_variants": parameter_variants or [{}],
    }


def create_campaign_with_runs(
    db: Session,
    *,
    name: str,
    description: Optional[str],
    notes: Optional[str],
    created_by: int,
    scenario_ids: List[int],
    strategy_ids: List[int],
    seeds: List[int],
    parameter_variants: List[Dict],
) -> Campaign:
    scenarios = db.query(Scenario).filter(Scenario.id.in_(scenario_ids)).all()
    strategies = db.query(Strategy).filter(Strategy.id.in_(strategy_ids)).all()
    if len(scenarios) != len(set(scenario_ids)) or len(strategies) != len(set(strategy_ids)):
        raise ValueError("Invalid scenario_ids or strategy_ids in campaign matrix.")

    campaign = Campaign(
        name=name,
        description=description,
        notes=notes,
        status="draft",
        created_by=created_by,
        matrix_definition_json=json.dumps(
            _matrix_payload(scenario_ids, strategy_ids, seeds, parameter_variants)
        ),
    )
    db.add(campaign)
    db.flush()

    scenarios_by_id = {scenario.id: scenario for scenario in scenarios}
    strategies_by_id = {strategy.id: strategy for strategy in strategies}

    for scenario_id, strategy_id, seed, params in product(
        scenario_ids,
        strategy_ids,
        seeds or [1],
        parameter_variants or [{}],
    ):
        scenario = scenarios_by_id[scenario_id]
        strategy = strategies_by_id[strategy_id]
        experiment = Experiment(
            name=(
                f"{campaign.name} | {scenario.name} | {strategy.name} | seed {seed}"
            )[:255],
            description=f"Campaign run for {scenario.name} with {strategy.name}",
            campaign_id=campaign.id,
            scenario_id=scenario_id,
            strategy_id=strategy_id,
            status=ExperimentStatus.PENDING,
            seed=seed,
            config=json.dumps({"seed": seed, "parameters": params}),
            created_by=created_by,
        )
        db.add(experiment)

    db.commit()
    db.refresh(campaign)
    return campaign


def campaign_summary(campaign: Campaign) -> Dict[str, int]:
    statuses = Counter(experiment.status.value for experiment in campaign.experiments)
    total = len(campaign.experiments)
    return {
        "total_runs": total,
        "completed_runs": statuses.get(ExperimentStatus.COMPLETED.value, 0),
        "failed_runs": statuses.get(ExperimentStatus.FAILED.value, 0),
        "running_runs": statuses.get(ExperimentStatus.RUNNING.value, 0)
        + statuses.get(ExperimentStatus.PREPARING.value, 0)
        + statuses.get(ExperimentStatus.PARSING.value, 0)
        + statuses.get(ExperimentStatus.QUEUED.value, 0),
        "pending_runs": statuses.get(ExperimentStatus.PENDING.value, 0),
    }


def update_campaign_status(db: Session, campaign: Campaign) -> None:
    summary = campaign_summary(campaign)
    if summary["running_runs"] > 0:
        campaign.status = "running"
    elif summary["pending_runs"] == summary["total_runs"]:
        campaign.status = "draft"
    elif summary["completed_runs"] == summary["total_runs"] and summary["total_runs"] > 0:
        campaign.status = "completed"
    elif summary["failed_runs"] > 0 and summary["completed_runs"] + summary["failed_runs"] == summary["total_runs"]:
        campaign.status = "completed_with_failures"
    else:
        campaign.status = "partial"
    db.commit()


def start_campaign(db: Session, campaign: Campaign) -> None:
    for experiment in campaign.experiments:
        if experiment.status in {ExperimentStatus.PENDING, ExperimentStatus.FAILED}:
            experiment.status = ExperimentStatus.QUEUED
            experiment.status_detail = "Queued from campaign"
            launch_experiment_async(experiment.id)
    db.commit()
    update_campaign_status(db, campaign)


def retry_failed_campaign_runs(db: Session, campaign: Campaign) -> int:
    retried = 0
    for experiment in campaign.experiments:
        if experiment.status == ExperimentStatus.FAILED:
            experiment.status = ExperimentStatus.QUEUED
            experiment.status_detail = "Retry requested from campaign"
            experiment.failure_reason = None
            experiment.end_time = None
            launch_experiment_async(experiment.id)
            retried += 1
    db.commit()
    update_campaign_status(db, campaign)
    return retried


def stop_campaign(db: Session, campaign: Campaign) -> None:
    for experiment in campaign.experiments:
        if experiment.status in {
            ExperimentStatus.RUNNING,
            ExperimentStatus.PREPARING,
            ExperimentStatus.PARSING,
            ExperimentStatus.QUEUED,
        }:
            stop_experiment_processes(experiment)
            experiment.status = ExperimentStatus.CANCELLED
            experiment.status_detail = "Cancelled from campaign"
    db.commit()
    update_campaign_status(db, campaign)


def export_campaign_bundle(campaign: Campaign) -> str:
    export_root = os.path.join("storage", "campaign_exports")
    os.makedirs(export_root, exist_ok=True)
    bundle_dir = os.path.join(export_root, f"campaign_{campaign.id}")
    os.makedirs(bundle_dir, exist_ok=True)

    manifest_path = os.path.join(bundle_dir, "campaign.json")
    with open(manifest_path, "w", encoding="utf-8") as handle:
        handle.write(
            json.dumps(
                {
                    "id": campaign.id,
                    "name": campaign.name,
                    "status": campaign.status,
                    "matrix_definition_json": campaign.matrix_definition_json,
                },
                indent=2,
            )
        )

    for experiment in campaign.experiments:
        if experiment.simulation_dir and os.path.isdir(experiment.simulation_dir):
            destination = os.path.join(bundle_dir, experiment.run_uuid or f"exp_{experiment.id}")
            if os.path.exists(destination):
                shutil.rmtree(destination)
            shutil.copytree(experiment.simulation_dir, destination)

    return shutil.make_archive(bundle_dir, "zip", bundle_dir)
