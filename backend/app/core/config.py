from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite:///./batsim.db"

    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # File Storage
    STORAGE_PATH: str = "./storage"
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100MB

    # Docker — BatSim images
    BATSIM_IMAGE: str = "oarteam/batsim:latest"
    PYBATSIM_IMAGE: str = "tanaxer/pybatsim:latest"

    # Simulation
    MAX_CONCURRENT_SIMULATIONS: int = 3
    SIMULATION_TIMEOUT_SECONDS: int = 3600
    SIMULATION_DATA_PATH: str = "./storage/experiments"

    # Container stats collector
    STATS_POLL_INTERVAL_SECONDS: int = 1
    STATS_KEY_TTL_SECONDS: int = 30

    # Monitoring
    GRAFANA_URL: str = "http://localhost:3000"

    # CORS
    BACKEND_CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
    ]

    class Config:
        env_file = ".env"


settings = Settings()
