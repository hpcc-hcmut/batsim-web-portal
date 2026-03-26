"""Integration tests for results API endpoints."""

import json
import pytest
from app.models.result import Result

pytestmark = pytest.mark.integration


def _create_result(db_session, experiment_id, makespan=100.0, jobs_data=None, computed_metrics=None):
    """Insert a Result directly in DB for testing."""
    result = Result(
        experiment_id=experiment_id,
        simulation_time=50.0,
        total_jobs=10,
        completed_jobs=8,
        failed_jobs=2,
        makespan=makespan,
        average_waiting_time=5.0,
        average_turnaround_time=15.0,
        resource_utilization=0.75,
        jobs_data=jobs_data or "job_id,success\n1,1\n2,0",
        schedule_data="makespan,nb_jobs\n100.0,10",
        computed_metrics=computed_metrics or json.dumps({
            "success_rate": 0.8,
            "throughput": 0.1,
            "consumed_joules": 5000,
        }),
    )
    db_session.add(result)
    db_session.commit()
    db_session.refresh(result)
    return result


class TestResultsCRUD:

    def test_list_results(self, client, auth_headers, db_session, create_experiment):
        exp, *_ = create_experiment("exp-list")
        _create_result(db_session, exp.id)
        res = client.get("/api/results/", headers=auth_headers)
        assert res.status_code == 200
        assert len(res.json()) >= 1

    def test_get_result_by_id(self, client, auth_headers, db_session, create_experiment):
        exp, *_ = create_experiment("exp-get")
        r = _create_result(db_session, exp.id)
        res = client.get(f"/api/results/{r.id}", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["makespan"] == 100.0

    def test_get_result_not_found(self, client, auth_headers):
        res = client.get("/api/results/9999", headers=auth_headers)
        assert res.status_code == 404

    def test_update_result(self, client, auth_headers, db_session, create_experiment):
        exp, *_ = create_experiment("exp-upd")
        r = _create_result(db_session, exp.id)
        res = client.put(f"/api/results/{r.id}", headers=auth_headers, json={
            "makespan": 200.0,
        })
        assert res.status_code == 200
        assert res.json()["makespan"] == 200.0

    def test_delete_result(self, client, auth_headers, db_session, create_experiment):
        exp, *_ = create_experiment("exp-del")
        r = _create_result(db_session, exp.id)
        res = client.delete(f"/api/results/{r.id}", headers=auth_headers)
        assert res.status_code == 200
        assert "deleted" in res.json()["message"]


class TestResultsExport:

    def test_export_json(self, client, auth_headers, db_session, create_experiment):
        exp, *_ = create_experiment("exp-json")
        r = _create_result(db_session, exp.id)
        res = client.get(f"/api/results/{r.id}/export?format=json", headers=auth_headers)
        assert res.status_code == 200
        assert "application/json" in res.headers["content-type"]
        data = res.json()
        assert "metrics" in data
        assert data["metrics"]["makespan"] == 100.0

    def test_export_csv(self, client, auth_headers, db_session, create_experiment):
        exp, *_ = create_experiment("exp-csv")
        r = _create_result(db_session, exp.id, jobs_data="job_id,success\n1,1\n2,0")
        res = client.get(f"/api/results/{r.id}/export?format=csv", headers=auth_headers)
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]
        assert "job_id" in res.text

    def test_export_csv_no_data(self, client, auth_headers, db_session, create_experiment):
        exp, *_ = create_experiment("exp-nocsv")
        r = _create_result(db_session, exp.id, jobs_data=None)
        # Need to clear jobs_data
        r.jobs_data = None
        db_session.commit()
        res = client.get(f"/api/results/{r.id}/export?format=csv", headers=auth_headers)
        assert res.status_code == 404

    def test_export_invalid_format(self, client, auth_headers, db_session, create_experiment):
        exp, *_ = create_experiment("exp-badfmt")
        r = _create_result(db_session, exp.id)
        res = client.get(f"/api/results/{r.id}/export?format=xml", headers=auth_headers)
        assert res.status_code == 400


class TestResultsCompare:

    def test_compare_two_experiments(self, client, auth_headers, db_session, create_experiment):
        exp1, *_ = create_experiment("exp-cmp1")
        exp2, *_ = create_experiment("exp-cmp2")
        _create_result(db_session, exp1.id, makespan=100.0)
        _create_result(db_session, exp2.id, makespan=200.0)
        res = client.get(
            f"/api/results/compare/metrics?ids={exp1.id},{exp2.id}",
            headers=auth_headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data["experiments"]) == 2
        assert data["experiments"][0]["has_result"] is True

    def test_compare_less_than_two(self, client, auth_headers, db_session, create_experiment):
        exp, *_ = create_experiment("exp-one")
        res = client.get(
            f"/api/results/compare/metrics?ids={exp.id}",
            headers=auth_headers,
        )
        assert res.status_code == 400


class TestResultsAnalytics:

    def test_analytics(self, client, auth_headers, db_session, create_experiment):
        exp, *_ = create_experiment("exp-anal")
        _create_result(db_session, exp.id)
        res = client.get("/api/results/analytics", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["total_results"] >= 1
        assert "avg_makespan" in data

    def test_analytics_empty(self, client, auth_headers):
        res = client.get("/api/results/analytics", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["total_results"] == 0
