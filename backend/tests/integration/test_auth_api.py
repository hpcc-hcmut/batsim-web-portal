"""Integration tests for auth API endpoints."""

import pytest

pytestmark = pytest.mark.integration


class TestRegister:

    def test_register_new_user(self, client):
        res = client.post("/api/auth/register", json={
            "username": "newuser", "email": "new@test.com", "password": "pass123",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["username"] == "newuser"
        assert data["email"] == "new@test.com"
        assert "id" in data

    def test_register_duplicate_username(self, client, test_user):
        res = client.post("/api/auth/register", json={
            "username": "testuser", "email": "other@test.com", "password": "pass123",
        })
        assert res.status_code == 400
        assert "already registered" in res.json()["detail"]

    def test_register_duplicate_email(self, client, test_user):
        res = client.post("/api/auth/register", json={
            "username": "other", "email": "test@test.com", "password": "pass123",
        })
        assert res.status_code == 400
        assert "already registered" in res.json()["detail"]


class TestLogin:

    def test_login_success(self, client, test_user):
        res = client.post("/api/auth/login", data={
            "username": "testuser", "password": "testpass123",
        })
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client, test_user):
        res = client.post("/api/auth/login", data={
            "username": "testuser", "password": "wrongpass",
        })
        assert res.status_code == 401

    def test_login_nonexistent_user(self, client):
        res = client.post("/api/auth/login", data={
            "username": "ghost", "password": "pass123",
        })
        assert res.status_code == 401

    def test_login_json_success(self, client, test_user):
        res = client.post("/api/auth/login-json", json={
            "username": "testuser", "password": "testpass123",
        })
        assert res.status_code == 200
        assert "access_token" in res.json()

    def test_token_endpoint(self, client, test_user):
        res = client.post("/api/auth/token", data={
            "username": "testuser", "password": "testpass123",
        })
        assert res.status_code == 200
        assert "access_token" in res.json()


class TestMe:

    def test_get_me_authenticated(self, client, auth_headers):
        res = client.get("/api/auth/me", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["username"] == "testuser"

    def test_get_me_no_token(self, client):
        res = client.get("/api/auth/me")
        assert res.status_code == 401

    def test_get_me_invalid_token(self, client):
        res = client.get("/api/auth/me", headers={"Authorization": "Bearer invalidtoken"})
        assert res.status_code == 401
