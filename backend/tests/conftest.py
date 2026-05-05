"""Shared test fixtures for BatSim Web Portal backend tests."""

import os
import sys
import json
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session

# Add app to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.database import Base, get_db
from app.core.security import create_access_token, get_password_hash
from app.models.user import User, UserRole
from app.models.workload import Workload
from app.models.platform import Platform
from app.models.strategy import Strategy
from app.models.scenario import Scenario
from app.models.experiment import Experiment, ExperimentStatus
from app.models.result import Result


# ---------------------------------------------------------------------------
# Engine & session (session-scoped — created once per test session)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def test_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )

    # CRITICAL: enable FK enforcement on in-memory test DB so cascade tests are not false-positive
    @event.listens_for(engine, "connect")
    def _enable_fk(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    # Import all models so Base.metadata knows about them
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(test_engine):
    """Fresh DB session per test with rollback isolation."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


# ---------------------------------------------------------------------------
# FastAPI TestClient
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
def client(db_session):
    from fastapi.testclient import TestClient
    from app.main import app

    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Auth fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def test_user(db_session):
    user = User(
        username="testuser",
        email="test@test.com",
        hashed_password=get_password_hash("testpass123"),
        role=UserRole.USER,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_admin(db_session):
    user = User(
        username="adminuser",
        email="admin@test.com",
        hashed_password=get_password_hash("adminpass123"),
        role=UserRole.ADMIN,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user):
    token = create_access_token(data={"sub": test_user.username})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(test_admin):
    token = create_access_token(data={"sub": test_admin.username})
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Storage fixture — redirect file writes to temp dir
# ---------------------------------------------------------------------------

@pytest.fixture
def tmp_storage(tmp_path, monkeypatch):
    storage = tmp_path / "storage"
    storage.mkdir()
    sim_data = tmp_path / "sim_data"
    sim_data.mkdir()
    monkeypatch.setattr("app.core.config.settings.STORAGE_PATH", str(storage))
    monkeypatch.setattr("app.core.config.settings.SIMULATION_DATA_PATH", str(sim_data))
    # Patch module-level STORAGE_DIR vars (computed at import time)
    monkeypatch.setattr("app.api.workloads.STORAGE_DIR", str(storage / "workloads"))
    monkeypatch.setattr("app.api.platforms.STORAGE_DIR", str(storage / "platforms"))
    monkeypatch.setattr("app.api.strategies.STORAGE_DIR", str(storage / "strategies"))
    return {"storage": storage, "sim_data": sim_data}


# ---------------------------------------------------------------------------
# Sample file content fixtures
# ---------------------------------------------------------------------------

SAMPLE_WORKLOAD_JSON = {
    "nb_res": 4,
    "jobs": [
        {"id": 0, "subtime": 0, "res": 2, "profile": "delay_10s", "walltime": 100},
        {"id": 1, "subtime": 5, "res": 1, "profile": "delay_20s", "walltime": 200},
    ],
    "profiles": {
        "delay_10s": {"type": "delay", "delay": 10},
        "delay_20s": {"type": "delay", "delay": 20},
    },
}

SAMPLE_PLATFORM_XML = """<?xml version='1.0'?>
<!DOCTYPE platform SYSTEM "https://simgrid.org/simgrid.dtd">
<platform version="4.1">
  <zone id="world" routing="Full">
    <cluster id="cluster0" prefix="host-" suffix=".test"
             radical="0-3" speed="1Gf" bw="125MBps" lat="50us" />
    <host id="master_host0" speed="1Gf">
      <prop id="role" value="master" />
    </host>
  </zone>
</platform>"""

SAMPLE_STRATEGY_PY = """from batsim.batsim import BatsimScheduler

class FcfsScheduler(BatsimScheduler):
    def onJobSubmission(self, job):
        self.bs.execute(job.id, job.requested_resources)

if __name__ == "__main__":
    pass
"""


@pytest.fixture
def sample_workload_content():
    return json.dumps(SAMPLE_WORKLOAD_JSON)


@pytest.fixture
def sample_platform_content():
    return SAMPLE_PLATFORM_XML


@pytest.fixture
def sample_strategy_content():
    return SAMPLE_STRATEGY_PY


# ---------------------------------------------------------------------------
# DB entity helper fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def create_workload(db_session, test_user, tmp_storage):
    """Create a workload record with a valid file on disk."""
    def _create(name="test-workload"):
        wl_dir = tmp_storage["storage"] / "workloads"
        wl_dir.mkdir(exist_ok=True)
        fpath = wl_dir / f"{name}.json"
        fpath.write_text(json.dumps(SAMPLE_WORKLOAD_JSON))
        wl = Workload(
            name=name, description="test", file_path=str(fpath),
            file_size=len(fpath.read_bytes()), file_type="application/json",
            created_by=test_user.id, nb_res=4, version=1,
        )
        db_session.add(wl)
        db_session.commit()
        db_session.refresh(wl)
        return wl
    return _create


@pytest.fixture
def create_platform(db_session, test_user, tmp_storage):
    """Create a platform record with a valid file on disk."""
    def _create(name="test-platform"):
        pl_dir = tmp_storage["storage"] / "platforms"
        pl_dir.mkdir(exist_ok=True)
        fpath = pl_dir / f"{name}.xml"
        fpath.write_text(SAMPLE_PLATFORM_XML)
        pl = Platform(
            name=name, description="test", file_path=str(fpath),
            file_size=len(fpath.read_bytes()), file_type="application/xml",
            created_by=test_user.id, nb_hosts=4, nb_clusters=1,
            platform_config=SAMPLE_PLATFORM_XML, version=1,
        )
        db_session.add(pl)
        db_session.commit()
        db_session.refresh(pl)
        return pl
    return _create


@pytest.fixture
def create_strategy(db_session, test_user, tmp_storage):
    """Create a strategy record with a valid file on disk."""
    def _create(name="test-strategy"):
        st_dir = tmp_storage["storage"] / "strategies"
        st_dir.mkdir(exist_ok=True)
        fpath = st_dir / f"{name}.py"
        fpath.write_text(SAMPLE_STRATEGY_PY)
        st = Strategy(
            name=name, description="test", file_path=str(fpath),
            file_size=len(fpath.read_bytes()), file_type="text/x-python",
            created_by=test_user.id, nb_files=1, main_entry=f"{name}.py",
            version=1,
        )
        db_session.add(st)
        db_session.commit()
        db_session.refresh(st)
        return st
    return _create


@pytest.fixture
def create_scenario(db_session, test_user, create_workload, create_platform):
    """Create a scenario with valid workload + platform."""
    def _create(name="test-scenario"):
        wl = create_workload(f"wl-{name}")
        pl = create_platform(f"pl-{name}")
        sc = Scenario(
            name=name, description="test",
            workload_id=wl.id, platform_id=pl.id,
            created_by=test_user.id,
        )
        db_session.add(sc)
        db_session.commit()
        db_session.refresh(sc)
        return sc, wl, pl
    return _create


@pytest.fixture
def create_experiment(db_session, test_user, create_scenario, create_strategy):
    """Create an experiment with valid scenario + strategy."""
    def _create(name="test-experiment"):
        sc, wl, pl = create_scenario(f"sc-{name}")
        st = create_strategy(f"st-{name}")
        exp = Experiment(
            name=name, description="test",
            scenario_id=sc.id, strategy_id=st.id,
            status=ExperimentStatus.PENDING,
            created_by=test_user.id, seed=42,
        )
        db_session.add(exp)
        db_session.commit()
        db_session.refresh(exp)
        return exp, sc, st, wl, pl
    return _create
