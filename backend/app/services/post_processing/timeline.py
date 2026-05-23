"""Derive Gantt + utilization + queue + waiting-CDF aggregates from BatSim's out_jobs.csv.

Kept separate from `result_processor.py` (which owns ingest into Result records) so the
Replay-tab endpoint can be reasoned about, tested, and evolved independently. Public entry:
`derive_timeline_aggregates(jobs_csv, n_hosts_hint, limit)`.
"""
import csv
import io
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


def _parse_allocated_resources(raw: str | None) -> List[int]:
    """BatSim 'allocated_resources' column is space-separated host ids, e.g. '0 1 2 3'.

    Also handles range syntax 'a-b' produced by some BatSim versions. Negative tokens
    are rejected. Returns [] on missing/invalid input — caller treats as unallocated.
    """
    if not raw:
        return []
    out: List[int] = []
    for tok in raw.strip().split():
        tok = tok.strip()
        if not tok:
            continue
        if "-" in tok and not tok.startswith("-"):
            try:
                lo, hi = tok.split("-", 1)
                lo_i, hi_i = int(lo), int(hi)
                if lo_i < 0 or hi_i < 0:
                    continue
                out.extend(range(lo_i, hi_i + 1))
            except (ValueError, TypeError):
                continue
        else:
            try:
                v = int(tok)
                if v < 0:
                    continue
                out.append(v)
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


def _row_to_timeline_job(row: Dict[str, str], row_index: int = 0) -> Dict[str, Any]:
    """Convert one out_jobs.csv row into the TimelineJob schema dict.

    Logs a warning (once per call) if submission_time is missing — that column is
    required by BatSim's csv format and its absence usually signals corruption.
    """
    sub_raw = row.get("submission_time")
    submission_time = _safe_float(sub_raw)
    if submission_time is None:
        logger.warning(
            "out_jobs.csv row %d missing submission_time (raw=%r); defaulting to 0.0",
            row_index, sub_raw,
        )
        submission_time = 0.0

    starting_time = _safe_float(row.get("starting_time"))
    finish_time = _safe_float(row.get("finish_time"))
    waiting_time = _safe_float(row.get("waiting_time"))
    execution_time = _safe_float(row.get("execution_time"))
    turnaround_time = _safe_float(row.get("turnaround_time"))
    requested_nres = _safe_float(row.get("requested_number_of_resources")) or 0.0
    slowdown = _safe_float(row.get("stretch"))
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
    """Sweep through start/finish/submit events to derive 2 time series.

    Tie-break order at the same timestamp: finish → start → submit. This is the only
    correct order — release resources before claiming them at the same instant; submit
    counts move queue depth without touching resources.

    utilization_series: ratio busy resources / n_hosts at each event timestamp.
    queue_series: number of jobs submitted-but-not-yet-started at each event timestamp.
    """
    if not timeline_jobs or n_hosts <= 0:
        return [], []

    events: List[Tuple[float, str, int]] = []
    for j in timeline_jobs:
        events.append((j["submission_time"], "submit", 0))
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

        if last_t is None or t != last_t:
            util_series.append({"t": t, "value": round(running_resources / n_hosts, 6)})
            queue_series.append({"t": t, "value": float(max(0, submitted - started))})
            last_t = t
        else:
            util_series[-1] = {"t": t, "value": round(running_resources / n_hosts, 6)}
            queue_series[-1] = {"t": t, "value": float(max(0, submitted - started))}

    return util_series, queue_series


def _build_waiting_cdf(timeline_jobs: List[Dict[str, Any]]) -> List[Dict[str, float]]:
    """CDF over waiting_time. x = waiting time (s), y = fraction of jobs <= x.

    Leading (0, 0) sample is included so the chart line starts at origin. If every job
    waited >0 the curve correctly steps up at the first observed value.
    """
    waits = [j["waiting_time"] for j in timeline_jobs if j["waiting_time"] is not None]
    if not waits:
        return []
    waits.sort()
    n = len(waits)
    cdf: List[Dict[str, float]] = [{"t": 0.0, "value": 0.0}]
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
        n_hosts_hint: number of hosts in the platform (denominator for utilization);
                      falls back to max allocated id + 1 when not supplied.
        limit: cap jobs list (for >5k-job density mode); aggregates still computed
               over the full set, so line charts show the complete picture.

    Returns dict matching TimelineResponse schema (minus result_id).
    """
    reader = csv.DictReader(io.StringIO(jobs_csv))
    timeline_jobs: List[Dict[str, Any]] = [
        _row_to_timeline_job(row, idx) for idx, row in enumerate(reader)
    ]

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

    n_hosts = n_hosts_hint or 0
    if not n_hosts:
        max_host = 0
        for j in timeline_jobs:
            for h in j["allocated_resources"]:
                if h > max_host:
                    max_host = h
        n_hosts = max_host + 1 if max_host > 0 else 1
        if n_hosts == 1:
            logger.warning(
                "derive_timeline_aggregates: no n_hosts_hint and no allocated resources "
                "found; falling back to n_hosts=1. Timeline visualization may render flat."
            )

    finishes = [j["finish_time"] for j in timeline_jobs if j["finish_time"] is not None]
    submits = [j["submission_time"] for j in timeline_jobs]
    makespan = max(finishes) - min(submits) if finishes else 0.0

    util_series, queue_series = _build_utilization_and_queue_series(timeline_jobs, n_hosts)
    cdf = _build_waiting_cdf(timeline_jobs)

    total_jobs = len(timeline_jobs)
    truncated = False
    if limit and limit > 0 and total_jobs > limit:
        # Density mode: keep the first `limit` jobs by submission order for the Gantt bars.
        # Aggregates above already cover the full set, so charts stay accurate.
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
