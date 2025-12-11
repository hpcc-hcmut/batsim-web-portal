import os
from typing import Optional, List
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

    # Docker Configuration
    BATSIM_IMAGE: str = "batsim/batsim:latest"
    PYBATSIM_IMAGE: str = "batsim/pybatsim:latest"
    DOCKER_NETWORK_PREFIX: str = "batsim-net"

    # Container Resource Limits
    CONTAINER_MEM_LIMIT: str = "4g"  # Memory limit (e.g., "4g", "2048m")
    CONTAINER_CPU_LIMIT: float = 2.0  # CPU cores

    # Simulation Settings
    SIMULATION_TIMEOUT: int = 3600  # Max simulation runtime in seconds (1 hour)
    MAX_CONCURRENT_SIMULATIONS: int = 5  # Max concurrent simulations

    # Metrics (optional - for Phase 6)
    ENABLE_METRICS: bool = False

    # Grafana Integration
    GRAFANA_URL: str = "http://grafana:3000"
    GRAFANA_API_KEY: Optional[str] = None
    GRAFANA_ADMIN_USER: str = "admin"
    GRAFANA_ADMIN_PASSWORD: str = "admin"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
