from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from sqlalchemy.orm import Session
from app.core.security import get_password_hash
from app.models.user import UserRole

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="BatSim Web Portal API",
    description="A modern web portal for managing BatSim simulations",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import models to register them with SQLAlchemy
from app.models import User, Workload, Platform, Scenario, Strategy, Experiment, Result

# Import and include routers
from app.api import (
    auth,
    workloads,
    platforms,
    scenarios,
    strategies,
    experiments,
    results,
    system,
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(workloads.router, prefix="/api/workloads", tags=["Workloads"])
app.include_router(platforms.router, prefix="/api/platforms", tags=["Platforms"])
app.include_router(scenarios.router, prefix="/api/scenarios", tags=["Scenarios"])
app.include_router(strategies.router, prefix="/api/strategies", tags=["Strategies"])
app.include_router(experiments.router, prefix="/api/experiments", tags=["Experiments"])
app.include_router(results.router, prefix="/api/results", tags=["Results"])
app.include_router(system.router, prefix="/api/system", tags=["System"])


def seed_admin_user():
    db: Session = SessionLocal()
    admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
    if not admin:
        default_admin = User(
            username="admin",
            email="admin@example.com",
            hashed_password=get_password_hash("admin@123"),
            role=UserRole.ADMIN,
            is_active="true",
        )
        db.add(default_admin)
        db.commit()
        print("[INFO] Default admin user created: admin / admin@123")
    else:
        print("[INFO] Admin user already exists. Skipping creation.")
    db.close()


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
                    simulation_dir=f"/storage/experiments/exp_{i+1}",
                    batsim_logs=f"Batsim started at {i+1}:00:00\nPlatform loaded: {sc.platform.name}\nWorkload loaded: {sc.workload.name}\nSimulation completed successfully.",
                    pybatsim_logs=f"Pybatsim started at {i+1}:00:05\nStrategy loaded: {st.name}\nScheduler initialized\nAll jobs processed.",
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


seed_admin_user()


@app.get("/")
async def root():
    return {
        "message": "BatSim Web Portal API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
