"""Integration tests for Task 7.6 — 4-stream log endpoints.

Covers:
- GET /experiments/{id}/logs/streams — correct shape, 4 streams
- Truncation when a stream exceeds 5 MB
- Empty stream returns content="" + size_bytes=0
- Auth: log READ is open to any authenticated lab user (shared workspace);
  only mutations (run/stop/delete) stay owner/admin-restricted
- Download endpoint: invalid stream name → 400
- Download endpoint: valid stream → 200 + Content-Disposition header
- Legacy GET /experiments/{id}/logs still returns 2-field shape (regression)
"""

import pytest
from app.models.experiment import Experiment, ExperimentStatus

pytestmark = pytest.mark.integration

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

STREAMS_URL = "/api/experiments/{id}/logs/streams"
DOWNLOAD_URL = "/api/experiments/{id}/logs/streams/{stream}/download"
LEGACY_URL = "/api/experiments/{id}/logs"


def _make_streams_url(exp_id: int) -> str:
    return STREAMS_URL.format(id=exp_id)


def _make_download_url(exp_id: int, stream: str) -> str:
    return DOWNLOAD_URL.format(id=exp_id, stream=stream)


def _make_legacy_url(exp_id: int) -> str:
    return LEGACY_URL.format(id=exp_id)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def mock_docker(monkeypatch):
    """Prevent real Docker calls in all tests in this module."""
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
    """Prevent real file-system freeze during experiment creation."""
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


@pytest.fixture
def stored_experiment(db_session, test_user, create_scenario, create_strategy):
    """Experiment in COMPLETED state with all 4 log streams populated in DB."""
    sc, _, _ = create_scenario("sc-streams")
    st = create_strategy("st-streams")
    exp = Experiment(
        name="exp-streams-test",
        description="test",
        scenario_id=sc.id,
        strategy_id=st.id,
        status=ExperimentStatus.COMPLETED,
        created_by=test_user.id,
        seed=1,
        batsim_logs="BatSim stdout line 1\nBatSim stdout line 2\n",
        batsim_stderr="BatSim stderr line 1\n",
        pybatsim_logs="PyBatsim stdout line 1\n",
        pybatsim_stderr="PyBatsim stderr line 1\nPyBatsim stderr line 2\n",
    )
    db_session.add(exp)
    db_session.commit()
    db_session.refresh(exp)
    return exp


@pytest.fixture
def empty_stream_experiment(db_session, test_user, create_scenario, create_strategy):
    """Experiment with all 4 log stream columns empty/NULL."""
    sc, _, _ = create_scenario("sc-empty-streams")
    st = create_strategy("st-empty-streams")
    exp = Experiment(
        name="exp-empty-streams",
        description="test",
        scenario_id=sc.id,
        strategy_id=st.id,
        status=ExperimentStatus.COMPLETED,
        created_by=test_user.id,
        seed=2,
        batsim_logs=None,
        batsim_stderr=None,
        pybatsim_logs=None,
        pybatsim_stderr=None,
    )
    db_session.add(exp)
    db_session.commit()
    db_session.refresh(exp)
    return exp


@pytest.fixture
def large_stream_experiment(db_session, test_user, create_scenario, create_strategy):
    """Experiment where batsim_stderr exceeds 5 MB to test truncation."""
    sc, _, _ = create_scenario("sc-large-streams")
    st = create_strategy("st-large-streams")
    # Generate content that is clearly > 5 MB
    large_content = "X" * (6 * 1024 * 1024)  # 6 MB of ASCII 'X'
    exp = Experiment(
        name="exp-large-stream",
        description="test",
        scenario_id=sc.id,
        strategy_id=st.id,
        status=ExperimentStatus.COMPLETED,
        created_by=test_user.id,
        seed=3,
        batsim_logs="small stdout",
        batsim_stderr=large_content,
        pybatsim_logs="small pybatsim stdout",
        pybatsim_stderr=None,
    )
    db_session.add(exp)
    db_session.commit()
    db_session.refresh(exp)
    return exp


@pytest.fixture
def other_user_experiment(db_session, test_admin, create_scenario, create_strategy):
    """Experiment owned by admin, used to test non-creator read access (now allowed under shared-workspace read)."""
    sc, _, _ = create_scenario("sc-other")
    st = create_strategy("st-other")
    exp = Experiment(
        name="exp-other-user",
        description="test",
        scenario_id=sc.id,
        strategy_id=st.id,
        status=ExperimentStatus.COMPLETED,
        created_by=test_admin.id,
        seed=4,
        batsim_logs="admin log",
    )
    db_session.add(exp)
    db_session.commit()
    db_session.refresh(exp)
    return exp


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------

class TestLogStreamsEndpoint:
    """GET /experiments/{id}/logs/streams"""

    def test_all_4_streams_present_with_correct_shape(
        self, client, auth_headers, stored_experiment
    ):
        """Stored experiment with 4 streams: endpoint returns all 4 with correct shape."""
        res = client.get(_make_streams_url(stored_experiment.id), headers=auth_headers)
        assert res.status_code == 200
        data = res.json()

        for stream_name in ["batsim_stdout", "batsim_stderr", "pybatsim_stdout", "pybatsim_stderr"]:
            assert stream_name in data, f"Missing stream: {stream_name}"
            stream = data[stream_name]
            assert "content" in stream
            assert "truncated" in stream
            assert "size_bytes" in stream
            assert isinstance(stream["content"], str)
            assert isinstance(stream["truncated"], bool)
            assert isinstance(stream["size_bytes"], int)

        assert "live" in data
        assert data["live"] is False

    def test_stream_content_matches_stored_values(
        self, client, auth_headers, stored_experiment
    ):
        """Content fields match exactly what was stored in DB columns."""
        res = client.get(_make_streams_url(stored_experiment.id), headers=auth_headers)
        assert res.status_code == 200
        data = res.json()

        assert "BatSim stdout" in data["batsim_stdout"]["content"]
        assert "BatSim stderr" in data["batsim_stderr"]["content"]
        assert "PyBatsim stdout" in data["pybatsim_stdout"]["content"]
        assert "PyBatsim stderr" in data["pybatsim_stderr"]["content"]

    def test_empty_streams_return_empty_content(
        self, client, auth_headers, empty_stream_experiment
    ):
        """Empty/NULL streams return content='', truncated=false, size_bytes=0."""
        res = client.get(_make_streams_url(empty_stream_experiment.id), headers=auth_headers)
        assert res.status_code == 200
        data = res.json()

        for stream_name in ["batsim_stdout", "batsim_stderr", "pybatsim_stdout", "pybatsim_stderr"]:
            stream = data[stream_name]
            assert stream["content"] == "", f"{stream_name} should have empty content"
            assert stream["truncated"] is False
            assert stream["size_bytes"] == 0

    def test_stream_over_5mb_is_truncated(
        self, client, auth_headers, large_stream_experiment
    ):
        """Stream content >5MB: truncated=true, size_bytes=full pre-cap size, content<=5MB."""
        _5MB = 5 * 1024 * 1024
        res = client.get(_make_streams_url(large_stream_experiment.id), headers=auth_headers)
        assert res.status_code == 200
        data = res.json()

        stderr_stream = data["batsim_stderr"]
        assert stderr_stream["truncated"] is True
        # size_bytes reflects full pre-truncation size (6 MB stored)
        assert stderr_stream["size_bytes"] > _5MB
        # returned content is capped at 5 MB
        assert len(stderr_stream["content"].encode("utf-8")) <= _5MB

        # Streams that are small should NOT be truncated
        assert data["batsim_stdout"]["truncated"] is False
        assert data["pybatsim_stdout"]["truncated"] is False

    def test_auth_non_creator_can_read_streams(
        self, client, auth_headers, other_user_experiment
    ):
        """Log read is open to any authenticated lab user (shared workspace):
        a non-creator/non-admin reading another user's streams gets 200.
        (Mutations stay owner/admin-restricted — see experiments API tests.)"""
        res = client.get(_make_streams_url(other_user_experiment.id), headers=auth_headers)
        assert res.status_code == 200

    def test_auth_admin_can_access_any_experiment(
        self, client, admin_headers, other_user_experiment
    ):
        """Admin can access any experiment's streams regardless of ownership."""
        res = client.get(_make_streams_url(other_user_experiment.id), headers=admin_headers)
        assert res.status_code == 200

    def test_not_found_returns_404(self, client, auth_headers):
        """Non-existent experiment returns 404."""
        res = client.get(_make_streams_url(99999), headers=auth_headers)
        assert res.status_code == 404

    def test_unauthenticated_returns_401(self, client, stored_experiment):
        """No auth token → 401."""
        res = client.get(_make_streams_url(stored_experiment.id))
        assert res.status_code == 401


class TestDownloadEndpoint:
    """GET /experiments/{id}/logs/streams/{stream}/download"""

    def test_valid_stream_returns_200_with_content_disposition(
        self, client, auth_headers, stored_experiment
    ):
        """Valid stream name → 200 with attachment Content-Disposition header."""
        exp_id = stored_experiment.id
        res = client.get(
            _make_download_url(exp_id, "batsim_stdout"),
            headers=auth_headers,
        )
        assert res.status_code == 200
        assert "Content-Disposition" in res.headers
        cd = res.headers["Content-Disposition"]
        assert "attachment" in cd
        assert f"exp-{exp_id}-batsim_stdout.txt" in cd

    def test_all_valid_stream_names_are_accepted(
        self, client, auth_headers, stored_experiment
    ):
        """All 4 known stream names return 200."""
        valid_names = ["batsim_stdout", "batsim_stderr", "pybatsim_stdout", "pybatsim_stderr"]
        for stream_name in valid_names:
            res = client.get(
                _make_download_url(stored_experiment.id, stream_name),
                headers=auth_headers,
            )
            assert res.status_code == 200, f"Expected 200 for {stream_name}, got {res.status_code}"

    def test_invalid_stream_name_returns_400(
        self, client, auth_headers, stored_experiment
    ):
        """Unknown/invalid stream name → 400."""
        for bad_name in ["merged", "all", "batsim", "stdout", "foobar"]:
            res = client.get(
                _make_download_url(stored_experiment.id, bad_name),
                headers=auth_headers,
            )
            assert res.status_code == 400, f"Expected 400 for '{bad_name}', got {res.status_code}"

    def test_download_content_matches_stream_content(
        self, client, auth_headers, stored_experiment
    ):
        """Downloaded content matches what /logs/streams returns for same stream."""
        exp_id = stored_experiment.id
        streams_res = client.get(_make_streams_url(exp_id), headers=auth_headers)
        download_res = client.get(
            _make_download_url(exp_id, "batsim_stdout"),
            headers=auth_headers,
        )
        assert download_res.status_code == 200
        expected_content = streams_res.json()["batsim_stdout"]["content"]
        assert download_res.text == expected_content

    def test_download_auth_non_creator_allowed(
        self, client, auth_headers, other_user_experiment
    ):
        """Log download is open to any authenticated lab user (shared workspace):
        a non-creator/non-admin download attempt gets 200."""
        res = client.get(
            _make_download_url(other_user_experiment.id, "batsim_stdout"),
            headers=auth_headers,
        )
        assert res.status_code == 200


class TestLegacyLogsEndpoint:
    """Regression: GET /experiments/{id}/logs still works (2-field shape)."""

    def test_legacy_logs_returns_200_with_2_field_shape(
        self, client, auth_headers, stored_experiment
    ):
        """Legacy /logs endpoint returns 200 with batsim_logs + pybatsim_logs + live."""
        res = client.get(_make_legacy_url(stored_experiment.id), headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert "batsim_logs" in data
        assert "pybatsim_logs" in data
        assert "live" in data
        assert data["live"] is False

    def test_legacy_logs_content_is_strings(
        self, client, auth_headers, stored_experiment
    ):
        """Legacy endpoint returns string values for both log fields."""
        res = client.get(_make_legacy_url(stored_experiment.id), headers=auth_headers)
        data = res.json()
        assert isinstance(data["batsim_logs"], str)
        assert isinstance(data["pybatsim_logs"], str)

    def test_legacy_logs_does_not_have_4_stream_fields(
        self, client, auth_headers, stored_experiment
    ):
        """Legacy endpoint response does NOT contain 4-stream keys (shape unchanged)."""
        res = client.get(_make_legacy_url(stored_experiment.id), headers=auth_headers)
        data = res.json()
        assert "batsim_stdout" not in data
        assert "batsim_stderr" not in data
