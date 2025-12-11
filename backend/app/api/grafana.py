from fastapi import APIRouter, HTTPException
from typing import Optional
from pydantic import BaseModel
from app.services.grafana_service import grafana_service
from app.core.config import settings

router = APIRouter(prefix="/grafana", tags=["grafana"])


class GrafanaStatus(BaseModel):
    available: bool
    url: str
    embed_enabled: bool


class DashboardInfo(BaseModel):
    uid: str
    title: str
    url: str
    embed_url: str


class CreateDashboardRequest(BaseModel):
    experiment_id: int
    experiment_name: str
    container_name: Optional[str] = None


@router.get("/status", response_model=GrafanaStatus)
async def get_grafana_status():
    """Check Grafana availability and configuration."""
    is_available = await grafana_service.health_check()
    return GrafanaStatus(
        available=is_available,
        url=settings.GRAFANA_URL.replace("http://grafana:3000", "http://localhost:3000"),
        embed_enabled=True
    )


@router.get("/dashboards")
async def list_dashboards():
    """List all available Grafana dashboards."""
    dashboards = await grafana_service.get_dashboards()
    return {"dashboards": dashboards}


@router.get("/dashboards/{uid}")
async def get_dashboard(uid: str):
    """Get a specific dashboard by UID."""
    dashboard = await grafana_service.get_dashboard_by_uid(uid)
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dashboard


@router.post("/dashboards", response_model=DashboardInfo)
async def create_experiment_dashboard(request: CreateDashboardRequest):
    """Create a new dashboard for an experiment."""
    uid = await grafana_service.create_experiment_dashboard(
        experiment_id=request.experiment_id,
        experiment_name=request.experiment_name,
        container_name=request.container_name
    )
    if not uid:
        raise HTTPException(status_code=500, detail="Failed to create dashboard")

    # Generate URLs (replace internal docker hostname with localhost for frontend access)
    base_url = settings.GRAFANA_URL.replace("http://grafana:3000", "http://localhost:3000")

    return DashboardInfo(
        uid=uid,
        title=f"Experiment: {request.experiment_name}",
        url=f"{base_url}/d/{uid}",
        embed_url=f"{base_url}/d/{uid}?orgId=1&kiosk"
    )


@router.delete("/dashboards/{uid}")
async def delete_dashboard(uid: str):
    """Delete a dashboard by UID."""
    success = await grafana_service.delete_dashboard(uid)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete dashboard")
    return {"status": "deleted", "uid": uid}


@router.get("/embed-url/{uid}")
async def get_embed_url(uid: str, panel_id: Optional[int] = None):
    """Get the embeddable URL for a dashboard or specific panel."""
    base_url = settings.GRAFANA_URL.replace("http://grafana:3000", "http://localhost:3000")

    if panel_id:
        embed_url = f"{base_url}/d-solo/{uid}?orgId=1&panelId={panel_id}"
    else:
        embed_url = f"{base_url}/d/{uid}?orgId=1&kiosk"

    return {
        "uid": uid,
        "embed_url": embed_url,
        "full_url": f"{base_url}/d/{uid}"
    }


@router.get("/predefined-dashboards")
async def get_predefined_dashboards():
    """Get list of predefined dashboard UIDs for embedding."""
    base_url = settings.GRAFANA_URL.replace("http://grafana:3000", "http://localhost:3000")

    return {
        "dashboards": [
            {
                "uid": "batsim-experiment",
                "title": "BatSim Experiment Monitor",
                "description": "Monitor running experiment containers",
                "embed_url": f"{base_url}/d/batsim-experiment?orgId=1&kiosk",
                "panels": [
                    {"id": 1, "title": "Container CPU Usage"},
                    {"id": 2, "title": "Container Memory Usage"},
                    {"id": 3, "title": "Average CPU Usage"},
                    {"id": 4, "title": "Average Memory Usage"},
                    {"id": 5, "title": "Active BatSim Containers"},
                    {"id": 6, "title": "Longest Running Container"},
                    {"id": 7, "title": "Network I/O"},
                    {"id": 8, "title": "Disk I/O"}
                ]
            },
            {
                "uid": "batsim-api",
                "title": "BatSim API Metrics",
                "description": "Backend API performance metrics",
                "embed_url": f"{base_url}/d/batsim-api?orgId=1&kiosk",
                "panels": [
                    {"id": 1, "title": "API Request Rate"},
                    {"id": 2, "title": "API Response Time"},
                    {"id": 3, "title": "Total Requests (24h)"},
                    {"id": 4, "title": "Error Rate (5xx)"},
                    {"id": 5, "title": "p95 Latency"},
                    {"id": 6, "title": "Running Experiments"}
                ]
            }
        ]
    }
