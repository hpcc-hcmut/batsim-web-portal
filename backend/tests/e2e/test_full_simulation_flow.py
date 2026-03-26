"""API flow test: full CRUD + lifecycle pipeline via TestClient.

Exercises the complete API flow: register → login → upload → scenario →
experiment → start → poll → results. The Docker orchestrator is mocked
(the real orchestrator spawns a background thread with its own SessionLocal
which cannot see the in-memory test SQLite). This test validates the API
contract, not Docker orchestration.

For real orchestrator testing, see test_real_orchestrator_e2e.py.
"""

import io
import json
import os
import threading
import time
import pytest

from app.models.experiment import Experiment, ExperimentStatus
from app.models.result import Result

pytestmark = pytest.mark.e2e


def docker_available():
    try:
        import docker
        client = docker.from_env()
        client.ping()
        return True
    except Exception:
        return False


skipif_no_docker = pytest.mark.skipif(
    not docker_available(), reason="Docker not available"
)

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "..", "fixtures")
SAMPLES_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "samples")


def _read_fixture(name):
    """Read fixture file content."""
    for base in [FIXTURES_DIR, SAMPLES_DIR]:
        path = os.path.join(base, name)
        if os.path.exists(path):
            with open(path, "r") as f:
                return f.read()
    return None


def _make_mock_orchestrator(db_session):
    """Create a mock run_experiment that simulates completion in the test DB.

    Runs in a short-lived thread to mimic the real orchestrator's async behavior.
    Updates experiment status to COMPLETED and creates a Result record.
    """
    def mock_run_experiment(experiment_id):
        def _simulate():
            time.sleep(0.5)  # Brief delay to mimic async startup
            exp = db_session.query(Experiment).filter(
                Experiment.id == experiment_id
            ).first()
            if not exp:
                return
            exp.status = ExperimentStatus.COMPLETED
            exp.progress_percentage = 100
            # Create a realistic Result record
            result = Result(
                experiment_id=experiment_id,
                simulation_time=25.0,
                total_jobs=2,
                completed_jobs=2,
                failed_jobs=0,
                makespan=30.0,
                average_waiting_time=2.5,
                average_turnaround_time=12.5,
                resource_utilization=0.65,
                jobs_data="job_id,success,wait_time\n0,1,0.0\n1,1,5.0",
                schedule_data="makespan,nb_jobs\n30.0,2",
                computed_metrics=json.dumps({
                    "success_rate": 1.0,
                    "throughput": 0.067,
                    "consumed_joules": 2500,
                }),
            )
            db_session.add(result)
            db_session.commit()

        t = threading.Thread(target=_simulate, daemon=True)
        t.start()

    return mock_run_experiment


@skipif_no_docker
class TestFullApiFlow:
    """API flow test: register → upload → scenario → experiment → start → results (orchestrator mocked)."""

    POLL_INTERVAL = 1
    POLL_TIMEOUT = 15

    def test_full_flow(self, client, db_session, tmp_storage, monkeypatch):
        """Complete simulation pipeline end-to-end."""
        # Patch where the functions are actually used (already imported into api module)
        monkeypatch.setattr(
            "app.api.experiments.run_experiment",
            _make_mock_orchestrator(db_session),
        )
        monkeypatch.setattr(
            "app.api.experiments.stop_experiment_containers",
            lambda eid: None,
        )
        # Mock bundle service where it's imported
        def fake_freeze(db, experiment_id, scenario_id, strategy_id, seed=None, params=None):
            return {
                "scenario_id": scenario_id,
                "strategy_id": strategy_id,
                "seed": seed,
                "frozen_files": {"workload_path": f"/tmp/test/exp_{experiment_id}/workload.json"},
            }
        monkeypatch.setattr(
            "app.api.experiments.freeze_experiment_config",
            fake_freeze,
        )

        # 1. Register user
        reg = client.post("/api/auth/register", json={
            "username": "e2euser", "email": "e2e@test.com", "password": "e2epass123",
        })
        assert reg.status_code == 200

        # 2. Login
        login = client.post("/api/auth/login-json", json={
            "username": "e2euser", "password": "e2epass123",
        })
        assert login.status_code == 200
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Upload workload
        wl_content = _read_fixture("sample_workload.json")
        assert wl_content is not None, "Missing sample_workload.json fixture"
        wl = client.post(
            "/api/workloads/", headers=headers,
            data={"name": "e2e-workload"},
            files={"file": ("workload.json", io.BytesIO(wl_content.encode()), "application/json")},
        )
        assert wl.status_code == 200, f"Workload upload failed: {wl.text}"
        wl_id = wl.json()["id"]

        # 4. Upload platform
        pl_content = _read_fixture("sample_platform.xml")
        assert pl_content is not None, "Missing sample_platform.xml fixture"
        pl = client.post(
            "/api/platforms/", headers=headers,
            data={"name": "e2e-platform"},
            files={"file": ("platform.xml", io.BytesIO(pl_content.encode()), "application/xml")},
        )
        assert pl.status_code == 200, f"Platform upload failed: {pl.text}"
        pl_id = pl.json()["id"]

        # 5. Upload strategy
        st_content = _read_fixture("sample_strategy.py")
        assert st_content is not None, "Missing sample_strategy.py fixture"
        st = client.post(
            "/api/strategies/", headers=headers,
            data={"name": "e2e-strategy"},
            files={"file": ("strategy.py", io.BytesIO(st_content.encode()), "text/x-python")},
        )
        assert st.status_code == 200, f"Strategy upload failed: {st.text}"
        st_id = st.json()["id"]

        # 6. Create scenario
        sc = client.post("/api/scenarios/", headers=headers, json={
            "name": "e2e-scenario",
            "workload_id": wl_id, "platform_id": pl_id,
        })
        assert sc.status_code == 200
        sc_id = sc.json()["id"]

        # 7. Create experiment
        exp = client.post("/api/experiments/", headers=headers, json={
            "name": "e2e-experiment",
            "scenario_id": sc_id, "strategy_id": st_id, "seed": 42,
        })
        assert exp.status_code == 200
        exp_id = exp.json()["id"]

        # 8. Start experiment
        start = client.post(f"/api/experiments/{exp_id}/start", headers=headers)
        assert start.status_code == 200

        # 9. Poll until completion
        elapsed = 0
        final_status = None
        while elapsed < self.POLL_TIMEOUT:
            time.sleep(self.POLL_INTERVAL)
            elapsed += self.POLL_INTERVAL
            status = client.get(f"/api/experiments/{exp_id}/status", headers=headers)
            assert status.status_code == 200
            final_status = status.json()["status"]
            if final_status in ("completed", "failed", "cancelled"):
                break

        assert final_status == "completed", f"Experiment ended with status={final_status}"

        # 10. Verify result exists
        results = client.get("/api/results/", headers=headers)
        assert results.status_code == 200
        exp_results = [r for r in results.json() if r["experiment_id"] == exp_id]
        assert len(exp_results) >= 1, "No result record created"

        result = exp_results[0]
        assert result["makespan"] is not None
        assert result["makespan"] > 0
        assert result["total_jobs"] > 0
