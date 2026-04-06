import csv
import io
import statistics
from typing import Dict, List, Optional


METRIC_VERSION = "1.0.0"


def _to_float(value: Optional[str]) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_int(value: Optional[str]) -> Optional[int]:
    if value in (None, ""):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _load_csv_rows(csv_text: Optional[str]) -> List[Dict[str, str]]:
    if not csv_text:
        return []
    return list(csv.DictReader(io.StringIO(csv_text)))


def compute_metrics(
    jobs_csv_text: Optional[str], schedule_csv_text: Optional[str]
) -> Dict[str, Optional[float]]:
    jobs_rows = _load_csv_rows(jobs_csv_text)
    schedule_rows = _load_csv_rows(schedule_csv_text)
    schedule_summary = schedule_rows[0] if schedule_rows else {}

    total_jobs = len(jobs_rows) or _to_int(schedule_summary.get("nb_jobs")) or 0
    completed_jobs = (
        sum(
            1
            for row in jobs_rows
            if str(row.get("success", "")).lower() in {"1", "true", "yes"}
            or str(row.get("final_state", "")).lower() in {"completed", "success"}
        )
        or _to_int(schedule_summary.get("nb_jobs_success"))
        or _to_int(schedule_summary.get("nb_jobs_finished"))
        or 0
    )
    failed_jobs = max(total_jobs - completed_jobs, 0)

    waiting_times = []
    turnaround_times = []
    slowdown_values = []
    for row in jobs_rows:
        submit_time = _to_float(row.get("submission_time") or row.get("submit_time"))
        start_time = _to_float(row.get("starting_time") or row.get("start_time"))
        finish_time = _to_float(row.get("finish_time") or row.get("completion_time"))
        requested_time = _to_float(
            row.get("requested_time") or row.get("execution_time") or row.get("walltime")
        )

        if submit_time is not None and start_time is not None:
            waiting_times.append(max(start_time - submit_time, 0.0))
        if submit_time is not None and finish_time is not None:
            turnaround = max(finish_time - submit_time, 0.0)
            turnaround_times.append(turnaround)
            if requested_time and requested_time > 0:
                slowdown_values.append(max(turnaround / requested_time, 1.0))

    makespan = _to_float(schedule_summary.get("makespan"))
    if makespan is None and jobs_rows:
        finishes = [
            _to_float(row.get("finish_time") or row.get("completion_time"))
            for row in jobs_rows
        ]
        submits = [
            _to_float(row.get("submission_time") or row.get("submit_time"))
            for row in jobs_rows
        ]
        finishes = [value for value in finishes if value is not None]
        submits = [value for value in submits if value is not None]
        if finishes and submits:
            makespan = max(finishes) - min(submits)

    resource_utilization = None
    time_computing = _to_float(schedule_summary.get("time_computing"))
    nb_machines = _to_float(schedule_summary.get("nb_computing_machines"))
    if makespan and nb_machines and makespan > 0 and nb_machines > 0 and time_computing is not None:
        resource_utilization = time_computing / (makespan * nb_machines)
    elif _to_float(schedule_summary.get("resource_utilization")) is not None:
        resource_utilization = _to_float(schedule_summary.get("resource_utilization"))

    success_rate = completed_jobs / total_jobs if total_jobs else 0.0

    return {
        "metric_version": METRIC_VERSION,
        "total_jobs": total_jobs,
        "completed_jobs": completed_jobs,
        "failed_jobs": failed_jobs,
        "success_rate": success_rate,
        "makespan": makespan,
        "average_waiting_time": (
            sum(waiting_times) / len(waiting_times)
            if waiting_times
            else _to_float(schedule_summary.get("mean_waiting_time"))
        ),
        "median_waiting_time": (
            statistics.median(waiting_times) if waiting_times else None
        ),
        "average_turnaround_time": (
            sum(turnaround_times) / len(turnaround_times)
            if turnaround_times
            else _to_float(schedule_summary.get("mean_turnaround_time"))
        ),
        "resource_utilization": resource_utilization,
        "scheduling_time_overhead": _to_float(schedule_summary.get("scheduling_time")),
        "bounded_slowdown": (
            sum(slowdown_values) / len(slowdown_values) if slowdown_values else None
        ),
        "simulation_time": _to_float(schedule_summary.get("simulation_time")),
        "batsim_version": schedule_summary.get("batsim_version"),
        "consumed_joules": _to_float(schedule_summary.get("consumed_joules")),
        "nb_computing_machines": _to_int(schedule_summary.get("nb_computing_machines")),
    }
