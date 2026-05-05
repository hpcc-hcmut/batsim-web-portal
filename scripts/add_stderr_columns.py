#!/usr/bin/env python3
"""Idempotent migration: add batsim_stderr and pybatsim_stderr columns to experiments table.

Task 7.6 — Log Viewer Rework: splits Docker container logs into 4 separate streams.
This script adds the two new TEXT columns needed for stderr storage.

Safe to run multiple times (checks PRAGMA table_info before ALTER TABLE).
Non-destructive: additive only, no data deleted.

Usage:
    python scripts/add_stderr_columns.py
"""

import os
import sqlite3
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Resolve paths — script in <repo>/scripts/, DB in backend/
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
BACKEND_DIR = REPO_ROOT / "backend"
DB_PATH = BACKEND_DIR / "batsim.db"

# chdir to backend so any relative paths in app config resolve correctly
os.chdir(BACKEND_DIR)

NEW_COLUMNS = [
    ("batsim_stderr", "TEXT"),
    ("pybatsim_stderr", "TEXT"),
]


def get_existing_columns(cursor, table: str) -> set:
    """Return set of column names currently in the table."""
    cursor.execute(f"PRAGMA table_info({table})")
    rows = cursor.fetchall()
    return {row[1] for row in rows}  # row[1] = column name


def main():
    if not DB_PATH.exists():
        print(f"[ERROR] Database not found at {DB_PATH}")
        print("        Run the backend at least once to initialise the DB first.")
        sys.exit(1)

    print(f"[INFO] Connecting to {DB_PATH}")
    conn = sqlite3.connect(str(DB_PATH))
    try:
        cur = conn.cursor()
        existing = get_existing_columns(cur, "experiments")

        for col_name, col_type in NEW_COLUMNS:
            if col_name in existing:
                print(f"  [{col_name}] SKIPPED — already present")
            else:
                cur.execute(
                    f"ALTER TABLE experiments ADD COLUMN {col_name} {col_type}"
                )
                print(f"  [{col_name}] ADDED")

        conn.commit()
        print("[DONE] Migration complete.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
