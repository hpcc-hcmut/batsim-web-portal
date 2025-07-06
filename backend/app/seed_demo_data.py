from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models import (
    User,
    Workload,
    Platform,
    Scenario,
    Strategy,
    Experiment,
    Result,
    UserRole,
)
from sqlalchemy.orm import Session


def seed_demo_data():
    db: Session = SessionLocal()
    try:
        # --- Users ---
        if not db.query(User).filter(User.username == "demo_user").first():
            demo_user = User(
                username="demo_user",
                email="demo_user@example.com",
                hashed_password=get_password_hash("demo1234"),
                role=UserRole.USER,
                is_active="true",
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)
        else:
            demo_user = db.query(User).filter(User.username == "demo_user").first()

        # --- Workloads ---
        if not db.query(Workload).first():
            for i in range(1, 4):
                w = Workload(
                    name=f"Demo Workload {i}",
                    description=f"Sample workload {i} for demo purposes.",
                    file_path=f"/storage/workloads/demo_workload_{i}.json",
                    file_size=1024 * i,
                    file_type="json",
                    created_by=demo_user.id,
                )
                db.add(w)
            db.commit()

        # --- Platforms ---
        if not db.query(Platform).first():
            for i in range(1, 3):
                p = Platform(
                    name=f"Demo Platform {i}",
                    description=f"Sample platform {i} for demo purposes.",
                    file_path=f"/storage/platforms/demo_platform_{i}.xml",
                    file_size=2048 * i,
                    file_type="xml",
                    created_by=demo_user.id,
                )
                db.add(p)
            db.commit()

        # --- Strategies ---
        if not db.query(Strategy).first():
            for i in range(1, 3):
                s = Strategy(
                    name=f"Demo Strategy {i}",
                    description=f"Sample strategy {i} for demo purposes.",
                    file_path=f"/storage/strategies/demo_strategy_{i}.py",
                    file_size=4096 * i,
                    file_type="python",
                    created_by=demo_user.id,
                )
                db.add(s)
            db.commit()

        # --- Scenarios ---
        workloads = db.query(Workload).all()
        platforms = db.query(Platform).all()
        if not db.query(Scenario).first() and workloads and platforms:
            for i, (w, p) in enumerate(zip(workloads, platforms)):
                sc = Scenario(
                    name=f"Demo Scenario {i+1}",
                    description=f"Scenario combining {w.name} and {p.name}.",
                    workload_id=w.id,
                    platform_id=p.id,
                    created_by=demo_user.id,
                )
                db.add(sc)
            db.commit()

        # --- Experiments ---
        scenarios = db.query(Scenario).all()
        strategies = db.query(Strategy).all()
        if not db.query(Experiment).first() and scenarios and strategies:
            for i, (sc, st) in enumerate(zip(scenarios, strategies)):
                exp = Experiment(
                    name=f"Demo Experiment {i+1}",
                    description=f"Experiment for {sc.name} using {st.name}.",
                    scenario_id=sc.id,
                    strategy_id=st.id,
                    status="completed" if i % 2 == 0 else "running",
                    batsim_container_id=f"batsim_{i+1}",
                    pybatsim_container_id=f"pybatsim_{i+1}",
                    total_jobs=100 + i * 10,
                    completed_jobs=100 + i * 10 if i % 2 == 0 else 50 + i * 10,
                    progress_percentage=100 if i % 2 == 0 else 50,
                    created_by=demo_user.id,
                )
                db.add(exp)
            db.commit()

        # --- Results ---
        experiments = db.query(Experiment).all()
        if not db.query(Result).first() and experiments:
            for i, exp in enumerate(experiments):
                res = Result(
                    experiment_id=exp.id,
                    simulation_time=3600 + i * 100,
                    total_jobs=exp.total_jobs,
                    completed_jobs=exp.completed_jobs,
                    failed_jobs=0 if exp.status == "completed" else 5,
                    makespan=5000 + i * 100,
                    average_waiting_time=20.5 + i,
                    average_turnaround_time=40.2 + i,
                    resource_utilization=0.85 - i * 0.05,
                    config="{}",
                    metrics="{}",
                    logs="Demo log data...",
                    result_file_path=f"/storage/results/result_{i+1}.json",
                    log_file_path=f"/storage/results/log_{i+1}.txt",
                )
                db.add(res)
            db.commit()
        print("[INFO] Demo data seeded.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
    print("[INFO] Demo data injection complete.")
