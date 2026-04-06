import json
import os
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.experiment import Experiment
from app.models.result import Result
from app.services.metrics_service import METRIC_VERSION, compute_metrics


PARSER_VERSION = "1.0.0"


def _read_optional_file(path: str) -> Optional[str]:
    if not path or not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as handle:
        return handle.read()


def _candidate_output_paths(experiment: Experiment) -> List[str]:
    candidates = []
    if experiment.simulation_dir:
        candidates.append(os.path.join(experiment.simulation_dir, "output"))
        candidates.append(experiment.simulation_dir)
    return candidates


def _resolve_output_files(experiment: Experiment) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    for base in _candidate_output_paths(experiment):
        jobs_path = os.path.join(base, "out_jobs.csv")
        schedule_path = os.path.join(base, "out_schedule.csv")
        if os.path.exists(jobs_path) or os.path.exists(schedule_path):
            return base, jobs_path if os.path.exists(jobs_path) else None, schedule_path if os.path.exists(schedule_path) else None
    return None, None, None


def ingest_experiment_results(db: Session, experiment: Experiment) -> Result:
    output_dir, jobs_path, schedule_path = _resolve_output_files(experiment)
    warnings: List[str] = []

    if not output_dir:
        raise FileNotFoundError("No BatSim output directory found for this experiment.")

    jobs_csv_text = _read_optional_file(jobs_path) if jobs_path else None
    schedule_csv_text = _read_optional_file(schedule_path) if schedule_path else None

    if not jobs_csv_text:
        warnings.append("Missing out_jobs.csv")
    if not schedule_csv_text:
        warnings.append("Missing out_schedule.csv")

    metrics: Dict[str, Optional[float]] = compute_metrics(jobs_csv_text, schedule_csv_text)
    summary = {
        "experiment_id": experiment.id,
        "run_uuid": experiment.run_uuid,
        "ingested_at": datetime.now(timezone.utc).isoformat(),
        "warnings": warnings,
    }

    result = db.query(Result).filter(Result.experiment_id == experiment.id).first()
    if result is None:
        result = Result(experiment_id=experiment.id)
        db.add(result)

    result.simulation_time = metrics.get("simulation_time")
    result.total_jobs = metrics.get("total_jobs")
    result.completed_jobs = metrics.get("completed_jobs")
    result.failed_jobs = metrics.get("failed_jobs") or 0
    result.makespan = metrics.get("makespan")
    result.average_waiting_time = metrics.get("average_waiting_time")
    result.average_turnaround_time = metrics.get("average_turnaround_time")
    result.resource_utilization = metrics.get("resource_utilization")
    result.metric_json = json.dumps(metrics)
    result.summary_json = json.dumps(summary)
    result.metrics = json.dumps(metrics)
    result.config = experiment.config
    result.raw_output_dir = output_dir
    result.result_file_path = output_dir
    result.jobs_csv_path = jobs_path
    result.schedule_csv_path = schedule_path
    result.jobs_data = jobs_csv_text
    result.schedule_data = schedule_csv_text
    result.computed_metrics = json.dumps(metrics)
    result.parser_version = PARSER_VERSION
    result.metric_version = METRIC_VERSION
    result.parsing_warnings = json.dumps(warnings)
    result.ingested_at = datetime.now(timezone.utc)
    result.logs = experiment.batsim_logs
    result.log_file_path = experiment.stdout_log_path

    db.commit()
    db.refresh(result)
    return result
