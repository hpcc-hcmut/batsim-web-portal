"""Integration tests for strategies API endpoints."""

import io
import pytest
from tests.conftest import SAMPLE_STRATEGY_PY

pytestmark = pytest.mark.integration


def _upload_strategy(client, headers, name="st-test", content=None):
    data = content or SAMPLE_STRATEGY_PY
    return client.post(
        "/api/strategies/",
        headers=headers,
        data={"name": name},
        files={"file": (f"{name}.py", io.BytesIO(data.encode()), "text/x-python")},
    )


class TestStrategiesCRUD:

    def test_create_strategy_valid(self, client, auth_headers, tmp_storage):
        res = _upload_strategy(client, auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["name"] == "st-test"
        assert data["version"] == 1

    def test_create_strategy_invalid_python(self, client, auth_headers, tmp_storage):
        res = _upload_strategy(client, auth_headers, "bad", "print('no scheduler class')")
        assert res.status_code == 422

    def test_create_strategy_wrong_extension(self, client, auth_headers, tmp_storage):
        res = client.post(
            "/api/strategies/",
            headers=auth_headers,
            data={"name": "bad"},
            files={"file": ("bad.txt", io.BytesIO(b"hello"), "text/plain")},
        )
        assert res.status_code == 422

    def test_create_strategy_duplicate_name(self, client, auth_headers, tmp_storage):
        _upload_strategy(client, auth_headers, "dup")
        res = _upload_strategy(client, auth_headers, "dup")
        assert res.status_code == 400

    def test_list_strategies(self, client, auth_headers, tmp_storage):
        _upload_strategy(client, auth_headers, "a")
        _upload_strategy(client, auth_headers, "b")
        res = client.get("/api/strategies/", headers=auth_headers)
        assert res.status_code == 200
        assert len(res.json()) >= 2

    def test_get_strategy_by_id(self, client, auth_headers, tmp_storage):
        created = _upload_strategy(client, auth_headers).json()
        res = client.get(f"/api/strategies/{created['id']}", headers=auth_headers)
        assert res.status_code == 200

    def test_get_strategy_not_found(self, client, auth_headers):
        res = client.get("/api/strategies/9999", headers=auth_headers)
        assert res.status_code == 404

    def test_update_strategy(self, client, auth_headers, tmp_storage):
        created = _upload_strategy(client, auth_headers).json()
        res = client.put(
            f"/api/strategies/{created['id']}",
            headers=auth_headers,
            json={"name": "updated"},
        )
        assert res.status_code == 200
        assert res.json()["name"] == "updated"

    def test_delete_strategy(self, client, auth_headers, tmp_storage):
        created = _upload_strategy(client, auth_headers).json()
        res = client.delete(f"/api/strategies/{created['id']}", headers=auth_headers)
        assert res.status_code == 200
