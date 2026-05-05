#!/usr/bin/env python3
"""Dev tool: drop-and-recreate batsim.db with FK CASCADE schema, then reseed demo data.

IMPORTANT: This script WIPES the database completely. A timestamped backup is
created automatically before any destructive operation.

Usage:
    python scripts/rebuild_db_with_fk.py --confirm

Why this is needed:
    SQLite ALTER TABLE cannot add ON DELETE clauses to existing FK columns.
    `Base.metadata.create_all()` only creates tables that don't exist yet -
    it does NOT alter existing tables. The only way to materialise the new
    ondelete=CASCADE / ondelete=SET NULL declarations from the model layer is
    to drop and recreate every table.

Backup location: batsim.db.bak-<YYYYMMDD-HHMMSS> (same directory as batsim.db)
"""

import os
import sys
import shutil
import argparse
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Resolve paths - script lives in <repo>/scripts/, DB is in backend/
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
BACKEND_DIR = REPO_ROOT / "backend"
DB_PATH = BACKEND_DIR / "batsim.db"
STORAGE_DIR = BACKEND_DIR / "storage"

# DATABASE_URL in backend/.env uses sqlite:///./batsim.db (relative path).
# Ensure SQLAlchemy resolves it against backend/ regardless of where the user
# invoked the script from. Without this, running from <repo>/ creates a stub
# DB at <repo>/batsim.db and "no such table: users" surfaces on first query.
os.chdir(BACKEND_DIR)


def _backup_db() -> Path:
    """Copy batsim.db to a timestamped backup file and return the backup path."""
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = DB_PATH.with_name(f"batsim.db.bak-{ts}")
    shutil.copy2(DB_PATH, backup_path)
    print(f"[BACKUP] {DB_PATH} -> {backup_path}")
    return backup_path


def _archive_storage(timestamp: str) -> Path | None:
    """Move backend/storage/ to a timestamped archive directory.

    Without this, dropped+recreated tables reset PKs to 1, but old per-id
    storage dirs (e.g. backend/storage/experiments/5/) still exist on disk.
    A fresh experiment 5 would then surface stale logs from a deleted run.
    Returns the archive path, or None if storage dir does not exist.
    """
    if not STORAGE_DIR.exists():
        return None
    archive_path = STORAGE_DIR.with_name(f"storage.bak-{timestamp}")
    shutil.move(str(STORAGE_DIR), str(archive_path))
    STORAGE_DIR.mkdir(exist_ok=True)
    print(f"[ARCHIVE] {STORAGE_DIR} contents moved to {archive_path}")
    return archive_path


def _count_rows(db) -> dict:
    """Return {table: row_count} for all main tables."""
    from app.models.user import User
    from app.models.workload import Workload
    from app.models.platform import Platform
    from app.models.strategy import Strategy
    from app.models.scenario import Scenario
    from app.models.experiment import Experiment
    from app.models.result import Result

    return {
        "users": db.query(User).count(),
        "workloads": db.query(Workload).count(),
        "platforms": db.query(Platform).count(),
        "strategies": db.query(Strategy).count(),
        "scenarios": db.query(Scenario).count(),
        "experiments": db.query(Experiment).count(),
        "results": db.query(Result).count(),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Rebuild batsim.db schema with FK CASCADE and reseed demo data."
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Required flag to confirm the destructive operation.",
    )
    args = parser.parse_args()

    if not args.confirm:
        print(
            "ERROR: This script wipes the database. Rerun with --confirm to proceed.\n"
            "       A timestamped backup will be created automatically."
        )
        sys.exit(1)

    # Add backend to path so app imports resolve
    sys.path.insert(0, str(BACKEND_DIR))

    # Import app components after path is set
    from app.core.database import engine, Base, SessionLocal

    # Import all models to register them with Base.metadata
    from app.models import User, Workload, Platform, Scenario, Strategy, Experiment, Result  # noqa: F401

    # ---------------------------------------------------------------------------
    # Step 1: sanity check + backup
    # ---------------------------------------------------------------------------
    # Confirm SQLAlchemy is pointed at the same DB file we plan to back up.
    engine_url_path = engine.url.database  # for sqlite:///./batsim.db this is "./batsim.db"
    engine_resolved = (Path.cwd() / engine_url_path).resolve() if engine_url_path else None
    if engine_resolved and engine_resolved != DB_PATH.resolve():
        print(f"[ERROR] DB path mismatch - engine sees {engine_resolved}, expected {DB_PATH.resolve()}")
        print("        Check backend/.env DATABASE_URL or the script's chdir target.")
        sys.exit(2)

    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    if DB_PATH.exists():
        before_db = SessionLocal()
        try:
            rows_before = _count_rows(before_db)
            print(f"[INFO] Row counts before rebuild: {rows_before}")
        finally:
            before_db.close()
        _backup_db()
    else:
        print("[INFO] batsim.db does not exist yet - will be created fresh.")

    # Archive storage dirs so reset PKs don't surface stale per-id logs.
    _archive_storage(ts)

    # ---------------------------------------------------------------------------
    # Step 2: drop all + recreate (materialises ON DELETE CASCADE in new schema)
    # ---------------------------------------------------------------------------
    print("[REBUILD] Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("[REBUILD] Recreating tables with FK CASCADE schema...")
    Base.metadata.create_all(bind=engine)
    print("[REBUILD] Schema rebuild complete.")

    # ---------------------------------------------------------------------------
    # Step 3: reseed using functions already defined in app/main.py
    # ---------------------------------------------------------------------------
    print("[SEED] Seeding admin user and demo data...")

    # Import seeder functions without triggering FastAPI app startup side-effects
    # We replicate the seed logic inline to avoid triggering app-level imports
    from app.core.security import get_password_hash
    from app.models.user import UserRole

    db = SessionLocal()
    try:
        # seed_admin_user equivalent
        admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if not admin:
            db.add(User(
                username="admin",
                email="admin@example.com",
                hashed_password=get_password_hash("admin@123"),
                role=UserRole.ADMIN,
                is_active="true",
            ))
            db.commit()
            print("[SEED] Admin user created: admin / admin@123")

        # seed_demo_user equivalent
        demo_user = db.query(User).filter(User.username == "demo_user").first()
        if not demo_user:
            demo_user = User(
                username="demo_user",
                email="demo_user@example.com",
                hashed_password=get_password_hash("demo1234"),
                role=UserRole.USER,
                is_active="true",
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)
            print("[SEED] Demo user created: demo_user / demo1234")
    finally:
        db.close()

    # Run the full seed_demo_data from main.py for consistency
    from app.main import seed_demo_data
    seed_demo_data()

    # ---------------------------------------------------------------------------
    # Step 4: verify row counts
    # ---------------------------------------------------------------------------
    after_db = SessionLocal()
    try:
        rows_after = _count_rows(after_db)
        print(f"[INFO] Row counts after rebuild: {rows_after}")
    finally:
        after_db.close()

    print("\n[DONE] Database rebuilt and reseeded successfully.")
    print("       PRAGMA foreign_keys=ON is now enforced on every new connection.")
    print("       CASCADE and SET NULL rules are now active in the schema.")


if __name__ == "__main__":
    main()
