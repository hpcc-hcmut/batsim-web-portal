"""Integration tests: FK CASCADE and SET NULL behavior.

Requires PRAGMA foreign_keys=ON (patched in conftest test_engine fixture).
Each test verifies one delete scenario from the FK graph:

    users --SET NULL--> created_by fields (content preserved)
    workloads --CASCADE--> scenarios --> experiments --> results
    platforms --CASCADE--> scenarios --> experiments --> results
    scenarios --CASCADE--> experiments --> results
    strategies --CASCADE--> experiments --> results
    experiments --CASCADE--> results
"""

import pytest
from sqlalchemy import text

from app.models.workload import Workload
from app.models.platform import Platform
from app.models.scenario import Scenario
from app.models.experiment import Experiment
from app.models.result import Result


# ---------------------------------------------------------------------------
# Helper: insert a bare Result row linked to given experiment
# ---------------------------------------------------------------------------

def _add_result(db_session, experiment_id: int) -> Result:
    res = Result(
        experiment_id=experiment_id,
        simulation_time=100.0,
        total_jobs=2,
        completed_jobs=2,
        failed_jobs=0,
        makespan=50.0,
        average_waiting_time=5.0,
        average_turnaround_time=10.0,
        resource_utilization=0.9,
        config="{}",
        metrics="{}",
        logs="test",
    )
    db_session.add(res)
    db_session.flush()
    return res


# ---------------------------------------------------------------------------
# Test 1: delete workload cascades → scenarios → experiments → results
# ---------------------------------------------------------------------------

def test_delete_workload_cascades_scenarios_experiments_results(
    db_session, create_experiment
):
    exp, sc, st, wl, pl = create_experiment("cascade-wl-test")
    exp_id = exp.id
    sc_id = sc.id
    wl_id = wl.id
    result = _add_result(db_session, exp_id)
    res_id = result.id
    db_session.commit()

    # Delete workload — should cascade to scenario → experiment → result
    db_session.delete(wl)
    db_session.commit()

    assert db_session.get(Workload, wl_id) is None
    assert db_session.get(Scenario, sc_id) is None
    assert db_session.get(Experiment, exp_id) is None
    assert db_session.get(Result, res_id) is None


# ---------------------------------------------------------------------------
# Test 2: delete scenario cascades → experiments → results
# ---------------------------------------------------------------------------

def test_delete_scenario_cascades_experiments_results(
    db_session, create_experiment
):
    exp, sc, st, wl, pl = create_experiment("cascade-sc-test")
    exp_id = exp.id
    sc_id = sc.id
    result = _add_result(db_session, exp_id)
    res_id = result.id
    db_session.commit()

    db_session.delete(sc)
    db_session.commit()

    assert db_session.get(Scenario, sc_id) is None
    assert db_session.get(Experiment, exp_id) is None
    assert db_session.get(Result, res_id) is None


# ---------------------------------------------------------------------------
# Test 3: delete experiment cascades → results only
# ---------------------------------------------------------------------------

def test_delete_experiment_cascades_results(
    db_session, create_experiment
):
    exp, sc, st, wl, pl = create_experiment("cascade-exp-test")
    exp_id = exp.id
    result = _add_result(db_session, exp_id)
    res_id = result.id
    db_session.commit()

    db_session.delete(exp)
    db_session.commit()

    assert db_session.get(Experiment, exp_id) is None
    assert db_session.get(Result, res_id) is None
    # Parent objects must still exist
    assert db_session.get(Scenario, sc.id) is not None


# ---------------------------------------------------------------------------
# Test 4: delete strategy cascades → experiments (and transitively results)
# ---------------------------------------------------------------------------

def test_delete_strategy_cascades_experiments(
    db_session, create_experiment
):
    exp, sc, st, wl, pl = create_experiment("cascade-st-test")
    exp_id = exp.id
    st_id = st.id
    result = _add_result(db_session, exp_id)
    res_id = result.id
    db_session.commit()

    db_session.delete(st)
    db_session.commit()

    assert db_session.get(Experiment, exp_id) is None
    assert db_session.get(Result, res_id) is None
    assert db_session.get(Scenario, sc.id) is not None


# ---------------------------------------------------------------------------
# Test 5: delete user nulls created_by but KEEPS content rows
# ---------------------------------------------------------------------------

def test_delete_user_nulls_created_by_keeps_content(
    db_session, create_workload, test_user
):
    wl = create_workload("user-delete-wl-test")
    wl_id = wl.id
    user_id = test_user.id
    db_session.commit()

    db_session.delete(test_user)
    db_session.commit()

    # Workload row must still exist
    surviving_wl = db_session.get(Workload, wl_id)
    assert surviving_wl is not None, "Workload must not be deleted when its creator is deleted"
    # created_by should be NULL (SET NULL on user delete)
    assert surviving_wl.created_by is None, "created_by must be NULL after user delete"
