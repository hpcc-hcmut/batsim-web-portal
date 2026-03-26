"""Integration tests for experiments API endpoints."""

import pytest

pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def mock_docker(monkeypatch):
    """Mock Docker orchestrator functions for all experiment tests."""
    monkeypatch.setattr(
        "app.services.orchestrator.orchestrator_service.run_experiment",
        lambda eid: None,
    )
    monkeypatch.setattr(
        "app.services.orchestrator.orchestrator_service.stop_experiment_containers",
        lambda eid: None,
    )


@pytest.fixture(autouse=True)
def mock_bundle_service(monkeypatch):
    """Mock experiment bundle service to avoid file system deps."""
    def fake_freeze(db, experiment_id, scenario_id, strategy_id, seed=None, params=None):
        return {
            "scenario_id": scenario_id,
            "strategy_id": strategy_id,
            "seed": seed,
            "frozen_files": {"workload_path": f"/tmp/test/exp_{experiment_id}/workload.json"},
        }
    monkeypatch.setattr(
        "app.services.experiment_bundle_service.freeze_experiment_config",
        fake_freeze,
    )


def _create_experiment(client, headers, scenario_id, strategy_id, name="exp-test", seed=42):
    return client.post("/api/experiments/", headers=headers, json={
        "name": name, "description": "test",
        "scenario_id": scenario_id, "strategy_id": strategy_id,
        "seed": seed,
    })


class TestExperimentsCRUD:

    def test_create_experiment(self, client, auth_headers, create_scenario, create_strategy):
        sc, _, _ = create_scenario("sc-exp")
        st = create_strategy("st-exp")
        res = _create_experiment(client, auth_headers, sc.id, st.id)
        assert res.status_code == 200
        data = res.json()
        assert data["name"] == "exp-test"
        assert data["status"] == "pending"
        assert data["seed"] == 42

    def test_create_experiment_invalid_scenario(self, client, auth_headers, create_strategy):
        st = create_strategy("st-inv")
        res = _create_experiment(client, auth_headers, 9999, st.id)
        assert res.status_code == 400

    def test_list_experiments(self, client, auth_headers, create_scenario, create_strategy):
        sc, _, _ = create_scenario("sc-ls")
        st = create_strategy("st-ls")
        _create_experiment(client, auth_headers, sc.id, st.id, "a")
        _create_experiment(client, auth_headers, sc.id, st.id, "b")
        res = client.get("/api/experiments/", headers=auth_headers)
        assert res.status_code == 200
        assert len(res.json()) >= 2

    def test_get_experiment_by_id(self, client, auth_headers, create_scenario, create_strategy):
        sc, _, _ = create_scenario("sc-get")
        st = create_strategy("st-get")
        created = _create_experiment(client, auth_headers, sc.id, st.id).json()
        res = client.get(f"/api/experiments/{created['id']}", headers=auth_headers)
        assert res.status_code == 200

    def test_get_experiment_not_found(self, client, auth_headers):
        res = client.get("/api/experiments/9999", headers=auth_headers)
        assert res.status_code == 404

    def test_update_experiment(self, client, auth_headers, create_scenario, create_strategy):
        sc, _, _ = create_scenario("sc-upd")
        st = create_strategy("st-upd")
        created = _create_experiment(client, auth_headers, sc.id, st.id).json()
        res = client.put(f"/api/experiments/{created['id']}", headers=auth_headers, json={
            "name": "updated", "description": "new desc",
        })
        assert res.status_code == 200
        assert res.json()["name"] == "updated"

    def test_delete_experiment(self, client, auth_headers, create_scenario, create_strategy, tmp_storage):
        sc, _, _ = create_scenario("sc-del")
        st = create_strategy("st-del")
        created = _create_experiment(client, auth_headers, sc.id, st.id).json()
        res = client.delete(f"/api/experiments/{created['id']}", headers=auth_headers)
        assert res.status_code == 200


class TestExperimentLifecycle:

    def test_start_experiment(self, client, auth_headers, create_scenario, create_strategy):
        sc, _, _ = create_scenario("sc-start")
        st = create_strategy("st-start")
        created = _create_experiment(client, auth_headers, sc.id, st.id).json()
        res = client.post(f"/api/experiments/{created['id']}/start", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] in ("running", "queued")

    def test_start_experiment_already_running(self, client, auth_headers, create_scenario, create_strategy):
        sc, _, _ = create_scenario("sc-dup-start")
        st = create_strategy("st-dup-start")
        created = _create_experiment(client, auth_headers, sc.id, st.id).json()
        client.post(f"/api/experiments/{created['id']}/start", headers=auth_headers)
        res = client.post(f"/api/experiments/{created['id']}/start", headers=auth_headers)
        assert res.status_code == 400

    def test_get_experiment_status(self, client, auth_headers, create_scenario, create_strategy):
        sc, _, _ = create_scenario("sc-stat")
        st = create_strategy("st-stat")
        created = _create_experiment(client, auth_headers, sc.id, st.id).json()
        res = client.get(f"/api/experiments/{created['id']}/status", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert "status" in data
        assert "progress_percentage" in data

    def test_get_experiment_logs(self, client, auth_headers, create_scenario, create_strategy):
        sc, _, _ = create_scenario("sc-log")
        st = create_strategy("st-log")
        created = _create_experiment(client, auth_headers, sc.id, st.id).json()
        res = client.get(f"/api/experiments/{created['id']}/logs", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert "batsim_logs" in data
        assert "pybatsim_logs" in data

    def test_get_experiment_queue(self, client, auth_headers):
        res = client.get("/api/experiments/queue", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert "running" in data or "max_concurrent" in data
