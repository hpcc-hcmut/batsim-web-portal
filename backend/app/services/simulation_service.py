"""
Simulation Service - Orchestrates BatSim Simulation Lifecycle

Manages the complete simulation pipeline:
- File preparation (copying workload, platform, strategy)
- Container orchestration via DockerService
- Progress monitoring and logging
- Result collection and parsing
"""

import asyncio
import json
import logging
import os
import re
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Callable, Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.experiment import Experiment, ExperimentStatus
from app.models.result import Result
from app.services.docker_service import DockerService, docker_service
from app.services.ws_bridge import ws_bridge

# Configure logging
logger = logging.getLogger(__name__)


@dataclass
class SimulationFiles:
    """Paths to simulation input/output files."""
    base_dir: str
    platform_path: str
    workload_path: str
    strategy_path: str
    output_dir: str


class SimulationService:
    """
    Orchestrates the complete BatSim simulation lifecycle.

    Features:
    - Asynchronous simulation execution
    - Real-time progress tracking
    - Log aggregation
    - Result collection and parsing
    - Graceful error handling
    """

    def __init__(self, docker_svc: DockerService):
        """
        Initialize the simulation service.

        Args:
            docker_svc: DockerService instance for container management
        """
        self.docker = docker_svc
        self.running_tasks: Dict[int, asyncio.Task] = {}
        self._progress_callbacks: Dict[int, Callable[[int, str], None]] = {}
        self._log_callbacks: Dict[int, Callable[[str, str], None]] = {}

    def register_progress_callback(
        self,
        experiment_id: int,
        callback: Callable[[int, str], None],
    ) -> None:
        """Register a callback for progress updates."""
        self._progress_callbacks[experiment_id] = callback

    def register_log_callback(
        self,
        experiment_id: int,
        callback: Callable[[str, str], None],
    ) -> None:
        """Register a callback for log updates."""
        self._log_callbacks[experiment_id] = callback

    def _notify_progress(self, experiment_id: int, percentage: int, message: str) -> None:
        """Notify registered callbacks of progress update."""
        if experiment_id in self._progress_callbacks:
            try:
                self._progress_callbacks[experiment_id](percentage, message)
            except Exception as e:
                logger.warning(f"Progress callback error: {e}")

    def _notify_log(self, experiment_id: int, source: str, message: str) -> None:
        """Notify registered callbacks of log message."""
        if experiment_id in self._log_callbacks:
            try:
                self._log_callbacks[experiment_id](source, message)
            except Exception as e:
                logger.warning(f"Log callback error: {e}")

    async def start_simulation(self, experiment_id: int) -> None:
        """
        Start a simulation asynchronously.

        Args:
            experiment_id: The experiment ID to start

        Raises:
            ValueError: If experiment not found or invalid state
            RuntimeError: If simulation is already running
        """
        # Check if already running
        if experiment_id in self.running_tasks:
            raise RuntimeError(f"Simulation {experiment_id} is already running")

        # Get a fresh database session
        db = SessionLocal()
        try:
            experiment = db.query(Experiment).filter(
                Experiment.id == experiment_id
            ).first()

            if not experiment:
                raise ValueError(f"Experiment {experiment_id} not found")

            if experiment.status != ExperimentStatus.PENDING:
                raise ValueError(
                    f"Cannot start experiment in {experiment.status} state. "
                    "Only PENDING experiments can be started."
                )

            # Validate scenario and strategy
            if not experiment.scenario:
                raise ValueError("Experiment has no associated scenario")
            if not experiment.scenario.platform or not experiment.scenario.workload:
                raise ValueError("Scenario is missing platform or workload")
            if not experiment.strategy:
                raise ValueError("Experiment has no associated strategy")

            # Count total jobs from workload file
            try:
                workload_path = experiment.scenario.workload.file_path
                if os.path.exists(workload_path):
                    with open(workload_path, 'r') as f:
                        workload_data = json.load(f)
                        experiment.total_jobs = len(workload_data.get("jobs", []))
                else:
                    experiment.total_jobs = 0
                    logger.warning(f"Workload file not found: {workload_path}")
            except Exception as e:
                logger.warning(f"Failed to count jobs in workload: {e}")
                experiment.total_jobs = 0

            # Update status
            experiment.status = ExperimentStatus.RUNNING
            experiment.start_time = datetime.now()
            experiment.completed_jobs = 0
            experiment.progress_percentage = 0
            db.commit()

            logger.info(f"Starting simulation for experiment {experiment_id}")

            # Broadcast started event via WebSocket
            await ws_bridge.broadcast_started(experiment_id)
            await ws_bridge.broadcast_status(
                experiment_id=experiment_id,
                status="running",
                progress_percentage=0,
                completed_jobs=0,
                total_jobs=experiment.total_jobs,
            )

        finally:
            db.close()

        # Launch background task
        task = asyncio.create_task(self._run_simulation(experiment_id))
        self.running_tasks[experiment_id] = task

        # Handle task completion
        task.add_done_callback(
            lambda t: self._on_task_complete(experiment_id, t)
        )

    def _on_task_complete(self, experiment_id: int, task: asyncio.Task) -> None:
        """Handle simulation task completion."""
        self.running_tasks.pop(experiment_id, None)
        self._progress_callbacks.pop(experiment_id, None)
        self._log_callbacks.pop(experiment_id, None)

        if task.cancelled():
            logger.info(f"Simulation {experiment_id} was cancelled")
        elif task.exception():
            logger.error(f"Simulation {experiment_id} failed: {task.exception()}")
        else:
            logger.info(f"Simulation {experiment_id} completed successfully")

    async def _run_simulation(self, experiment_id: int) -> None:
        """
        Main simulation execution flow.

        This runs as a background task and handles:
        1. File preparation
        2. Container spawning
        3. Progress monitoring
        4. Result collection
        5. Cleanup
        """
        db = SessionLocal()
        batsim_container = None
        pybatsim_container = None

        try:
            experiment = db.query(Experiment).filter(
                Experiment.id == experiment_id
            ).first()

            if not experiment:
                raise ValueError(f"Experiment {experiment_id} not found")

            # Step 1: Prepare simulation files
            logger.info(f"[Exp {experiment_id}] Preparing simulation files...")
            files = await self._prepare_files(experiment)
            experiment.simulation_dir = files.base_dir
            db.commit()

            self._notify_progress(experiment_id, 5, "Files prepared")

            # Step 2: Spawn BatSim container
            logger.info(f"[Exp {experiment_id}] Spawning BatSim container...")
            batsim_container = await self.docker.spawn_batsim(
                experiment_id=experiment_id,
                platform_path=files.platform_path,
                workload_path=files.workload_path,
                output_dir=files.output_dir,
            )
            experiment.batsim_container_id = batsim_container.id
            db.commit()

            self._notify_progress(experiment_id, 10, "BatSim started")

            # Wait a moment for BatSim to initialize
            await asyncio.sleep(2)

            # Step 3: Spawn PyBatsim container
            logger.info(f"[Exp {experiment_id}] Spawning PyBatsim container...")
            batsim_host = f"batsim-exp-{experiment_id}"
            pybatsim_container = await self.docker.spawn_pybatsim(
                experiment_id=experiment_id,
                strategy_path=files.strategy_path,
                batsim_host=batsim_host,
            )
            experiment.pybatsim_container_id = pybatsim_container.id
            db.commit()

            self._notify_progress(experiment_id, 15, "PyBatsim started")

            # Step 4: Monitor simulation progress
            logger.info(f"[Exp {experiment_id}] Monitoring simulation...")
            await self._monitor_simulation(
                experiment_id=experiment_id,
                batsim_container=batsim_container,
                pybatsim_container=pybatsim_container,
                db=db,
            )

            # Step 5: Collect results
            logger.info(f"[Exp {experiment_id}] Collecting results...")
            await self._collect_results(
                experiment_id=experiment_id,
                output_dir=files.output_dir,
                db=db,
            )

            # Mark as completed
            experiment = db.query(Experiment).filter(
                Experiment.id == experiment_id
            ).first()
            experiment.status = ExperimentStatus.COMPLETED
            experiment.end_time = datetime.now()
            experiment.progress_percentage = 100
            db.commit()

            self._notify_progress(experiment_id, 100, "Completed")
            logger.info(f"[Exp {experiment_id}] Simulation completed successfully")

            # Broadcast completed event via WebSocket
            elapsed = (experiment.end_time - experiment.start_time).total_seconds() if experiment.start_time else 0
            await ws_bridge.broadcast_completed(
                experiment_id=experiment_id,
                total_jobs=experiment.total_jobs,
                elapsed_seconds=elapsed,
            )
            await ws_bridge.broadcast_status(
                experiment_id=experiment_id,
                status="completed",
                progress_percentage=100,
                completed_jobs=experiment.completed_jobs,
                total_jobs=experiment.total_jobs,
                elapsed_seconds=elapsed,
            )

        except asyncio.CancelledError:
            logger.info(f"[Exp {experiment_id}] Simulation cancelled")
            experiment = db.query(Experiment).filter(
                Experiment.id == experiment_id
            ).first()
            if experiment:
                experiment.status = ExperimentStatus.CANCELLED
                experiment.end_time = datetime.now()
                db.commit()

                # Broadcast stopped event via WebSocket
                await ws_bridge.broadcast_stopped(experiment_id)
                await ws_bridge.broadcast_status(
                    experiment_id=experiment_id,
                    status="cancelled",
                    progress_percentage=experiment.progress_percentage,
                    completed_jobs=experiment.completed_jobs,
                    total_jobs=experiment.total_jobs,
                )
            raise

        except Exception as e:
            logger.error(f"[Exp {experiment_id}] Simulation failed: {e}")
            experiment = db.query(Experiment).filter(
                Experiment.id == experiment_id
            ).first()
            if experiment:
                experiment.status = ExperimentStatus.FAILED
                experiment.end_time = datetime.now()
                experiment.batsim_logs = (experiment.batsim_logs or "") + f"\n[ERROR] {str(e)}"
                db.commit()

                # Broadcast failed event via WebSocket
                await ws_bridge.broadcast_failed(experiment_id, str(e))
                await ws_bridge.broadcast_status(
                    experiment_id=experiment_id,
                    status="failed",
                    progress_percentage=experiment.progress_percentage,
                    completed_jobs=experiment.completed_jobs,
                    total_jobs=experiment.total_jobs,
                )
            raise

        finally:
            # Always cleanup containers
            try:
                await self.docker.stop_experiment(experiment_id)
            except Exception as e:
                logger.warning(f"Cleanup error for experiment {experiment_id}: {e}")

            db.close()

    async def _prepare_files(self, experiment: Experiment) -> SimulationFiles:
        """
        Prepare simulation files by copying to experiment directory.

        Args:
            experiment: The experiment object

        Returns:
            SimulationFiles with paths to prepared files
        """
        # Create experiment directory
        base_dir = os.path.join(
            settings.STORAGE_PATH,
            "experiments",
            f"exp_{experiment.id}"
        )
        output_dir = os.path.join(base_dir, "output")

        os.makedirs(base_dir, exist_ok=True)
        os.makedirs(output_dir, exist_ok=True)

        # Define destination paths
        platform_dst = os.path.join(base_dir, "platform.xml")
        workload_dst = os.path.join(base_dir, "workload.json")
        strategy_dst = os.path.join(base_dir, "strategy.py")

        # Copy platform file
        platform_src = experiment.scenario.platform.file_path
        if os.path.exists(platform_src):
            shutil.copy2(platform_src, platform_dst)
            logger.debug(f"Copied platform: {platform_src} -> {platform_dst}")
        else:
            # Create a placeholder if file doesn't exist
            logger.warning(f"Platform file not found: {platform_src}, creating placeholder")
            self._create_placeholder_platform(platform_dst)

        # Copy workload file
        workload_src = experiment.scenario.workload.file_path
        if os.path.exists(workload_src):
            shutil.copy2(workload_src, workload_dst)
            logger.debug(f"Copied workload: {workload_src} -> {workload_dst}")
        else:
            logger.warning(f"Workload file not found: {workload_src}, creating placeholder")
            self._create_placeholder_workload(workload_dst)

        # Copy strategy file
        strategy_src = experiment.strategy.file_path
        if os.path.exists(strategy_src):
            shutil.copy2(strategy_src, strategy_dst)
            logger.debug(f"Copied strategy: {strategy_src} -> {strategy_dst}")
        else:
            logger.warning(f"Strategy file not found: {strategy_src}, creating placeholder")
            self._create_placeholder_strategy(strategy_dst)

        # Apply prediction transformation if enabled (Phase 7)
        scenario = experiment.scenario
        if scenario.prediction_enabled:
            try:
                from app.services.prediction_service import prediction_service
                from app.models.prediction_model import PredictionMode
                
                mode = PredictionMode(scenario.prediction_mode or "no_prediction")
                workload_dst = await prediction_service.transform_workload(
                    workload_path=workload_dst,
                    model_id=scenario.prediction_model_id,
                    mode=mode,
                    output_dir=base_dir,
                )
                logger.info(f"Applied prediction transformation (mode={mode.value}) to workload")
            except Exception as e:
                logger.warning(f"Prediction transformation failed: {e}, using original workload")

        return SimulationFiles(
            base_dir=base_dir,
            platform_path=os.path.abspath(platform_dst),
            workload_path=os.path.abspath(workload_dst),
            strategy_path=os.path.abspath(strategy_dst),
            output_dir=os.path.abspath(output_dir),
        )

    def _create_placeholder_platform(self, path: str) -> None:
        """Create a minimal placeholder platform file."""
        content = '''<?xml version='1.0'?>
<!DOCTYPE platform SYSTEM "http://simgrid.gforge.inria.fr/simgrid/simgrid.dtd">
<platform version="4">
  <AS id="AS0" routing="Full">
    <cluster id="cluster" prefix="node-" suffix="" radical="0-7"
             speed="1Gf" bw="125GBps" lat="0" router_id="router"/>
  </AS>
</platform>
'''
        with open(path, 'w') as f:
            f.write(content)

    def _create_placeholder_workload(self, path: str) -> None:
        """Create a minimal placeholder workload file."""
        content = {
            "nb_res": 8,
            "jobs": [
                {"id": 0, "subtime": 0, "walltime": 100, "res": 1, "profile": "1"},
            ],
            "profiles": {
                "1": {"type": "delay", "delay": 10}
            }
        }
        with open(path, 'w') as f:
            json.dump(content, f, indent=2)

    def _create_placeholder_strategy(self, path: str) -> None:
        """Create a minimal placeholder strategy file."""
        content = '''#!/usr/bin/env python3
"""Placeholder FCFS Scheduler"""

def onSimulationBegins(scheduler):
    print("Simulation starting...")

def onJobSubmission(job, scheduler):
    resources = scheduler.get_available_resources()
    if len(resources) >= job.requested_resources:
        scheduler.execute_job(job, resources[:job.requested_resources])

def onJobCompletion(job, scheduler):
    print(f"Job {job.id} completed")
'''
        with open(path, 'w') as f:
            f.write(content)

    async def _monitor_simulation(
        self,
        experiment_id: int,
        batsim_container: Any,
        pybatsim_container: Any,
        db: Session,
    ) -> None:
        """
        Monitor simulation progress by parsing container logs.

        Args:
            experiment_id: The experiment ID
            batsim_container: BatSim container object
            pybatsim_container: PyBatsim container object
            db: Database session
        """
        experiment = db.query(Experiment).filter(
            Experiment.id == experiment_id
        ).first()

        total_jobs = experiment.total_jobs or 1
        completed_jobs = 0
        batsim_logs = []
        pybatsim_logs = []

        # Pattern to detect job completion in BatSim logs
        job_completed_pattern = re.compile(r'Job\s+(\d+)\s+completed|JOB_COMPLETED')

        # Monitor both containers
        check_interval = 1.0  # seconds
        max_runtime = settings.SIMULATION_TIMEOUT

        start_time = asyncio.get_event_loop().time()

        while True:
            elapsed = asyncio.get_event_loop().time() - start_time

            # Check timeout
            if elapsed > max_runtime:
                logger.warning(f"[Exp {experiment_id}] Simulation timeout after {elapsed:.0f}s")
                break

            # Check container status
            batsim_status = await self.docker.get_container_status(batsim_container)
            pybatsim_status = await self.docker.get_container_status(pybatsim_container)

            # Get recent logs
            try:
                new_batsim_logs = await self.docker.get_container_logs(batsim_container, tail=50)
                for line in new_batsim_logs.split('\n'):
                    if line and line not in batsim_logs:
                        batsim_logs.append(line)
                        self._notify_log(experiment_id, "batsim", line)
                        # Broadcast log via WebSocket
                        await ws_bridge.broadcast_log(experiment_id, "batsim", line)

                        # Check for job completion
                        if job_completed_pattern.search(line):
                            completed_jobs += 1
            except Exception as e:
                logger.debug(f"Error getting BatSim logs: {e}")

            try:
                new_pybatsim_logs = await self.docker.get_container_logs(pybatsim_container, tail=50)
                for line in new_pybatsim_logs.split('\n'):
                    if line and line not in pybatsim_logs:
                        pybatsim_logs.append(line)
                        self._notify_log(experiment_id, "pybatsim", line)
                        # Broadcast log via WebSocket
                        await ws_bridge.broadcast_log(experiment_id, "pybatsim", line)
            except Exception as e:
                logger.debug(f"Error getting PyBatsim logs: {e}")

            # Update progress
            if total_jobs > 0:
                progress = min(int((completed_jobs / total_jobs) * 85) + 15, 95)
            else:
                progress = min(int(elapsed / 60) * 10 + 15, 95)

            experiment.completed_jobs = completed_jobs
            experiment.progress_percentage = progress
            experiment.batsim_logs = '\n'.join(batsim_logs[-500:])  # Keep last 500 lines
            experiment.pybatsim_logs = '\n'.join(pybatsim_logs[-500:])
            db.commit()

            self._notify_progress(experiment_id, progress, f"Jobs: {completed_jobs}/{total_jobs}")

            # Broadcast progress via WebSocket
            await ws_bridge.broadcast_progress(
                experiment_id=experiment_id,
                progress_percentage=progress,
                completed_jobs=completed_jobs,
                total_jobs=total_jobs,
            )

            # Check if simulation finished
            if batsim_status in ("exited", "removed"):
                logger.info(f"[Exp {experiment_id}] BatSim container exited")
                break

            if pybatsim_status in ("exited", "removed"):
                logger.info(f"[Exp {experiment_id}] PyBatsim container exited")
                # Wait a bit for BatSim to finish
                await asyncio.sleep(2)
                break

            await asyncio.sleep(check_interval)

    async def _collect_results(
        self,
        experiment_id: int,
        output_dir: str,
        db: Session,
    ) -> None:
        """
        Collect and parse simulation results.

        Args:
            experiment_id: The experiment ID
            output_dir: Directory containing output files
            db: Database session
        """
        experiment = db.query(Experiment).filter(
            Experiment.id == experiment_id
        ).first()

        # Look for result files
        schedule_path = os.path.join(output_dir, "schedule.csv")
        jobs_path = os.path.join(output_dir, "jobs.csv")
        out_prefix = os.path.join(output_dir, "out_")

        # Try to find output files with different naming conventions
        result_files = list(Path(output_dir).glob("*.csv"))
        logger.info(f"[Exp {experiment_id}] Found {len(result_files)} result files")

        # Parse metrics
        metrics = {
            "makespan": 0.0,
            "avg_waiting_time": 0.0,
            "avg_turnaround_time": 0.0,
            "resource_utilization": 0.0,
        }

        # Try to parse jobs CSV if it exists
        for csv_file in result_files:
            if "jobs" in csv_file.name.lower():
                try:
                    metrics = self._parse_jobs_csv(str(csv_file))
                    break
                except Exception as e:
                    logger.warning(f"Failed to parse {csv_file}: {e}")

        # Create result record
        result = Result(
            experiment_id=experiment_id,
            simulation_time=metrics.get("makespan", 0),
            total_jobs=experiment.total_jobs or 0,
            completed_jobs=experiment.completed_jobs or 0,
            failed_jobs=0,
            makespan=metrics.get("makespan", 0),
            average_waiting_time=metrics.get("avg_waiting_time", 0),
            average_turnaround_time=metrics.get("avg_turnaround_time", 0),
            resource_utilization=metrics.get("resource_utilization", 0),
            metrics=json.dumps(metrics),
            result_file_path=str(schedule_path) if os.path.exists(schedule_path) else None,
            log_file_path=str(jobs_path) if os.path.exists(jobs_path) else None,
        )

        db.add(result)
        db.commit()

        logger.info(f"[Exp {experiment_id}] Results saved: makespan={metrics.get('makespan', 0):.2f}")

    def _parse_jobs_csv(self, path: str) -> Dict[str, float]:
        """
        Parse BatSim jobs CSV file to extract metrics.

        Args:
            path: Path to jobs CSV file

        Returns:
            Dictionary of computed metrics
        """
        import csv

        jobs = []
        try:
            with open(path, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    jobs.append({
                        "submit_time": float(row.get("submission_time", 0)),
                        "start_time": float(row.get("starting_time", 0)),
                        "finish_time": float(row.get("finish_time", 0)),
                    })
        except Exception as e:
            logger.error(f"Error parsing CSV: {e}")
            return {}

        if not jobs:
            return {}

        # Calculate metrics
        makespan = max(j["finish_time"] for j in jobs)
        wait_times = [j["start_time"] - j["submit_time"] for j in jobs]
        turnaround_times = [j["finish_time"] - j["submit_time"] for j in jobs]

        return {
            "makespan": makespan,
            "avg_waiting_time": sum(wait_times) / len(wait_times),
            "avg_turnaround_time": sum(turnaround_times) / len(turnaround_times),
            "resource_utilization": 0.0,  # Would need platform info
            "total_jobs": len(jobs),
        }

    async def stop_simulation(self, experiment_id: int) -> None:
        """
        Stop a running simulation.

        Args:
            experiment_id: The experiment ID to stop
        """
        logger.info(f"Stopping simulation {experiment_id}")

        # Cancel the task if running
        if experiment_id in self.running_tasks:
            task = self.running_tasks[experiment_id]
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        # Stop containers
        await self.docker.stop_experiment(experiment_id)

        # Update database
        db = SessionLocal()
        try:
            experiment = db.query(Experiment).filter(
                Experiment.id == experiment_id
            ).first()
            if experiment and experiment.status == ExperimentStatus.RUNNING:
                experiment.status = ExperimentStatus.CANCELLED
                experiment.end_time = datetime.now()
                db.commit()
        finally:
            db.close()

    async def pause_simulation(self, experiment_id: int) -> None:
        """
        Pause a running simulation (Docker pause).

        Args:
            experiment_id: The experiment ID to pause
        """
        if experiment_id not in self.docker.active_containers:
            raise ValueError(f"No active containers for experiment {experiment_id}")

        pair = self.docker.active_containers[experiment_id]

        for container in [pair.batsim, pair.pybatsim]:
            if container:
                try:
                    container.pause()
                except Exception as e:
                    logger.error(f"Error pausing container: {e}")

        # Update status
        db = SessionLocal()
        try:
            experiment = db.query(Experiment).filter(
                Experiment.id == experiment_id
            ).first()
            if experiment:
                experiment.status = ExperimentStatus.PAUSED
                db.commit()
        finally:
            db.close()

        logger.info(f"Simulation {experiment_id} paused")

    async def resume_simulation(self, experiment_id: int) -> None:
        """
        Resume a paused simulation.

        Args:
            experiment_id: The experiment ID to resume
        """
        if experiment_id not in self.docker.active_containers:
            raise ValueError(f"No active containers for experiment {experiment_id}")

        pair = self.docker.active_containers[experiment_id]

        for container in [pair.batsim, pair.pybatsim]:
            if container:
                try:
                    container.unpause()
                except Exception as e:
                    logger.error(f"Error resuming container: {e}")

        # Update status
        db = SessionLocal()
        try:
            experiment = db.query(Experiment).filter(
                Experiment.id == experiment_id
            ).first()
            if experiment:
                experiment.status = ExperimentStatus.RUNNING
                db.commit()
        finally:
            db.close()

        logger.info(f"Simulation {experiment_id} resumed")

    def get_running_experiments(self) -> list[int]:
        """Get list of currently running experiment IDs."""
        return list(self.running_tasks.keys())

    def is_running(self, experiment_id: int) -> bool:
        """Check if an experiment simulation is currently running."""
        return experiment_id in self.running_tasks


# Global singleton instance
simulation_service = SimulationService(docker_service)
