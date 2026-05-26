from typing import List, Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload, load_only
from sqlalchemy import func, desc
from datetime import datetime, timedelta
import csv
import json
import io
import os
import logging
from app.core.database import get_db
from app.core.list_helpers import apply_sort, set_total_count
from app.models.user import User
from app.models.result import Result
from app.models.experiment import Experiment
from app.schemas.result import (
    Result as ResultSchema,
    ResultCreate,
    ResultUpdate,
    ResultWithExperiment,
    ResultListItem,
    TimelineResponse,
)
from app.api.auth import get_current_user
from app.services.post_processing.timeline import derive_timeline_aggregates

logger = logging.getLogger(__name__)

router = APIRouter()

RESULT_SORT_FIELDS = {"id", "created_at", "makespan", "mean_slowdown", "resource_utilization"}


@router.get("/", response_model=List[ResultListItem])
def get_results(
    response: Response,
    skip: int = 0,
    limit: int = 20,
    sort_by: str = "created_at",
    order: str = "desc",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # load_only: SQL SELECT skips multi-MB CSV blobs (jobs_data, schedule_data, etc).
    # Revert: remove .options(...), change response_model to List[ResultWithExperiment],
    #         and use ResultWithExperiment.from_orm() below.
    base = db.query(Result).options(
        load_only(
            Result.id, Result.experiment_id, Result.simulation_time,
            Result.total_jobs, Result.completed_jobs, Result.failed_jobs,
            Result.makespan, Result.average_waiting_time,
            Result.average_turnaround_time, Result.resource_utilization,
            Result.created_at,
        )
    )
    set_total_count(response, base.count())
    sorted_q = apply_sort(base, Result, sort_by, order, RESULT_SORT_FIELDS)
    results = sorted_q.offset(skip).limit(limit).all()
    result_list = []
    for res in results:
        item = ResultListItem.from_orm(res)
        if res.experiment:
            item.experiment_name = res.experiment.name
            if res.experiment.scenario:
                item.scenario_name = res.experiment.scenario.name
            if res.experiment.strategy:
                item.strategy_name = res.experiment.strategy.name
        result_list.append(item)
    return result_list


@router.get("/analytics")
def get_analytics(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get analytics data for results"""
    query = db.query(Result).options(
        joinedload(Result.experiment).joinedload(Experiment.scenario),
        joinedload(Result.experiment).joinedload(Experiment.strategy),
    )

    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(Result.created_at >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format")

    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(Result.created_at < end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format")

    results = query.all()

    if not results:
        return {
            "total_results": 0,
            "total_experiments": 0,
            "avg_makespan": 0,
            "avg_waiting_time": 0,
            "avg_turnaround_time": 0,
            "avg_resource_utilization": 0,
            "total_jobs": 0,
            "completed_jobs": 0,
            "failed_jobs": 0,
            "success_rate": 0,
            "results_by_date": [],
            "top_strategies": [],
            "top_scenarios": [],
        }

    total_results = len(results)
    total_experiments = len(set(r.experiment_id for r in results))

    makespans = [r.makespan for r in results if r.makespan is not None]
    waiting_times = [
        r.average_waiting_time for r in results if r.average_waiting_time is not None
    ]
    turnaround_times = [
        r.average_turnaround_time
        for r in results
        if r.average_turnaround_time is not None
    ]
    utilizations = [
        r.resource_utilization for r in results if r.resource_utilization is not None
    ]

    avg_makespan = sum(makespans) / len(makespans) if makespans else 0
    avg_waiting_time = sum(waiting_times) / len(waiting_times) if waiting_times else 0
    avg_turnaround_time = (
        sum(turnaround_times) / len(turnaround_times) if turnaround_times else 0
    )
    avg_resource_utilization = (
        sum(utilizations) / len(utilizations) if utilizations else 0
    )

    total_jobs = sum(r.total_jobs or 0 for r in results)
    completed_jobs = sum(r.completed_jobs or 0 for r in results)
    failed_jobs = sum(r.failed_jobs or 0 for r in results)
    success_rate = (completed_jobs / total_jobs * 100) if total_jobs > 0 else 0

    results_by_date = {}
    for result in results:
        date = result.created_at.strftime("%Y-%m-%d")
        results_by_date[date] = results_by_date.get(date, 0) + 1

    results_by_date_list = [
        {"date": date, "count": count}
        for date, count in sorted(results_by_date.items())
    ]

    strategy_counts = {}
    for result in results:
        if result.experiment and result.experiment.strategy:
            strategy_name = result.experiment.strategy.name
            strategy_counts[strategy_name] = strategy_counts.get(strategy_name, 0) + 1

    top_strategies = [
        {"name": name, "count": count}
        for name, count in sorted(
            strategy_counts.items(), key=lambda x: x[1], reverse=True
        )[:5]
    ]

    scenario_counts = {}
    for result in results:
        if result.experiment and result.experiment.scenario:
            scenario_name = result.experiment.scenario.name
            scenario_counts[scenario_name] = scenario_counts.get(scenario_name, 0) + 1

    top_scenarios = [
        {"name": name, "count": count}
        for name, count in sorted(
            scenario_counts.items(), key=lambda x: x[1], reverse=True
        )[:5]
    ]

    return {
        "total_results": total_results,
        "total_experiments": total_experiments,
        "avg_makespan": round(avg_makespan, 2),
        "avg_waiting_time": round(avg_waiting_time, 2),
        "avg_turnaround_time": round(avg_turnaround_time, 2),
        "avg_resource_utilization": round(avg_resource_utilization, 2),
        "total_jobs": total_jobs,
        "completed_jobs": completed_jobs,
        "failed_jobs": failed_jobs,
        "success_rate": round(success_rate, 2),
        "results_by_date": results_by_date_list,
        "top_strategies": top_strategies,
        "top_scenarios": top_scenarios,
    }


# Static path routes MUST come before parameterized /{result_id} routes
@router.get("/compare/metrics")
def compare_experiments(
    ids: str = Query(..., description="Comma-separated experiment IDs"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compare metrics across multiple experiments side by side."""
    try:
        exp_ids = [int(x.strip()) for x in ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid experiment ID format")

    if len(exp_ids) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 experiment IDs")
    if len(exp_ids) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 experiments for comparison")

    comparisons = []
    for eid in exp_ids:
        exp = db.query(Experiment).filter(Experiment.id == eid).first()
        if not exp:
            continue

        result = (
            db.query(Result)
            .filter(Result.experiment_id == eid)
            .order_by(desc(Result.created_at))
            .first()
        )

        entry = {
            "experiment_id": eid,
            "experiment_name": exp.name,
            "scenario_name": exp.scenario.name if exp.scenario else None,
            "strategy_name": exp.strategy.name if exp.strategy else None,
            "status": exp.status.value if hasattr(exp.status, "value") else str(exp.status),
            "seed": exp.seed,
            "has_result": result is not None,
        }

        if result:
            entry.update({
                "makespan": result.makespan,
                "average_waiting_time": result.average_waiting_time,
                "average_turnaround_time": result.average_turnaround_time,
                "resource_utilization": result.resource_utilization,
                "total_jobs": result.total_jobs,
                "completed_jobs": result.completed_jobs,
                "failed_jobs": result.failed_jobs,
                "simulation_time": result.simulation_time,
            })
            if result.computed_metrics:
                try:
                    cm = json.loads(result.computed_metrics)
                    entry["max_waiting_time"] = cm.get("max_waiting_time")
                    entry["max_turnaround_time"] = cm.get("max_turnaround_time")
                    entry["mean_slowdown"] = cm.get("mean_slowdown")
                    entry["max_slowdown"] = cm.get("max_slowdown")
                    entry["success_rate"] = cm.get("success_rate")
                    entry["throughput"] = cm.get("throughput")
                    entry["consumed_joules"] = cm.get("consumed_joules")
                except json.JSONDecodeError:
                    pass

        comparisons.append(entry)

    return {"experiments": comparisons}


# Parameterized routes below
@router.get("/{result_id}", response_model=ResultWithExperiment)
def get_result(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = db.query(Result).filter(Result.id == result_id).first()
    if res is None:
        raise HTTPException(status_code=404, detail="Result not found")
    res_dict = ResultWithExperiment.from_orm(res)
    if res.experiment:
        res_dict.experiment_name = res.experiment.name
        if res.experiment.scenario:
            res_dict.scenario_name = res.experiment.scenario.name
        if res.experiment.strategy:
            res_dict.strategy_name = res.experiment.strategy.name
    return res_dict


@router.post("/", response_model=ResultSchema)
def create_result(
    result_create: ResultCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    experiment = (
        db.query(Experiment)
        .filter(Experiment.id == result_create.experiment_id)
        .first()
    )
    if experiment is None:
        raise HTTPException(status_code=404, detail="Experiment not found")

    jobs_data = None
    schedule_data = None
    computed_metrics = None

    if result_create.result_file_path and os.path.exists(
        result_create.result_file_path
    ):
        try:
            jobs_file = os.path.join(result_create.result_file_path, "out_jobs.csv")
            if os.path.exists(jobs_file):
                with open(jobs_file, "r") as f:
                    jobs_data = f.read()

            schedule_file = os.path.join(
                result_create.result_file_path, "out_schedule.csv"
            )
            if os.path.exists(schedule_file):
                with open(schedule_file, "r") as f:
                    schedule_data = f.read()

                # Parse computed metrics from schedule data string
                reader = csv.DictReader(io.StringIO(schedule_data))
                for row in reader:
                    computed_metrics = {
                        "batsim_version": row.get("batsim_version"),
                        "consumed_joules": float(row.get("consumed_joules", 0)),
                        "nb_jobs": int(row.get("nb_jobs", 0)),
                        "nb_jobs_success": int(row.get("nb_jobs_success", 0)),
                        "nb_jobs_killed": int(row.get("nb_jobs_killed", 0)),
                        "nb_jobs_rejected": int(row.get("nb_jobs_rejected", 0)),
                        "success_rate": float(row.get("success_rate", 0)),
                        "scheduling_time": float(row.get("scheduling_time", 0)),
                        "time_computing": float(row.get("time_computing", 0)),
                        "time_idle": float(row.get("time_idle", 0)),
                        "nb_computing_machines": int(
                            row.get("nb_computing_machines", 0)
                        ),
                    }
                    break
        except Exception as e:
            logger.warning(f"Failed to parse result files: {e}")

    result = Result(
        experiment_id=result_create.experiment_id,
        simulation_time=result_create.simulation_time,
        total_jobs=result_create.total_jobs,
        completed_jobs=result_create.completed_jobs,
        failed_jobs=result_create.failed_jobs,
        makespan=result_create.makespan,
        average_waiting_time=result_create.average_waiting_time,
        average_turnaround_time=result_create.average_turnaround_time,
        resource_utilization=result_create.resource_utilization,
        config=json.dumps(result_create.config) if result_create.config else None,
        metrics=json.dumps(result_create.metrics) if result_create.metrics else None,
        logs=result_create.logs,
        result_file_path=result_create.result_file_path,
        log_file_path=result_create.log_file_path,
        jobs_data=jobs_data,
        schedule_data=schedule_data,
        computed_metrics=json.dumps(computed_metrics) if computed_metrics else None,
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return result


@router.put("/{result_id}", response_model=ResultSchema)
def update_result(
    result_id: int,
    result_update: ResultUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = db.query(Result).filter(Result.id == result_id).first()
    if res is None:
        raise HTTPException(status_code=404, detail="Result not found")
    for field, value in result_update.dict(exclude_unset=True).items():
        setattr(res, field, value)
    db.commit()
    db.refresh(res)
    return res


@router.delete("/{result_id}")
def delete_result(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = db.query(Result).filter(Result.id == result_id).first()
    if res is None:
        raise HTTPException(status_code=404, detail="Result not found")
    db.delete(res)
    db.commit()
    return {"message": "Result deleted successfully"}


@router.get("/{result_id}/timeline", response_model=TimelineResponse)
def get_result_timeline(
    result_id: int,
    limit: Optional[int] = Query(None, ge=1, le=20000, description="Cap jobs list (frontend density mode uses this)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return Gantt-ready jobs + utilization/queue/waiting-CDF series for the Replay tab."""
    result = db.query(Result).filter(Result.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")

    if not result.jobs_data:
        raise HTTPException(status_code=404, detail="Result has no jobs data (out_jobs.csv missing)")

    n_hosts_hint = None
    if result.computed_metrics:
        try:
            cm = json.loads(result.computed_metrics)
            nb_machines = cm.get("nb_computing_machines")
            if isinstance(nb_machines, int) and nb_machines > 0:
                n_hosts_hint = nb_machines
        except json.JSONDecodeError:
            pass

    data = derive_timeline_aggregates(result.jobs_data, n_hosts_hint=n_hosts_hint, limit=limit)
    return TimelineResponse(result_id=result.id, **data)


@router.get("/{result_id}/export")
def export_result(
    result_id: int,
    export_format: str = Query("json", alias="format", description="Export format: json or csv"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export result data as JSON or CSV."""
    if export_format not in ("json", "csv"):
        raise HTTPException(status_code=400, detail="Format must be 'json' or 'csv'")

    result = db.query(Result).filter(Result.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")

    if export_format == "csv":
        if result.jobs_data:
            return Response(
                content=result.jobs_data,
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=experiment_{result.experiment_id}_jobs.csv"},
            )
        raise HTTPException(status_code=404, detail="No jobs data available for export")

    export_data = {
        "experiment_id": result.experiment_id,
        "result_id": result.id,
        "created_at": result.created_at.isoformat() if result.created_at else None,
        "metrics": {
            "makespan": result.makespan,
            "average_waiting_time": result.average_waiting_time,
            "average_turnaround_time": result.average_turnaround_time,
            "resource_utilization": result.resource_utilization,
            "simulation_time": result.simulation_time,
            "total_jobs": result.total_jobs,
            "completed_jobs": result.completed_jobs,
            "failed_jobs": result.failed_jobs,
        },
    }
    if result.computed_metrics:
        try:
            export_data["computed_metrics"] = json.loads(result.computed_metrics)
        except json.JSONDecodeError:
            pass

    return Response(
        content=json.dumps(export_data, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=experiment_{result.experiment_id}_metrics.json"},
    )
