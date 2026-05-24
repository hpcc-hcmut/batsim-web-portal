"""Synthetic BatSim workload generator for TN 6 scale testing.

Produces a JSON workload that mimics the rough shape of PWA HPC traces (SDSC-DS):
exponential interarrivals, long-tail resource counts, lognormal walltimes. Pure
stdlib so the script runs anywhere the portal does.

Usage:
    python generate-synthetic-workload.py --n-jobs 5000 --n-resources 64 \
        --output ./synthetic-sdsc-ext-5000.json

    python generate-synthetic-workload.py --n-jobs 50000 --n-resources 64 \
        --seed 42 --output ./synthetic-sdsc-ext-50000.json

Defaults match the TN 6 setup: 64-host platform, seed for reproducibility,
delay profiles only (no compute model — keeps the workload schema simple and
strategy-agnostic).
"""
from __future__ import annotations

import argparse
import json
import math
import random
import sys
from pathlib import Path


def _sample_walltime(rng: random.Random) -> float:
    """Lognormal-ish walltime in seconds, clamped to [10s, 4h].

    Mean ~600s, heavy right tail to mimic HPC trace shape. Tweaked so the bulk
    of jobs finish in a few minutes but a few stretch into hours.
    """
    raw = rng.lognormvariate(mu=6.0, sigma=1.1)  # mean exp(6+0.6)≈730
    return max(10.0, min(14_400.0, raw))


def _sample_resources(rng: random.Random, nb_res: int) -> int:
    """Resource request count — geometric-ish so 1-host jobs dominate, occasional large jobs.

    Capped at half the cluster so synthetic workloads keep enough parallelism (a job
    asking for full cluster blocks the whole queue under deterministic strategies).
    """
    # 1 + Exp(0.35) approximates a geometric distribution at integer scale — keeps the
    # mean around 3 hosts/job with a long thin tail. stdlib has no geometricvariate.
    res = 1 + int(rng.expovariate(0.35))
    return max(1, min(nb_res // 2, res))


def _build_profiles(jobs: list[dict]) -> dict[str, dict]:
    """One profile per distinct walltime (rounded). Saves space vs per-job profiles."""
    profiles: dict[str, dict] = {}
    for job in jobs:
        prof_id = job["profile"]
        if prof_id not in profiles:
            # 'delay' profile: simple wall-clock sleep model. Strategy-agnostic.
            profiles[prof_id] = {"type": "delay", "delay": float(prof_id[2:])}
    return profiles


def generate(n_jobs: int, nb_res: int, seed: int, arrival_rate: float) -> dict:
    """Build the workload dict. arrival_rate = jobs/sec on average (Poisson)."""
    rng = random.Random(seed)
    jobs: list[dict] = []
    t = 0.0
    for i in range(n_jobs):
        gap = rng.expovariate(arrival_rate)
        t += gap
        walltime = _sample_walltime(rng)
        res = _sample_resources(rng, nb_res)
        # profile id = floor(walltime) so the delay never exceeds the declared walltime
        # (round() can round UP, causing BatSim to kill jobs that overshoot their limit)
        prof_id = f"p_{int(walltime)}"
        jobs.append({
            "id": i,
            "subtime": round(t, 4),
            "res": res,
            "walltime": round(walltime, 4),
            "profile": prof_id,
        })
    return {
        "nb_res": nb_res,
        "jobs": jobs,
        "profiles": _build_profiles(jobs),
    }


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--n-jobs", type=int, required=True, help="Number of jobs to emit")
    parser.add_argument("--n-resources", type=int, default=64, help="Cluster size for nb_res field")
    parser.add_argument("--seed", type=int, default=42, help="RNG seed (reproducibility)")
    parser.add_argument(
        "--arrival-rate", type=float, default=0.5,
        help="Average job arrivals per second (Poisson). Lower = more spaced out.",
    )
    parser.add_argument(
        "--output", type=Path, required=True,
        help="Output .json path. Parent directory must exist.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    if args.n_jobs < 1:
        print("ERROR: --n-jobs must be >= 1", file=sys.stderr)
        return 2
    workload = generate(args.n_jobs, args.n_resources, args.seed, args.arrival_rate)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as f:
        json.dump(workload, f, separators=(",", ":"))
    n_profiles = len(workload["profiles"])
    last_subtime = workload["jobs"][-1]["subtime"]
    size_kb = args.output.stat().st_size / 1024
    print(
        f"Wrote {args.output} — {args.n_jobs} jobs, {n_profiles} profiles, "
        f"last_subtime={last_subtime:.1f}s, file_size={size_kb:.1f} KB"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
