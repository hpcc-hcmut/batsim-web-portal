"""Experiment bundle service — freezes config and copies artifact files.

When an experiment is created, this service:
1. Snapshots the current version of workload/platform/strategy
2. Copies the actual files to an experiment-specific directory
3. Returns an immutable frozen_config dict for storage
"""

import os
import shutil
import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.scenario import Scenario
from app.models.strategy import Strategy


def freeze_experiment_config(
    db: Session,
    experiment_id: int,
    scenario_id: int,
    strategy_id: int,
    seed: int | None = None,
    params: dict | None = None,
) -> dict:
    """Freeze experiment config: snapshot versions and copy files.

    Returns frozen_config dict to store on the experiment record.
    Raises ValueError if scenario/strategy not found or files missing.
    """
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not scenario or not scenario.workload or not scenario.platform:
        raise ValueError(f"Scenario {scenario_id} or its workload/platform not found")

    strategy = db.query(Strategy).filter(Strategy.id == strategy_id).first()
    if not strategy:
        raise ValueError(f"Strategy {strategy_id} not found")

    workload = scenario.workload
    platform = scenario.platform

    # Create experiment directory
    exp_dir = os.path.join(settings.SIMULATION_DATA_PATH, str(experiment_id))
    os.makedirs(exp_dir, exist_ok=True)

    # Copy files to experiment directory
    storage_root = os.path.realpath(settings.STORAGE_PATH)
    frozen_files = {}
    for artifact_type, artifact in [
        ("workload", workload),
        ("platform", platform),
        ("strategy", strategy),
    ]:
        src = artifact.file_path
        if not src or not os.path.exists(src):
            raise ValueError(
                f"{artifact_type} file not found: {src}. "
                f"Upload a valid file for '{artifact.name}' first."
            )
        # Validate source is within storage root (prevent path traversal)
        real_src = os.path.realpath(src)
        if not real_src.startswith(storage_root + os.sep) and real_src != storage_root:
            raise ValueError(f"{artifact_type} file path is outside storage directory")
        # Use clean filename: {type}.{ext} for workload/platform,
        # but for strategy use original upload filename so PyBatsim CLI
        # can discover the class by CamelCasing the module name.
        ext = os.path.splitext(src)[1]
        if artifact_type == "strategy":
            # Extract original filename from storage name format: "{name}_{original}"
            stored_name = os.path.basename(src)
            # Find the original filename after the first underscore
            parts = stored_name.split("_", 1)
            dst_name = parts[1] if len(parts) > 1 else stored_name
        else:
            dst_name = f"{artifact_type}{ext}"
        dst = os.path.join(exp_dir, dst_name)
        # Validate destination is within experiment directory (prevent path traversal)
        real_dst = os.path.realpath(dst)
        if not real_dst.startswith(os.path.realpath(exp_dir) + os.sep):
            raise ValueError(f"{artifact_type} destination escapes experiment directory")
        shutil.copy2(src, dst)
        frozen_files[f"{artifact_type}_path"] = dst

    # Build frozen config snapshot
    frozen_config = {
        "experiment_id": experiment_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "config": {
            "workload": {
                "id": workload.id,
                "version": getattr(workload, "version", 1) or 1,
                "name": workload.name,
            },
            "platform": {
                "id": platform.id,
                "version": getattr(platform, "version", 1) or 1,
                "name": platform.name,
            },
            "strategy": {
                "id": strategy.id,
                "version": getattr(strategy, "version", 1) or 1,
                "name": strategy.name,
            },
            "seed": seed,
            "params": params or {},
        },
        "frozen_files": frozen_files,
    }

    return frozen_config
