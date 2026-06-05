"""Experiment bundle service — freezes config and copies artifact files.

When an experiment is created, this service:
1. Snapshots the current version of workload/platform/strategy
2. Copies the actual files to an experiment-specific directory
3. Returns an immutable frozen_config dict for storage
"""

import hashlib
import logging
import os
import shutil
import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.scenario import Scenario
from app.models.strategy import Strategy

logger = logging.getLogger(__name__)


def _file_md5(path: str) -> str | None:
    """MD5 of file content for change-detection metadata.

    Returns None on read errors — hashes are metadata, never block freeze/clone.
    """
    try:
        h = hashlib.md5()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
        return h.hexdigest()
    except OSError:
        return None


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
        # MD5 per frozen file — basis for reproducibility comparison and
        # tamper detection (a hand-edited frozen file shows a hash mismatch).
        "hashes": {k: _file_md5(v) for k, v in frozen_files.items()},
    }

    return frozen_config


def clone_frozen_experiment(source_exp, new_experiment_id: int) -> dict:
    """Clone frozen inputs of a finished experiment into a new experiment dir.

    Copies from the SOURCE experiment's frozen snapshot (simulation_dir), NOT
    from the original asset files — so a rerun uses byte-identical inputs even
    if the originals were edited or deleted since (TN 2.B semantics).

    Returns the new frozen_config dict. Raises ValueError when the source has
    no frozen config or its frozen files are missing on disk.
    """
    try:
        source_config = json.loads(source_exp.frozen_config or "")
    except (TypeError, ValueError):
        raise ValueError(
            f"Source experiment {source_exp.id} has no valid frozen config; "
            "rerun requires a frozen snapshot."
        )

    source_files = source_config.get("frozen_files") or {}
    if not source_files:
        raise ValueError(
            f"Source experiment {source_exp.id} has no frozen files recorded."
        )

    # Verify every frozen input still exists before touching disk
    for key, path in source_files.items():
        if not path or not os.path.exists(path):
            raise ValueError(
                f"Frozen input missing: {key} ({path}). "
                "The source experiment's data may have been deleted from storage."
            )

    new_dir = os.path.join(settings.SIMULATION_DATA_PATH, str(new_experiment_id))
    os.makedirs(new_dir, exist_ok=True)

    # Copy keeping original filenames — PyBatsim discovers the scheduler class
    # by CamelCasing the strategy module name, so the name must be preserved.
    new_files = {}
    for key, src in source_files.items():
        dst = os.path.join(new_dir, os.path.basename(src))
        shutil.copy2(src, dst)
        new_files[key] = dst

    new_hashes = {k: _file_md5(v) for k, v in new_files.items()}

    # Integrity check against source hashes (older experiments may lack them)
    source_hashes = source_config.get("hashes") or {}
    for key, src_hash in source_hashes.items():
        if src_hash and new_hashes.get(key) and src_hash != new_hashes[key]:
            logger.warning(
                "Rerun clone hash mismatch for %s (source exp %s): frozen file "
                "changed on disk since the original freeze.",
                key, source_exp.id,
            )

    return {
        "experiment_id": new_experiment_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "rerun_of": source_exp.id,
        # Same logical config as the source — that is the point of a rerun
        "config": source_config.get("config", {}),
        "frozen_files": new_files,
        "hashes": new_hashes,
    }
