"""Parse BatSim output files and create Result records with computed metrics.

BatSim produces:
- out_jobs.csv: per-job data (timing, resources, status)
- out_schedule.csv: single-row summary with pre-computed metrics
"""

import csv
import io
import json
import logging
import os

from sqlalchemy.orm import Session

from app.models.result import Result

logger = logging.getLogger(__name__)


def process_experiment_results(db: Session, experiment_id: int, exp_dir: str) -> Result | None:
    """Parse BatSim output and create a Result record.

    Args:
        db: Database session
        experiment_id: Experiment ID
        exp_dir: Path to experiment directory containing output files

    Returns:
        Created Result object, or None if output files missing
    """
    jobs_csv_path = os.path.join(exp_dir, "out_jobs.csv")
    schedule_csv_path = os.path.join(exp_dir, "out_schedule.csv")

    if not os.path.exists(jobs_csv_path):
        logger.warning(f"[Exp {experiment_id}] No out_jobs.csv found, skipping post-processing")
        return None

    # Parse job-level data
    jobs_data, job_metrics = _parse_jobs_csv(jobs_csv_path)

    # Parse schedule summary (BatSim pre-computes most metrics here)
    schedule_data, schedule_metrics = _parse_schedule_csv(schedule_csv_path)

    # Merge metrics — schedule_metrics are authoritative (from BatSim), job_metrics fill gaps
    metrics = {**job_metrics, **schedule_metrics}

    # Compute resource utilization if BatSim didn't provide it
    if "resource_utilization" not in metrics and metrics.get("makespan", 0) > 0:
        nb_machines = metrics.get("nb_computing_machines", 1)
        time_computing = metrics.get("time_computing", 0)
        makespan = metrics["makespan"]
        if nb_machines > 0 and makespan > 0:
            metrics["resource_utilization"] = round(
                time_computing / (makespan * nb_machines), 4
            )

    # Create Result record
    result = Result(
        experiment_id=experiment_id,
        simulation_time=metrics.get("simulation_time"),
        total_jobs=metrics.get("nb_jobs", metrics.get("total_jobs", 0)),
        completed_jobs=metrics.get("nb_jobs_success", metrics.get("completed_jobs", 0)),
        failed_jobs=metrics.get("nb_jobs_killed", 0) + metrics.get("nb_jobs_rejected", 0),
        makespan=metrics.get("makespan"),
        average_waiting_time=metrics.get("mean_waiting_time"),
        average_turnaround_time=metrics.get("mean_turnaround_time"),
        resource_utilization=metrics.get("resource_utilization"),
        result_file_path=exp_dir,
        log_file_path=exp_dir,
        jobs_data=jobs_data,
        schedule_data=schedule_data,
        computed_metrics=json.dumps(metrics),
    )

    try:
        db.add(result)
        db.commit()
        db.refresh(result)
    except Exception as e:
        db.rollback()
        logger.error(f"[Exp {experiment_id}] Failed to save result: {e}")
        return None

    logger.info(
        f"[Exp {experiment_id}] Result #{result.id} created — "
        f"makespan={metrics.get('makespan')}, jobs={metrics.get('nb_jobs')}"
    )
    return result


def _parse_jobs_csv(path: str) -> tuple[str, dict]:
    """Parse out_jobs.csv and extract job-level metrics.

    Returns (raw_csv_content, computed_metrics_dict).
    """
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

        reader = csv.DictReader(io.StringIO(content))
        rows = list(reader)

        if not rows:
            return content, {"total_jobs": 0}

        metrics = {"total_jobs": len(rows)}

        # Extract numeric columns safely
        def safe_floats(key):
            vals = []
            for r in rows:
                raw = r.get(key)
                if raw is None or raw == "":
                    continue
                try:
                    vals.append(float(raw))
                except (ValueError, TypeError):
                    pass
            return vals

        waiting_times = safe_floats("waiting_time")
        turnaround_times = safe_floats("turnaround_time")
        finish_times = safe_floats("finish_time")
        submission_times = safe_floats("submission_time")
        execution_times = safe_floats("execution_time")

        if waiting_times:
            metrics["mean_waiting_time_jobs"] = round(sum(waiting_times) / len(waiting_times), 4)
            metrics["max_waiting_time_jobs"] = max(waiting_times)

        if turnaround_times:
            metrics["mean_turnaround_time_jobs"] = round(sum(turnaround_times) / len(turnaround_times), 4)
            metrics["max_turnaround_time_jobs"] = max(turnaround_times)

        if finish_times and submission_times:
            metrics["makespan_jobs"] = max(finish_times) - min(submission_times)

        # Slowdown: turnaround_time / execution_time (only for completed jobs)
        slowdowns = []
        for tt, et in zip(turnaround_times, execution_times):
            if et > 0:
                slowdowns.append(tt / et)
        if slowdowns:
            metrics["mean_slowdown_jobs"] = round(sum(slowdowns) / len(slowdowns), 4)

        # Throughput
        if metrics.get("makespan_jobs", 0) > 0:
            metrics["throughput"] = round(len(rows) / metrics["makespan_jobs"], 6)

        # Count successes/failures
        success_count = sum(1 for r in rows if r.get("success") == "1")
        metrics["completed_jobs"] = success_count
        metrics["failed_jobs_count"] = len(rows) - success_count

        return content, metrics

    except Exception as e:
        logger.warning(f"Failed to parse jobs CSV: {e}")
        return "", {"total_jobs": 0}


def _parse_schedule_csv(path: str) -> tuple[str, dict]:
    """Parse out_schedule.csv — single-row summary from BatSim.

    Returns (raw_csv_content, metrics_dict).
    """
    if not os.path.exists(path):
        return "", {}

    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

        reader = csv.DictReader(io.StringIO(content))
        rows = list(reader)

        if not rows:
            return content, {}

        row = rows[0]
        metrics = {}

        # Map BatSim column names to our metric names
        float_fields = [
            "makespan", "mean_waiting_time", "max_waiting_time",
            "mean_turnaround_time", "max_turnaround_time",
            "mean_slowdown", "max_slowdown",
            "simulation_time", "scheduling_time",
            "consumed_joules", "success_rate",
            "time_computing", "time_idle", "time_sleeping",
            "time_switching_off", "time_switching_on", "time_unavailable",
        ]
        int_fields = [
            "nb_computing_machines", "nb_jobs", "nb_jobs_finished",
            "nb_jobs_killed", "nb_jobs_rejected", "nb_jobs_success",
            "nb_machine_switches", "nb_grouped_switches",
        ]

        for field in float_fields:
            if field in row:
                try:
                    metrics[field] = round(float(row[field]), 6)
                except (ValueError, TypeError):
                    pass

        for field in int_fields:
            if field in row:
                try:
                    metrics[field] = int(float(row[field]))
                except (ValueError, TypeError):
                    pass

        # Resource utilization from schedule data
        makespan = metrics.get("makespan", 0)
        nb_machines = metrics.get("nb_computing_machines", 0)
        time_computing = metrics.get("time_computing", 0)
        if makespan > 0 and nb_machines > 0:
            metrics["resource_utilization"] = round(
                time_computing / (makespan * nb_machines), 4
            )

        return content, metrics

    except Exception as e:
        logger.warning(f"Failed to parse schedule CSV: {e}")
        return "", {}
