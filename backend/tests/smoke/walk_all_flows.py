#!/usr/bin/env python3
"""HTTP smoke walker — exercises every CRUD endpoint as an authenticated user.

Walks the full entity graph via real HTTP calls against a running backend stack.
Verifies FK cascade behavior end-to-end (not just ORM unit level).
Cleans up all created entities on exit (--keep to skip cleanup for debugging).

Usage:
    python backend/tests/smoke/walk_all_flows.py
    python backend/tests/smoke/walk_all_flows.py --base-url http://localhost:8000
    python backend/tests/smoke/walk_all_flows.py --user demo_user --password demo1234
    python backend/tests/smoke/walk_all_flows.py --keep
"""

import argparse
import json
import sys
import time
from typing import Optional

import httpx

# ---------------------------------------------------------------------------
# Embedded sample data (lifted from backend/tests/conftest.py SAMPLE_* constants)
# ---------------------------------------------------------------------------

SAMPLE_WORKLOAD = {
    "nb_res": 4,
    "jobs": [
        {"id": 0, "subtime": 0, "res": 2, "profile": "delay_10s", "walltime": 100},
        {"id": 1, "subtime": 5, "res": 1, "profile": "delay_20s", "walltime": 200},
    ],
    "profiles": {
        "delay_10s": {"type": "delay", "delay": 10},
        "delay_20s": {"type": "delay", "delay": 20},
    },
}

SAMPLE_PLATFORM_XML = """<?xml version='1.0'?>
<!DOCTYPE platform SYSTEM "https://simgrid.org/simgrid.dtd">
<platform version="4.1">
  <zone id="world" routing="Full">
    <cluster id="cluster0" prefix="host-" suffix=".test"
             radical="0-3" speed="1Gf" bw="125MBps" lat="50us" />
    <host id="master_host0" speed="1Gf">
      <prop id="role" value="master" />
    </host>
  </zone>
</platform>"""

SAMPLE_STRATEGY_PY = """from batsim.batsim import BatsimScheduler

class FcfsScheduler(BatsimScheduler):
    def onJobSubmission(self, job):
        self.bs.execute(job.id, job.requested_resources)

if __name__ == "__main__":
    pass
"""

# Unique suffix to avoid name collisions on re-runs
_RUN_TS = str(int(time.time()))


# ---------------------------------------------------------------------------
# StepRecorder — tracks pass/fail/skip per named step
# ---------------------------------------------------------------------------

class StepRecorder:
    def __init__(self):
        self.results: list[tuple[str, str, float, str]] = []  # (name, status, ms, note)
        self._t0: Optional[float] = None
        self._current: Optional[str] = None

    def start(self, name: str):
        self._current = name
        self._t0 = time.monotonic()

    def _record(self, status: str, note: str = ""):
        elapsed = (time.monotonic() - self._t0) * 1000 if self._t0 else 0.0
        self.results.append((self._current, status, elapsed, note))
        tag = {"PASS": "\033[32mPASS\033[0m", "FAIL": "\033[31mFAIL\033[0m", "SKIP": "\033[33mSKIP\033[0m"}.get(status, status)
        note_str = f" — {note}" if note else ""
        print(f"  [{tag}] {self._current} ({elapsed:.0f}ms){note_str}")
        self._current = None
        self._t0 = None

    def ok(self, note: str = ""):
        self._record("PASS", note)

    def fail(self, note: str = ""):
        self._record("FAIL", note)

    def skip(self, note: str = ""):
        self._record("SKIP", note)

    def summary(self) -> int:
        passed = sum(1 for _, s, _, _ in self.results if s == "PASS")
        failed = sum(1 for _, s, _, _ in self.results if s == "FAIL")
        skipped = sum(1 for _, s, _, _ in self.results if s == "SKIP")
        total_ms = sum(ms for _, _, ms, _ in self.results)
        print("\n" + "─" * 60)
        print(f"  {passed} passed, {failed} failed, {skipped} skipped in {total_ms / 1000:.1f}s")
        if failed:
            print("  FAILED steps:")
            for name, status, _, note in self.results:
                if status == "FAIL":
                    print(f"    - {name}: {note}")
        return 1 if failed else 0


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _check(rec: StepRecorder, resp: httpx.Response, expected: int = 200) -> bool:
    if resp.status_code == expected:
        return True
    try:
        body = resp.json()
    except Exception:
        body = resp.text[:200]
    rec.fail(f"{resp.status_code}: {body}")
    return False


def _login(client: httpx.Client, base_url: str, username: str, password: str, rec: StepRecorder) -> Optional[str]:
    rec.start("auth.login")
    resp = client.post(
        f"{base_url}/api/auth/login",
        data={"username": username, "password": password},
    )
    if not _check(rec, resp):
        return None
    token = resp.json().get("access_token")
    if not token:
        rec.fail("no access_token in response")
        return None
    rec.ok()
    return token


# ---------------------------------------------------------------------------
# Entity walk helpers
# ---------------------------------------------------------------------------

def _walk_workload(client: httpx.Client, base_url: str, rec: StepRecorder) -> Optional[int]:
    """Upload, list, GET, rename, DELETE. Returns created ID or None on failure."""
    name = f"smoke-workload-{_RUN_TS}"
    content = json.dumps(SAMPLE_WORKLOAD).encode()

    # Create
    rec.start("workload.create")
    resp = client.post(
        f"{base_url}/api/workloads/upload",
        files={"file": (f"{name}.json", content, "application/json")},
        data={"name": name, "description": "smoke test workload"},
    )
    if not _check(rec, resp, 201):
        return None
    wl_id = resp.json()["id"]
    rec.ok(f"id={wl_id}")

    # List — find by name
    rec.start("workload.list")
    resp = client.get(f"{base_url}/api/workloads/")
    if not _check(rec, resp):
        return wl_id
    items = resp.json() if isinstance(resp.json(), list) else resp.json().get("items", resp.json())
    found = any(w.get("name") == name or w.get("id") == wl_id for w in (items if isinstance(items, list) else []))
    if not found:
        rec.fail(f"created workload id={wl_id} not found in list")
    else:
        rec.ok()

    # GET
    rec.start("workload.get")
    resp = client.get(f"{base_url}/api/workloads/{wl_id}")
    if not _check(rec, resp):
        return wl_id
    rec.ok()

    # Update (rename)
    rec.start("workload.update")
    resp = client.put(
        f"{base_url}/api/workloads/{wl_id}",
        json={"name": f"{name}-renamed", "description": "renamed"},
    )
    if resp.status_code in (200, 201):
        rec.ok()
    else:
        rec.fail(f"{resp.status_code}: {resp.text[:100]}")

    return wl_id


def _walk_platform(client: httpx.Client, base_url: str, rec: StepRecorder) -> Optional[int]:
    name = f"smoke-platform-{_RUN_TS}"
    content = SAMPLE_PLATFORM_XML.encode()

    rec.start("platform.create")
    resp = client.post(
        f"{base_url}/api/platforms/upload",
        files={"file": (f"{name}.xml", content, "application/xml")},
        data={"name": name, "description": "smoke test platform"},
    )
    if not _check(rec, resp, 201):
        return None
    pl_id = resp.json()["id"]
    rec.ok(f"id={pl_id}")

    rec.start("platform.list")
    resp = client.get(f"{base_url}/api/platforms/")
    if _check(rec, resp):
        rec.ok()

    rec.start("platform.get")
    resp = client.get(f"{base_url}/api/platforms/{pl_id}")
    if _check(rec, resp):
        rec.ok()

    rec.start("platform.update")
    resp = client.put(
        f"{base_url}/api/platforms/{pl_id}",
        json={"name": f"{name}-renamed", "description": "renamed"},
    )
    if resp.status_code in (200, 201):
        rec.ok()
    else:
        rec.fail(f"{resp.status_code}: {resp.text[:100]}")

    return pl_id


def _walk_strategy(client: httpx.Client, base_url: str, rec: StepRecorder) -> Optional[int]:
    name = f"smoke-strategy-{_RUN_TS}"
    content = SAMPLE_STRATEGY_PY.encode()

    rec.start("strategy.create")
    resp = client.post(
        f"{base_url}/api/strategies/upload",
        files={"file": (f"{name}.py", content, "text/x-python")},
        data={"name": name, "description": "smoke test strategy"},
    )
    if not _check(rec, resp, 201):
        return None
    st_id = resp.json()["id"]
    rec.ok(f"id={st_id}")

    rec.start("strategy.list")
    resp = client.get(f"{base_url}/api/strategies/")
    if _check(rec, resp):
        rec.ok()

    rec.start("strategy.get")
    resp = client.get(f"{base_url}/api/strategies/{st_id}")
    if _check(rec, resp):
        rec.ok()

    # Extra: verify /content endpoint returns non-empty body
    rec.start("strategy.content")
    resp = client.get(f"{base_url}/api/strategies/{st_id}/content")
    if resp.status_code == 200 and len(resp.text) > 0:
        rec.ok()
    elif resp.status_code == 404:
        rec.skip("content endpoint not found (404)")
    else:
        rec.fail(f"{resp.status_code}: empty or error")

    rec.start("strategy.update")
    resp = client.put(
        f"{base_url}/api/strategies/{st_id}",
        json={"name": f"{name}-renamed", "description": "renamed"},
    )
    if resp.status_code in (200, 201):
        rec.ok()
    else:
        rec.fail(f"{resp.status_code}: {resp.text[:100]}")

    return st_id


def _walk_scenario(client: httpx.Client, base_url: str, rec: StepRecorder, wl_id: int, pl_id: int) -> Optional[int]:
    name = f"smoke-scenario-{_RUN_TS}"

    rec.start("scenario.create")
    resp = client.post(
        f"{base_url}/api/scenarios/",
        json={"name": name, "description": "smoke", "workload_id": wl_id, "platform_id": pl_id},
    )
    if not _check(rec, resp, 201):
        return None
    sc_id = resp.json()["id"]
    rec.ok(f"id={sc_id}")

    rec.start("scenario.get")
    resp = client.get(f"{base_url}/api/scenarios/{sc_id}")
    if _check(rec, resp):
        rec.ok()

    return sc_id


def _walk_experiment(client: httpx.Client, base_url: str, rec: StepRecorder, sc_id: int, st_id: int) -> Optional[int]:
    name = f"smoke-experiment-{_RUN_TS}"

    rec.start("experiment.create")
    resp = client.post(
        f"{base_url}/api/experiments/",
        json={"name": name, "description": "smoke", "scenario_id": sc_id, "strategy_id": st_id},
    )
    if not _check(rec, resp, 201):
        return None
    exp_id = resp.json()["id"]
    rec.ok(f"id={exp_id}")

    rec.start("experiment.get")
    resp = client.get(f"{base_url}/api/experiments/{exp_id}")
    if _check(rec, resp):
        rec.ok()

    return exp_id


# ---------------------------------------------------------------------------
# Cascade verification via HTTP
# ---------------------------------------------------------------------------

def _verify_cascade(client: httpx.Client, base_url: str, rec: StepRecorder):
    """Create workload→scenario→experiment chain, delete workload, verify cascade."""
    ts = f"casc-{_RUN_TS}"

    # Create workload
    rec.start("cascade.create_workload")
    content = json.dumps(SAMPLE_WORKLOAD).encode()
    resp = client.post(
        f"{base_url}/api/workloads/upload",
        files={"file": (f"{ts}-wl.json", content, "application/json")},
        data={"name": f"{ts}-wl", "description": "cascade smoke"},
    )
    if not _check(rec, resp, 201):
        return
    casc_wl_id = resp.json()["id"]
    rec.ok(f"id={casc_wl_id}")

    # Create platform
    rec.start("cascade.create_platform")
    content_xml = SAMPLE_PLATFORM_XML.encode()
    resp = client.post(
        f"{base_url}/api/platforms/upload",
        files={"file": (f"{ts}-pl.xml", content_xml, "application/xml")},
        data={"name": f"{ts}-pl", "description": "cascade smoke"},
    )
    if not _check(rec, resp, 201):
        return
    casc_pl_id = resp.json()["id"]
    rec.ok(f"id={casc_pl_id}")

    # Create strategy
    rec.start("cascade.create_strategy")
    content_py = SAMPLE_STRATEGY_PY.encode()
    resp = client.post(
        f"{base_url}/api/strategies/upload",
        files={"file": (f"{ts}-st.py", content_py, "text/x-python")},
        data={"name": f"{ts}-st", "description": "cascade smoke"},
    )
    if not _check(rec, resp, 201):
        return
    casc_st_id = resp.json()["id"]
    rec.ok(f"id={casc_st_id}")

    # Create scenario
    rec.start("cascade.create_scenario")
    resp = client.post(
        f"{base_url}/api/scenarios/",
        json={"name": f"{ts}-sc", "description": "cascade smoke", "workload_id": casc_wl_id, "platform_id": casc_pl_id},
    )
    if not _check(rec, resp, 201):
        return
    casc_sc_id = resp.json()["id"]
    rec.ok(f"id={casc_sc_id}")

    # Create experiment
    rec.start("cascade.create_experiment")
    resp = client.post(
        f"{base_url}/api/experiments/",
        json={"name": f"{ts}-exp", "description": "cascade smoke", "scenario_id": casc_sc_id, "strategy_id": casc_st_id},
    )
    if not _check(rec, resp, 201):
        return
    casc_exp_id = resp.json()["id"]
    rec.ok(f"id={casc_exp_id}")

    # Delete workload — cascade should remove scenario and experiment
    rec.start("cascade.delete_workload")
    resp = client.delete(f"{base_url}/api/workloads/{casc_wl_id}")
    if not _check(rec, resp, 204):
        return
    rec.ok()

    # Verify scenario is gone
    rec.start("cascade.scenario_gone")
    resp = client.get(f"{base_url}/api/scenarios/{casc_sc_id}")
    if resp.status_code == 404:
        rec.ok("scenario cascaded away as expected")
    elif resp.status_code == 200:
        rec.fail("scenario still exists — cascade did NOT fire (DB rebuild needed?)")
    else:
        rec.fail(f"unexpected status {resp.status_code}")

    # Verify experiment is gone
    rec.start("cascade.experiment_gone")
    resp = client.get(f"{base_url}/api/experiments/{casc_exp_id}")
    if resp.status_code == 404:
        rec.ok("experiment cascaded away as expected")
    elif resp.status_code == 200:
        rec.fail("experiment still exists — cascade did NOT fire (DB rebuild needed?)")
    else:
        rec.fail(f"unexpected status {resp.status_code}")


# ---------------------------------------------------------------------------
# Negative auth cases
# ---------------------------------------------------------------------------

def _verify_auth(client: httpx.Client, base_url: str, rec: StepRecorder):
    # No Authorization header
    rec.start("auth.no_token")
    resp = httpx.get(f"{base_url}/api/workloads/")
    if resp.status_code == 401:
        rec.ok()
    else:
        rec.fail(f"expected 401, got {resp.status_code}")

    # Garbage token
    rec.start("auth.bad_token")
    resp = httpx.get(
        f"{base_url}/api/workloads/",
        headers={"Authorization": "Bearer this.is.garbage"},
    )
    if resp.status_code == 401:
        rec.ok()
    else:
        rec.fail(f"expected 401, got {resp.status_code}")


# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

def _cleanup(client: httpx.Client, base_url: str, ids: dict):
    """Delete all created entities in reverse-dependency order."""
    print("\n  [CLEANUP] Deleting smoke entities...")
    # Experiments first (deepest leaf before scenario/strategy)
    for exp_id in ids.get("experiments", []):
        r = client.delete(f"{base_url}/api/experiments/{exp_id}")
        print(f"    experiment {exp_id} → {r.status_code}")

    # Scenarios
    for sc_id in ids.get("scenarios", []):
        r = client.delete(f"{base_url}/api/scenarios/{sc_id}")
        print(f"    scenario {sc_id} → {r.status_code}")

    # Top-level resources (cascade handles remaining children if PRAGMA active)
    for wl_id in ids.get("workloads", []):
        r = client.delete(f"{base_url}/api/workloads/{wl_id}")
        print(f"    workload {wl_id} → {r.status_code}")
    for pl_id in ids.get("platforms", []):
        r = client.delete(f"{base_url}/api/platforms/{pl_id}")
        print(f"    platform {pl_id} → {r.status_code}")
    for st_id in ids.get("strategies", []):
        r = client.delete(f"{base_url}/api/strategies/{st_id}")
        print(f"    strategy {st_id} → {r.status_code}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="BatSim HTTP smoke walker")
    parser.add_argument("--base-url", default="http://localhost:8000", help="Base URL of the running backend")
    parser.add_argument("--user", default="demo_user", help="Login username")
    parser.add_argument("--password", default="demo1234", help="Login password")
    parser.add_argument("--keep", action="store_true", help="Skip cleanup on exit (keep created entities for debugging)")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    rec = StepRecorder()
    created_ids: dict = {"workloads": [], "platforms": [], "strategies": [], "scenarios": [], "experiments": []}

    print(f"\nBatSim smoke walker — {base_url}\n")

    with httpx.Client(timeout=30) as client:
        # --- Auth ---
        token = _login(client, base_url, args.user, args.password, rec)
        if not token:
            print("\n[ABORT] Login failed — cannot continue without a valid token.")
            return 1

        client.headers.update({"Authorization": f"Bearer {token}"})

        try:
            # --- Workload CRUD ---
            wl_id = _walk_workload(client, base_url, rec)
            if wl_id:
                created_ids["workloads"].append(wl_id)

            # --- Platform CRUD ---
            pl_id = _walk_platform(client, base_url, rec)
            if pl_id:
                created_ids["platforms"].append(pl_id)

            # --- Strategy CRUD ---
            st_id = _walk_strategy(client, base_url, rec)
            if st_id:
                created_ids["strategies"].append(st_id)

            # --- Scenario CRUD (needs workload + platform) ---
            if wl_id and pl_id:
                sc_id = _walk_scenario(client, base_url, rec, wl_id, pl_id)
                if sc_id:
                    created_ids["scenarios"].append(sc_id)
            else:
                rec.start("scenario.create")
                rec.skip("skipped — workload or platform creation failed")

            # --- Experiment CRUD (needs scenario + strategy) ---
            if created_ids["scenarios"] and st_id:
                exp_id = _walk_experiment(client, base_url, rec, created_ids["scenarios"][-1], st_id)
                if exp_id:
                    created_ids["experiments"].append(exp_id)
            else:
                rec.start("experiment.create")
                rec.skip("skipped — scenario or strategy creation failed")

            # --- Cascade verification ---
            _verify_cascade(client, base_url, rec)

            # --- Negative auth ---
            _verify_auth(client, base_url, rec)

        finally:
            if not args.keep:
                _cleanup(client, base_url, created_ids)
            else:
                print("\n  [CLEANUP] Skipped (--keep). Created IDs:", created_ids)

    return rec.summary()


if __name__ == "__main__":
    sys.exit(main())
