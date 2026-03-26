"""Integration tests for scenarios API endpoints."""

import pytest

pytestmark = pytest.mark.integration


class TestScenariosCRUD:

    def test_create_scenario_valid(self, client, auth_headers, create_workload, create_platform):
        wl = create_workload("wl-sc")
        pl = create_platform("pl-sc")
        res = client.post("/api/scenarios/", headers=auth_headers, json={
            "name": "test-scenario", "description": "desc",
            "workload_id": wl.id, "platform_id": pl.id,
        })
        assert res.status_code == 200
        data = res.json()
        assert data["name"] == "test-scenario"
        assert data["workload_id"] == wl.id
        assert data["platform_id"] == pl.id

    def test_create_scenario_invalid_workload(self, client, auth_headers, create_platform):
        pl = create_platform("pl-inv")
        res = client.post("/api/scenarios/", headers=auth_headers, json={
            "name": "bad", "workload_id": 9999, "platform_id": pl.id,
        })
        assert res.status_code == 400

    def test_create_scenario_invalid_platform(self, client, auth_headers, create_workload):
        wl = create_workload("wl-inv")
        res = client.post("/api/scenarios/", headers=auth_headers, json={
            "name": "bad", "workload_id": wl.id, "platform_id": 9999,
        })
        assert res.status_code == 400

    def test_list_scenarios(self, client, auth_headers, create_workload, create_platform):
        wl = create_workload("wl-ls")
        pl = create_platform("pl-ls")
        client.post("/api/scenarios/", headers=auth_headers, json={
            "name": "sc-a", "workload_id": wl.id, "platform_id": pl.id,
        })
        client.post("/api/scenarios/", headers=auth_headers, json={
            "name": "sc-b", "workload_id": wl.id, "platform_id": pl.id,
        })
        res = client.get("/api/scenarios/", headers=auth_headers)
        assert res.status_code == 200
        assert len(res.json()) >= 2

    def test_get_scenario_by_id(self, client, auth_headers, create_workload, create_platform):
        wl = create_workload("wl-get")
        pl = create_platform("pl-get")
        created = client.post("/api/scenarios/", headers=auth_headers, json={
            "name": "sc-get", "workload_id": wl.id, "platform_id": pl.id,
        }).json()
        res = client.get(f"/api/scenarios/{created['id']}", headers=auth_headers)
        assert res.status_code == 200

    def test_get_scenario_not_found(self, client, auth_headers):
        res = client.get("/api/scenarios/9999", headers=auth_headers)
        assert res.status_code == 404

    def test_update_scenario(self, client, auth_headers, create_workload, create_platform):
        wl = create_workload("wl-upd")
        pl = create_platform("pl-upd")
        created = client.post("/api/scenarios/", headers=auth_headers, json={
            "name": "sc-upd", "workload_id": wl.id, "platform_id": pl.id,
        }).json()
        res = client.put(f"/api/scenarios/{created['id']}", headers=auth_headers, json={
            "name": "updated",
        })
        assert res.status_code == 200
        assert res.json()["name"] == "updated"

    def test_delete_scenario(self, client, auth_headers, create_workload, create_platform):
        wl = create_workload("wl-del")
        pl = create_platform("pl-del")
        created = client.post("/api/scenarios/", headers=auth_headers, json={
            "name": "sc-del", "workload_id": wl.id, "platform_id": pl.id,
        }).json()
        res = client.delete(f"/api/scenarios/{created['id']}", headers=auth_headers)
        assert res.status_code == 200
