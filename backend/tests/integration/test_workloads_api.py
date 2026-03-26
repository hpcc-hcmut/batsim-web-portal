"""Integration tests for workloads API endpoints."""

import io
import json
import pytest
from tests.conftest import SAMPLE_WORKLOAD_JSON

pytestmark = pytest.mark.integration


def _upload_workload(client, headers, name="wl-test", content=None):
    """Helper to upload a valid workload."""
    data = content or json.dumps(SAMPLE_WORKLOAD_JSON)
    return client.post(
        "/api/workloads/",
        headers=headers,
        data={"name": name},
        files={"file": (f"{name}.json", io.BytesIO(data.encode()), "application/json")},
    )


class TestWorkloadsCRUD:

    def test_create_workload_valid(self, client, auth_headers, tmp_storage):
        res = _upload_workload(client, auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["name"] == "wl-test"
        assert data["nb_res"] == 4
        assert data["version"] == 1

    def test_create_workload_invalid_json(self, client, auth_headers, tmp_storage):
        res = client.post(
            "/api/workloads/",
            headers=auth_headers,
            data={"name": "bad"},
            files={"file": ("bad.json", io.BytesIO(b'{"not": "valid workload"}'), "application/json")},
        )
        assert res.status_code == 422

    def test_create_workload_wrong_extension(self, client, auth_headers, tmp_storage):
        res = client.post(
            "/api/workloads/",
            headers=auth_headers,
            data={"name": "bad"},
            files={"file": ("bad.txt", io.BytesIO(b"hello"), "text/plain")},
        )
        assert res.status_code == 422

    def test_create_workload_duplicate_name(self, client, auth_headers, tmp_storage):
        _upload_workload(client, auth_headers, "dup")
        res = _upload_workload(client, auth_headers, "dup")
        assert res.status_code == 400
        assert "already exists" in res.json()["detail"]

    def test_list_workloads(self, client, auth_headers, tmp_storage):
        _upload_workload(client, auth_headers, "a")
        _upload_workload(client, auth_headers, "b")
        res = client.get("/api/workloads/", headers=auth_headers)
        assert res.status_code == 200
        assert len(res.json()) >= 2

    def test_get_workload_by_id(self, client, auth_headers, tmp_storage):
        created = _upload_workload(client, auth_headers).json()
        res = client.get(f"/api/workloads/{created['id']}", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["name"] == "wl-test"

    def test_get_workload_not_found(self, client, auth_headers):
        res = client.get("/api/workloads/9999", headers=auth_headers)
        assert res.status_code == 404

    def test_update_workload(self, client, auth_headers, tmp_storage):
        created = _upload_workload(client, auth_headers).json()
        res = client.put(
            f"/api/workloads/{created['id']}",
            headers=auth_headers,
            json={"name": "updated-name"},
        )
        assert res.status_code == 200
        assert res.json()["name"] == "updated-name"

    def test_delete_workload(self, client, auth_headers, tmp_storage):
        created = _upload_workload(client, auth_headers).json()
        res = client.delete(f"/api/workloads/{created['id']}", headers=auth_headers)
        assert res.status_code == 200
        assert "deleted" in res.json()["message"]

    def test_delete_workload_not_found(self, client, auth_headers):
        res = client.delete("/api/workloads/9999", headers=auth_headers)
        assert res.status_code == 404

    def test_unauthenticated(self, client, tmp_storage):
        res = client.post(
            "/api/workloads/",
            data={"name": "no-auth"},
            files={"file": ("test.json", io.BytesIO(b"{}"), "application/json")},
        )
        assert res.status_code == 401
