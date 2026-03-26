"""Integration tests for platforms API endpoints."""

import io
import pytest
from tests.conftest import SAMPLE_PLATFORM_XML

pytestmark = pytest.mark.integration


def _upload_platform(client, headers, name="pl-test", content=None):
    data = content or SAMPLE_PLATFORM_XML
    return client.post(
        "/api/platforms/",
        headers=headers,
        data={"name": name},
        files={"file": (f"{name}.xml", io.BytesIO(data.encode()), "application/xml")},
    )


class TestPlatformsCRUD:

    def test_create_platform_valid(self, client, auth_headers, tmp_storage):
        res = _upload_platform(client, auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["name"] == "pl-test"
        assert data["nb_hosts"] is not None
        assert data["version"] == 1

    def test_create_platform_invalid_xml(self, client, auth_headers, tmp_storage):
        res = _upload_platform(client, auth_headers, "bad", "<not>valid</not>")
        assert res.status_code == 422

    def test_create_platform_wrong_extension(self, client, auth_headers, tmp_storage):
        res = client.post(
            "/api/platforms/",
            headers=auth_headers,
            data={"name": "bad"},
            files={"file": ("bad.txt", io.BytesIO(b"hello"), "text/plain")},
        )
        assert res.status_code == 422

    def test_create_platform_duplicate_name(self, client, auth_headers, tmp_storage):
        _upload_platform(client, auth_headers, "dup")
        res = _upload_platform(client, auth_headers, "dup")
        assert res.status_code == 400

    def test_list_platforms(self, client, auth_headers, tmp_storage):
        _upload_platform(client, auth_headers, "a")
        _upload_platform(client, auth_headers, "b")
        res = client.get("/api/platforms/", headers=auth_headers)
        assert res.status_code == 200
        assert len(res.json()) >= 2

    def test_get_platform_by_id(self, client, auth_headers, tmp_storage):
        created = _upload_platform(client, auth_headers).json()
        res = client.get(f"/api/platforms/{created['id']}", headers=auth_headers)
        assert res.status_code == 200

    def test_get_platform_not_found(self, client, auth_headers):
        res = client.get("/api/platforms/9999", headers=auth_headers)
        assert res.status_code == 404

    def test_update_platform(self, client, auth_headers, tmp_storage):
        created = _upload_platform(client, auth_headers).json()
        res = client.put(
            f"/api/platforms/{created['id']}",
            headers=auth_headers,
            json={"name": "updated"},
        )
        assert res.status_code == 200
        assert res.json()["name"] == "updated"

    def test_delete_platform(self, client, auth_headers, tmp_storage):
        created = _upload_platform(client, auth_headers).json()
        res = client.delete(f"/api/platforms/{created['id']}", headers=auth_headers)
        assert res.status_code == 200
