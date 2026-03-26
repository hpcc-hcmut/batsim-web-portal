"""Real orchestrator E2E test: actual Docker containers + real server.

Starts a real uvicorn server with a file-based SQLite DB, uploads real
BatSim-compatible files, starts an experiment, and lets the orchestrator
run real BatSim/PyBatsim Docker containers. Validates the full pipeline
end-to-end without any mocks.

Requirements:
- Docker running
- oarteam/batsim:latest image pulled
- tanaxer/pybatsim:latest image pulled

Run explicitly: pytest -m e2e_docker
"""

import io
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import pytest
import requests

pytestmark = pytest.mark.e2e_docker

# Paths to real sample files (proven to work with BatSim)
SAMPLES_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "samples")
FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "..", "fixtures")

# Server config
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 18765  # Non-standard port to avoid conflicts
BASE_URL = f"http://{SERVER_HOST}:{SERVER_PORT}"
API = f"{BASE_URL}/api"


def _docker_and_images_available():
    """Check Docker is running and BatSim images are pulled."""
    try:
        import docker
        client = docker.from_env()
        client.ping()
        images = [img.tags for img in client.images.list()]
        flat_tags = [tag for tags in images for tag in tags]
        has_batsim = any("batsim" in t and "oarteam" in t for t in flat_tags)
        has_pybatsim = any("pybatsim" in t and "tanaxer" in t for t in flat_tags)
        return has_batsim and has_pybatsim
    except Exception:
        return False


skipif_no_images = pytest.mark.skipif(
    not _docker_and_images_available(),
    reason="Docker not available or BatSim/PyBatsim images not pulled",
)


def _read_file(name, search_dirs=None):
    """Read file content from fixture or samples directories."""
    dirs = search_dirs or [FIXTURES_DIR, SAMPLES_DIR]
    for base in dirs:
        path = os.path.join(base, name)
        if os.path.exists(path):
            with open(path, "r") as f:
                return f.read()
    return None


def _read_file_from(path):
    """Read file content from an exact path."""
    if os.path.exists(path):
        with open(path, "r") as f:
            return f.read()
    return None


@skipif_no_images
class TestRealOrchestratorE2E:
    """Real E2E: runs actual BatSim/PyBatsim containers via the orchestrator."""

    POLL_INTERVAL = 5
    POLL_TIMEOUT = 180  # BatSim simulation can take up to 3 min
    SERVER_STARTUP_TIMEOUT = 15

    @pytest.fixture(autouse=True)
    def setup_server(self, tmp_path):
        """Start a real uvicorn server with file-based SQLite in a temp dir."""
        self.tmp_dir = tmp_path
        self.db_path = str(tmp_path / "test_e2e.db")
        self.storage_path = str(tmp_path / "storage")
        self.sim_data_path = str(tmp_path / "storage" / "experiments")
        os.makedirs(self.storage_path, exist_ok=True)
        os.makedirs(self.sim_data_path, exist_ok=True)

        # Environment for the subprocess server
        # Use WAL mode timeout to prevent SQLite blocking between threads
        env = os.environ.copy()
        env["DATABASE_URL"] = f"sqlite:///{self.db_path}"
        env["STORAGE_PATH"] = self.storage_path
        env["SIMULATION_DATA_PATH"] = self.sim_data_path
        env["SECRET_KEY"] = "test-e2e-secret-key"
        env["BATSIM_IMAGE"] = "oarteam/batsim:latest"
        env["PYBATSIM_IMAGE"] = "tanaxer/pybatsim:latest"
        env["SIMULATION_TIMEOUT_SECONDS"] = "300"

        # Start uvicorn
        backend_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..")
        )
        self.server_proc = subprocess.Popen(
            [
                sys.executable, "-m", "uvicorn",
                "app.main:app",
                "--host", SERVER_HOST,
                "--port", str(SERVER_PORT),
                "--log-level", "info",
            ],
            cwd=backend_dir,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
        )

        # Wait for server to be ready
        ready = False
        for _ in range(self.SERVER_STARTUP_TIMEOUT * 2):
            try:
                r = requests.get(f"{BASE_URL}/health", timeout=1)
                if r.status_code == 200:
                    ready = True
                    break
            except requests.ConnectionError:
                pass
            time.sleep(0.5)

        if not ready:
            # Dump server output for debugging
            self.server_proc.kill()
            stdout = self.server_proc.stdout.read().decode("utf-8", errors="replace")
            pytest.fail(f"Server failed to start within {self.SERVER_STARTUP_TIMEOUT}s.\n{stdout}")

        yield

        # Teardown: stop server
        if sys.platform == "win32":
            self.server_proc.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            self.server_proc.terminate()
        try:
            self.server_proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.server_proc.kill()
            self.server_proc.wait()

    # All HTTP calls use this timeout to avoid hanging on blocked server
    REQUEST_TIMEOUT = 30

    def _register_and_login(self):
        """Register a test user and return auth headers."""
        requests.post(f"{API}/auth/register", json={
            "username": "e2e_docker_user",
            "email": "e2e_docker@test.com",
            "password": "e2epass123",
        }, timeout=self.REQUEST_TIMEOUT)
        login = requests.post(f"{API}/auth/login-json", json={
            "username": "e2e_docker_user",
            "password": "e2epass123",
        }, timeout=self.REQUEST_TIMEOUT)
        assert login.status_code == 200, f"Login failed: {login.text}"
        token = login.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def _upload_workload(self, headers):
        """Upload the sample workload and return its ID."""
        content = _read_file("sample_workload.json")
        assert content, "Missing sample_workload.json"
        r = requests.post(
            f"{API}/workloads/",
            headers=headers,
            data={"name": "e2e-docker-workload"},
            files={"file": ("workload.json", io.BytesIO(content.encode()), "application/json")},
            timeout=self.REQUEST_TIMEOUT,
        )
        assert r.status_code == 200, f"Workload upload failed: {r.text}"
        return r.json()["id"]

    def _upload_platform(self, headers):
        """Upload BatSim-compatible platform and return its ID."""
        # Use batsim_platform.xml which uses SimGrid v4 AS syntax (not v4.1 zone)
        content = _read_file("batsim_platform.xml")
        assert content, "Missing batsim_platform.xml"
        r = requests.post(
            f"{API}/platforms/",
            headers=headers,
            data={"name": "e2e-docker-platform"},
            files={"file": ("platform.xml", io.BytesIO(content.encode()), "application/xml")},
            timeout=self.REQUEST_TIMEOUT,
        )
        assert r.status_code == 200, f"Platform upload failed: {r.text}"
        return r.json()["id"]

    def _upload_strategy(self, headers):
        """Upload the filler strategy (proven with real BatSim) and return its ID."""
        content = _read_file_from(
            os.path.join(SAMPLES_DIR, "strategies", "filler.py")
        )
        assert content, "Missing samples/strategies/filler.py"
        r = requests.post(
            f"{API}/strategies/",
            headers=headers,
            data={"name": "e2e-docker-filler"},
            files={"file": ("filler.py", io.BytesIO(content.encode()), "text/x-python")},
            timeout=self.REQUEST_TIMEOUT,
        )
        assert r.status_code == 200, f"Strategy upload failed: {r.text}"
        return r.json()["id"]

    def test_real_docker_simulation(self):
        """Full E2E: real server, real DB, real Docker containers."""
        headers = self._register_and_login()

        # Upload artifacts
        wl_id = self._upload_workload(headers)
        pl_id = self._upload_platform(headers)
        st_id = self._upload_strategy(headers)

        # Create scenario
        sc = requests.post(f"{API}/scenarios/", headers=headers, json={
            "name": "e2e-docker-scenario",
            "workload_id": wl_id,
            "platform_id": pl_id,
        }, timeout=self.REQUEST_TIMEOUT)
        assert sc.status_code == 200, f"Scenario creation failed: {sc.text}"
        sc_id = sc.json()["id"]

        # Create experiment
        exp = requests.post(f"{API}/experiments/", headers=headers, json={
            "name": "e2e-docker-experiment",
            "scenario_id": sc_id,
            "strategy_id": st_id,
            "seed": 42,
        }, timeout=self.REQUEST_TIMEOUT)
        assert exp.status_code == 200, f"Experiment creation failed: {exp.text}"
        exp_id = exp.json()["id"]

        # Start experiment — this triggers real Docker containers
        start = requests.post(
            f"{API}/experiments/{exp_id}/start", headers=headers,
            timeout=self.REQUEST_TIMEOUT,
        )
        assert start.status_code == 200, f"Experiment start failed: {start.text}"

        # Poll until completion or failure
        elapsed = 0
        final_status = None
        while elapsed < self.POLL_TIMEOUT:
            time.sleep(self.POLL_INTERVAL)
            elapsed += self.POLL_INTERVAL
            try:
                status_resp = requests.get(
                    f"{API}/experiments/{exp_id}/status", headers=headers,
                    timeout=self.REQUEST_TIMEOUT,
                )
                assert status_resp.status_code == 200
                final_status = status_resp.json()["status"]
                if final_status in ("completed", "failed", "cancelled"):
                    break
            except requests.Timeout:
                continue  # Server busy with Docker ops, retry

        # If failed, wait briefly for DB lock release, then fetch details
        if final_status != "completed":
            time.sleep(5)  # Let orchestrator finish cleanup and release DB lock
            try:
                logs_resp = requests.get(
                    f"{API}/experiments/{exp_id}/logs", headers=headers,
                    timeout=self.REQUEST_TIMEOUT,
                )
                logs_info = logs_resp.json() if logs_resp.status_code == 200 else "No logs"
            except Exception:
                logs_info = "Could not fetch logs"
            try:
                exp_resp = requests.get(
                    f"{API}/experiments/{exp_id}", headers=headers,
                    timeout=self.REQUEST_TIMEOUT,
                )
                exp_info = exp_resp.json() if exp_resp.status_code == 200 else "No exp info"
            except Exception:
                exp_info = "Could not fetch experiment"
            pytest.fail(
                f"Experiment ended with status={final_status}\n"
                f"Experiment: {exp_info}\n"
                f"Logs: {logs_info}"
            )

        assert final_status == "completed"

        # Verify result was created by post-processing
        results_resp = requests.get(
            f"{API}/results/", headers=headers, timeout=self.REQUEST_TIMEOUT
        )
        assert results_resp.status_code == 200
        exp_results = [
            r for r in results_resp.json() if r["experiment_id"] == exp_id
        ]
        assert len(exp_results) >= 1, "No result record created by post-processing"

        result = exp_results[0]
        assert result["total_jobs"] == 2  # Our sample workload has 2 jobs
        assert result["makespan"] is not None
        assert result["makespan"] > 0

        # Verify experiment logs were captured
        logs = requests.get(
            f"{API}/experiments/{exp_id}/logs", headers=headers,
            timeout=self.REQUEST_TIMEOUT,
        )
        assert logs.status_code == 200
