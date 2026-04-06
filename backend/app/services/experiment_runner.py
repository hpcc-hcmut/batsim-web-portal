import hashlib
import json
import os
import shlex
import shutil
import signal
import subprocess
import threading
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.experiment import Experiment, ExperimentStatus
from app.services.result_ingestor import ingest_experiment_results


RUN_LOCK = threading.Lock()


def _now():
    return datetime.now(timezone.utc)


def _ensure_directory(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _sha256(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _load_config(experiment: Experiment) -> Dict:
    if not experiment.config:
        return {}
    try:
        return json.loads(experiment.config)
    except json.JSONDecodeError:
        return {}


def _strategy_version(path: str) -> str:
    try:
        stat = os.stat(path)
        return f"mtime:{int(stat.st_mtime)}"
    except OSError:
        return "unknown"


def _read_log_excerpt(path: Optional[str], limit: int = 4000) -> Optional[str]:
    if not path or not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8", errors="replace") as handle:
        contents = handle.read()
    return contents[-limit:]


def _normalize_command(value, default: List[str]) -> List[str]:
    if not value:
        return default
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, str):
        return shlex.split(value)
    return default


def _write_manifest(path: str, payload: Dict) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)


def prepare_run(db: Session, experiment: Experiment) -> Dict[str, str]:
    if not experiment.scenario or not experiment.scenario.platform or not experiment.scenario.workload:
        raise ValueError("Experiment scenario is missing linked platform/workload.")
    if not experiment.strategy:
        raise ValueError("Experiment strategy is missing.")

    run_uuid = experiment.run_uuid or str(uuid.uuid4())
    run_dir = os.path.join(settings.STORAGE_PATH, "experiments", run_uuid)
    input_dir = os.path.join(run_dir, "input")
    logs_dir = os.path.join(run_dir, "logs")
    output_dir = os.path.join(run_dir, "output")
    parsed_dir = os.path.join(run_dir, "parsed")

    for directory in (input_dir, logs_dir, output_dir, parsed_dir):
        _ensure_directory(directory)

    platform_src = experiment.scenario.platform.file_path
    workload_src = experiment.scenario.workload.file_path
    strategy_src = experiment.strategy.file_path

    if not all(os.path.exists(path) for path in (platform_src, workload_src, strategy_src)):
        missing = [path for path in (platform_src, workload_src, strategy_src) if not os.path.exists(path)]
        raise FileNotFoundError(f"Missing experiment asset(s): {', '.join(missing)}")

    platform_dst = os.path.join(input_dir, os.path.basename(platform_src))
    workload_dst = os.path.join(input_dir, os.path.basename(workload_src))
    strategy_dst = os.path.join(input_dir, os.path.basename(strategy_src))

    shutil.copy2(platform_src, platform_dst)
    shutil.copy2(workload_src, workload_dst)
    shutil.copy2(strategy_src, strategy_dst)

    config = _load_config(experiment)
    manifest_path = os.path.join(run_dir, "manifest.json")
    batsim_stdout = os.path.join(logs_dir, "batsim.stdout.log")
    batsim_stderr = os.path.join(logs_dir, "batsim.stderr.log")
    scheduler_stdout = os.path.join(logs_dir, "scheduler.stdout.log")
    scheduler_stderr = os.path.join(logs_dir, "scheduler.stderr.log")

    scheduler_url = config.get("scheduler_url", "tcp://localhost:28000")
    batsim_command = _normalize_command(
        config.get("batsim_command"),
        [
            "batsim",
            "-p",
            platform_dst,
            "-w",
            workload_dst,
            "-e",
            output_dir,
            "-s",
            scheduler_url,
        ],
    )
    scheduler_command = _normalize_command(
        config.get("scheduler_command"),
        ["python", strategy_dst],
    )

    manifest = {
        "run_uuid": run_uuid,
        "experiment_id": experiment.id,
        "experiment_name": experiment.name,
        "status": ExperimentStatus.PREPARING.value,
        "created_at": _now().isoformat(),
        "seed": experiment.seed,
        "parameters": config.get("parameters", {}),
        "input_files": {
            "platform": os.path.basename(platform_dst),
            "workload": os.path.basename(workload_dst),
            "strategy": os.path.basename(strategy_dst),
        },
        "checksums": {
            "platform": _sha256(platform_dst),
            "workload": _sha256(workload_dst),
            "strategy": _sha256(strategy_dst),
        },
        "commands": {
            "batsim": batsim_command,
            "scheduler": scheduler_command,
        },
        "paths": {
            "run_dir": run_dir,
            "output_dir": output_dir,
            "parsed_dir": parsed_dir,
        },
        "versions": {
            "scheduler_version": _strategy_version(strategy_src),
        },
    }
    _write_manifest(manifest_path, manifest)

    experiment.run_uuid = run_uuid
    experiment.status = ExperimentStatus.PREPARING
    experiment.status_detail = "Preparing run directory and manifest"
    experiment.simulation_dir = run_dir
    experiment.manifest_path = manifest_path
    experiment.parameter_json = json.dumps(config.get("parameters", {}))
    experiment.seed = config.get("seed")
    experiment.execution_backend = "subprocess"
    experiment.platform_checksum = manifest["checksums"]["platform"]
    experiment.workload_checksum = manifest["checksums"]["workload"]
    experiment.scheduler_version = manifest["versions"]["scheduler_version"]
    experiment.stdout_log_path = scheduler_stdout
    experiment.stderr_log_path = scheduler_stderr
    experiment.batsim_stdout_log_path = batsim_stdout
    experiment.batsim_stderr_log_path = batsim_stderr
    experiment.scheduler_stdout_log_path = scheduler_stdout
    experiment.scheduler_stderr_log_path = scheduler_stderr
    db.commit()

    return {
        "run_dir": run_dir,
        "output_dir": output_dir,
        "manifest_path": manifest_path,
        "platform_dst": platform_dst,
        "workload_dst": workload_dst,
        "strategy_dst": strategy_dst,
        "batsim_stdout": batsim_stdout,
        "batsim_stderr": batsim_stderr,
        "scheduler_stdout": scheduler_stdout,
        "scheduler_stderr": scheduler_stderr,
        "batsim_command": json.dumps(batsim_command),
        "scheduler_command": json.dumps(scheduler_command),
    }


def _update_manifest_status(path: str, status: str, extra: Optional[Dict] = None) -> None:
    if not path or not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    payload["status"] = status
    if extra:
        payload.update(extra)
    _write_manifest(path, payload)


def execute_experiment(experiment_id: int) -> None:
    db = SessionLocal()
    try:
        experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
        if experiment is None:
            return

        prepared = prepare_run(db, experiment)
        batsim_command = json.loads(prepared["batsim_command"])
        scheduler_command = json.loads(prepared["scheduler_command"])

        with open(prepared["scheduler_stdout"], "a", encoding="utf-8") as scheduler_out, open(
            prepared["scheduler_stderr"], "a", encoding="utf-8"
        ) as scheduler_err, open(prepared["batsim_stdout"], "a", encoding="utf-8") as batsim_out, open(
            prepared["batsim_stderr"], "a", encoding="utf-8"
        ) as batsim_err:
            scheduler_proc = subprocess.Popen(
                scheduler_command,
                cwd=prepared["run_dir"],
                stdout=scheduler_out,
                stderr=scheduler_err,
                start_new_session=True,
            )
            batsim_proc = subprocess.Popen(
                batsim_command,
                cwd=prepared["run_dir"],
                stdout=batsim_out,
                stderr=batsim_err,
                start_new_session=True,
            )

            experiment.status = ExperimentStatus.RUNNING
            experiment.status_detail = "BatSim and scheduler are running"
            experiment.start_time = _now()
            experiment.scheduler_pid = scheduler_proc.pid
            experiment.batsim_pid = batsim_proc.pid
            db.commit()
            _update_manifest_status(
                prepared["manifest_path"],
                ExperimentStatus.RUNNING.value,
                {
                    "started_at": experiment.start_time.isoformat(),
                    "pids": {
                        "scheduler": scheduler_proc.pid,
                        "batsim": batsim_proc.pid,
                    },
                },
            )

            scheduler_exit = scheduler_proc.wait()
            batsim_exit = batsim_proc.wait()
            experiment.exit_code = batsim_exit if batsim_exit != 0 else scheduler_exit
            experiment.end_time = _now()
            experiment.batsim_logs = _read_log_excerpt(prepared["batsim_stdout"])
            experiment.pybatsim_logs = _read_log_excerpt(prepared["scheduler_stdout"])

            if experiment.status == ExperimentStatus.CANCELLED:
                experiment.status_detail = "Run was cancelled"
                db.commit()
                _update_manifest_status(prepared["manifest_path"], ExperimentStatus.CANCELLED.value)
                return

            if batsim_exit != 0 or scheduler_exit != 0:
                experiment.status = ExperimentStatus.FAILED
                experiment.failure_reason = (
                    f"Batsim exit={batsim_exit}, scheduler exit={scheduler_exit}"
                )
                experiment.status_detail = "Execution failed"
                db.commit()
                _update_manifest_status(
                    prepared["manifest_path"],
                    ExperimentStatus.FAILED.value,
                    {
                        "finished_at": experiment.end_time.isoformat(),
                        "failure_reason": experiment.failure_reason,
                    },
                )
                return

            experiment.status = ExperimentStatus.PARSING
            experiment.status_detail = "Run completed, ingesting results"
            db.commit()
            _update_manifest_status(
                prepared["manifest_path"],
                ExperimentStatus.PARSING.value,
                {"finished_at": experiment.end_time.isoformat()},
            )

            result = ingest_experiment_results(db, experiment)
            experiment.total_jobs = result.total_jobs
            experiment.completed_jobs = result.completed_jobs or 0
            experiment.progress_percentage = 100
            experiment.status = ExperimentStatus.COMPLETED
            experiment.status_detail = "Results ingested successfully"
            experiment.batsim_version = (
                json.loads(result.metric_json).get("batsim_version")
                if result.metric_json
                else None
            )
            db.commit()
            _update_manifest_status(
                prepared["manifest_path"],
                ExperimentStatus.COMPLETED.value,
                {
                    "result_id": result.id,
                    "finished_at": experiment.end_time.isoformat(),
                },
            )
    except Exception as exc:
        db.rollback()
        experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
        if experiment is not None:
            experiment.status = ExperimentStatus.FAILED
            experiment.failure_reason = str(exc)
            experiment.status_detail = "Execution aborted"
            experiment.end_time = _now()
            experiment.batsim_logs = _read_log_excerpt(experiment.batsim_stdout_log_path)
            experiment.pybatsim_logs = _read_log_excerpt(experiment.scheduler_stdout_log_path)
            db.commit()
            _update_manifest_status(
                experiment.manifest_path,
                ExperimentStatus.FAILED.value,
                {
                    "finished_at": experiment.end_time.isoformat(),
                    "failure_reason": experiment.failure_reason,
                },
            )
    finally:
        db.close()


def launch_experiment_async(experiment_id: int) -> None:
    thread = threading.Thread(
        target=execute_experiment, args=(experiment_id,), daemon=True
    )
    thread.start()


def stop_experiment_processes(experiment: Experiment) -> None:
    for pid in (experiment.batsim_pid, experiment.scheduler_pid):
        if not pid:
            continue
        try:
            os.killpg(pid, signal.SIGTERM)
        except ProcessLookupError:
            continue
