from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from datetime import datetime, timedelta
import csv
import json
import os
from app.core.database import get_db
from app.models.user import User
from app.models.result import Result
from app.models.experiment import Experiment
from app.schemas.result import (
    Result as ResultSchema,
    ResultCreate,
    ResultUpdate,
    ResultWithExperiment,
)
from app.api.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=List[ResultWithExperiment])
def get_results(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    results = db.query(Result).offset(skip).limit(limit).all()
    result_list = []
    for res in results:
        res_dict = ResultWithExperiment.from_orm(res)
        if res.experiment:
            res_dict.experiment_name = res.experiment.name
            if res.experiment.scenario:
                res_dict.scenario_name = res.experiment.scenario.name
            if res.experiment.strategy:
                res_dict.strategy_name = res.experiment.strategy.name
        result_list.append(res_dict)
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

    # Apply date filters if provided
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

    # Get all results for analytics
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

    # Calculate basic statistics
    total_results = len(results)
    total_experiments = len(set(r.experiment_id for r in results))

    # Calculate averages (excluding None values)
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

    # Job statistics
    total_jobs = sum(r.total_jobs or 0 for r in results)
    completed_jobs = sum(r.completed_jobs or 0 for r in results)
    failed_jobs = sum(r.failed_jobs or 0 for r in results)
    success_rate = (completed_jobs / total_jobs * 100) if total_jobs > 0 else 0

    # Results by date
    results_by_date = {}
    for result in results:
        date = result.created_at.strftime("%Y-%m-%d")
        results_by_date[date] = results_by_date.get(date, 0) + 1

    results_by_date_list = [
        {"date": date, "count": count}
        for date, count in sorted(results_by_date.items())
    ]

    # Top strategies (by number of results)
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

    # Top scenarios (by number of results)
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
    # Check if experiment exists
    experiment = (
        db.query(Experiment)
        .filter(Experiment.id == result_create.experiment_id)
        .first()
    )
    if experiment is None:
        raise HTTPException(status_code=404, detail="Experiment not found")

    # Parse result files if they exist
    jobs_data = None
    schedule_data = None
    computed_metrics = None

    if result_create.result_file_path and os.path.exists(
        result_create.result_file_path
    ):
        try:
            # Parse jobs CSV
            jobs_file = os.path.join(result_create.result_file_path, "out_jobs.csv")
            if os.path.exists(jobs_file):
                with open(jobs_file, "r") as f:
                    jobs_data = f.read()

            # Parse schedule CSV
            schedule_file = os.path.join(
                result_create.result_file_path, "out_schedule.csv"
            )
            if os.path.exists(schedule_file):
                with open(schedule_file, "r") as f:
                    schedule_data = f.read()

                # Compute additional metrics from schedule data
                f.seek(0)
                reader = csv.DictReader(f)
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
        except Exception:
            pass

    # Create result record
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
