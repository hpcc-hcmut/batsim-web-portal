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
from typing import Any, Dict, List, Optional, Tuple

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


def _parse_allocated_resources(raw: str | None) -> List[int]:
    """BatSim 'allocated_resources' column is space-separated host ids, e.g. '0 1 2 3'.

    Also handles range syntax 'a-b' produced by some BatSim versions. Returns []
    on missing/invalid input — caller treats as unallocated.
    """
    if not raw:
        return []
    out: List[int] = []
    for tok in raw.strip().split():
        tok = tok.strip()
        if not tok:
            continue
        if "-" in tok:
            try:
                lo, hi = tok.split("-", 1)
                out.extend(range(int(lo), int(hi) + 1))
            except (ValueError, TypeError):
                continue
        else:
            try:
                out.append(int(tok))
            except (ValueError, TypeError):
                continue
    return out


def _safe_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _row_to_timeline_job(row: Dict[str, str]) -> Dict[str, Any]:
    """Convert one out_jobs.csv row into the TimelineJob schema dict."""
    submission_time = _safe_float(row.get("submission_time")) or 0.0
    starting_time = _safe_float(row.get("starting_time"))
    finish_time = _safe_float(row.get("finish_time"))
    waiting_time = _safe_float(row.get("waiting_time"))
    execution_time = _safe_float(row.get("execution_time"))
    turnaround_time = _safe_float(row.get("turnaround_time"))
    requested_nres = _safe_float(row.get("requested_number_of_resources")) or 0.0
    slowdown_raw = row.get("stretch")
    slowdown = _safe_float(slowdown_raw)
    if slowdown is None and turnaround_time and execution_time and execution_time > 0:
        slowdown = round(turnaround_time / execution_time, 4)

    success_raw = row.get("success", "0")
    success = success_raw == "1" or success_raw == 1

    return {
        "job_id": row.get("job_id") or row.get("workload_name") or "",
        "submission_time": submission_time,
        "starting_time": starting_time,
        "finish_time": finish_time,
        "waiting_time": waiting_time,
        "execution_time": execution_time,
        "turnaround_time": turnaround_time,
        "slowdown": slowdown,
        "requested_resources": int(requested_nres),
        "allocated_resources": _parse_allocated_resources(row.get("allocated_resources")),
        "success": bool(success),
        "final_state": row.get("final_state"),
    }


def _build_utilization_and_queue_series(
    timeline_jobs: List[Dict[str, Any]],
    n_hosts: int,
) -> Tuple[List[Dict[str, float]], List[Dict[str, float]]]:
    """Sweep through start/finish/submission/dispatch events to derive 2 time series.

    utilization_series: ratio busy resources / n_hosts at each event timestamp.
    queue_series: number of jobs submitted-but-not-yet-started at each event timestamp.
    Both share the same x-axis (time) so frontend can plot them stacked beneath Gantt.
    """
    if not timeline_jobs or n_hosts <= 0:
        return [], []

    events: List[Tuple[float, str, int]] = []
    for j in timeline_jobs:
        sub_t = j["submission_time"]
        events.append((sub_t, "submit", 0))
        start_t = j["starting_time"]
        finish_t = j["finish_time"]
        n_alloc = len(j["allocated_resources"]) or j["requested_resources"]
        if start_t is not None:
            events.append((start_t, "start", n_alloc))
        if finish_t is not None:
            events.append((finish_t, "finish", n_alloc))

    events.sort(key=lambda e: (e[0], 0 if e[1] == "finish" else (1 if e[1] == "start" else 2)))

    util_series: List[Dict[str, float]] = []
    queue_series: List[Dict[str, float]] = []
    running_resources = 0
    submitted = 0
    started = 0

    last_t = None
    for t, kind, payload in events:
        if kind == "submit":
            submitted += 1
        elif kind == "start":
            started += 1
            running_resources += payload
        elif kind == "finish":
            running_resources = max(0, running_resources - payload)

        # Emit one sample per distinct timestamp (avoid duplicates)
        if last_t is None or t != last_t:
            util_series.append({"t": t, "value": round(running_resources / n_hosts, 6)})
            queue_series.append({"t": t, "value": float(max(0, submitted - started))})
            last_t = t
        else:
            util_series[-1] = {"t": t, "value": round(running_resources / n_hosts, 6)}
            queue_series[-1] = {"t": t, "value": float(max(0, submitted - started))}

    return util_series, queue_series


def _build_waiting_cdf(timeline_jobs: List[Dict[str, Any]]) -> List[Dict[str, float]]:
    """CDF over waiting_time for completed jobs. x = waiting time (s), y = % jobs <= x."""
    waits = [j["waiting_time"] for j in timeline_jobs if j["waiting_time"] is not None]
    if not waits:
        return []
    waits.sort()
    n = len(waits)
    cdf: List[Dict[str, float]] = []
    # Include leading (0, 0) so chart starts at origin
    cdf.append({"t": 0.0, "value": 0.0})
    for i, w in enumerate(waits, start=1):
        cdf.append({"t": float(w), "value": round(i / n, 6)})
    return cdf


def derive_timeline_aggregates(
    jobs_csv: str,
    n_hosts_hint: Optional[int] = None,
    limit: Optional[int] = None,
) -> Dict[str, Any]:
    """Parse out_jobs.csv into TimelineResponse-ready dict.

    Args:
        jobs_csv: raw CSV string (BatSim out_jobs.csv contents).
        n_hosts_hint: number of hosts in the platform (used as denominator for utilization);
                      falls back to max allocated id + 1 when not supplied.
        limit: cap jobs list (for >5k workloads, frontend switches to density mode);
               aggregates still computed over the full set.

    Returns dict matching TimelineResponse schema (minus result_id).
    """
    reader = csv.DictReader(io.StringIO(jobs_csv))
    timeline_jobs: List[Dict[str, Any]] = [_row_to_timeline_job(row) for row in reader]

    if not timeline_jobs:
        return {
            "total_jobs": 0,
            "n_hosts": n_hosts_hint or 0,
            "makespan": 0.0,
            "truncated": False,
            "jobs": [],
            "utilization_series": [],
            "queue_series": [],
            "waiting_cdf": [],
        }

    # n_hosts derived from data when hint missing
    n_hosts = n_hosts_hint or 0
    if not n_hosts:
        max_host = 0
        for j in timeline_jobs:
            for h in j["allocated_resources"]:
                if h > max_host:
                    max_host = h
        n_hosts = max_host + 1 if max_host > 0 else 1

    finishes = [j["finish_time"] for j in timeline_jobs if j["finish_time"] is not None]
    submits = [j["submission_time"] for j in timeline_jobs]
    makespan = max(finishes) - min(submits) if finishes else 0.0

    util_series, queue_series = _build_utilization_and_queue_series(timeline_jobs, n_hosts)
    cdf = _build_waiting_cdf(timeline_jobs)

    total_jobs = len(timeline_jobs)
    truncated = False
    if limit and limit > 0 and total_jobs > limit:
        timeline_jobs = timeline_jobs[:limit]
        truncated = True

    return {
        "total_jobs": total_jobs,
        "n_hosts": n_hosts,
        "makespan": round(makespan, 4),
        "truncated": truncated,
        "jobs": timeline_jobs,
        "utilization_series": util_series,
        "queue_series": queue_series,
        "waiting_cdf": cdf,
    }
