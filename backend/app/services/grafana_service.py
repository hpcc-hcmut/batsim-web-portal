import httpx
import json
import uuid
from typing import Optional, Dict, Any
from app.core.config import settings


class GrafanaService:
    """Service for interacting with Grafana API."""

    def __init__(self):
        self.base_url = settings.GRAFANA_URL
        self.api_key = settings.GRAFANA_API_KEY
        self.admin_user = settings.GRAFANA_ADMIN_USER
        self.admin_password = settings.GRAFANA_ADMIN_PASSWORD

    def _get_headers(self) -> Dict[str, str]:
        """Get authentication headers for Grafana API."""
        if self.api_key:
            return {"Authorization": f"Bearer {self.api_key}"}
        return {}

    def _get_auth(self) -> Optional[tuple]:
        """Get basic auth credentials if no API key."""
        if not self.api_key:
            return (self.admin_user, self.admin_password)
        return None

    async def health_check(self) -> bool:
        """Check if Grafana is accessible."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/api/health",
                    timeout=5.0
                )
                return response.status_code == 200
        except Exception:
            return False

    async def get_dashboards(self) -> list:
        """Get all dashboards from Grafana."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/api/search",
                    headers=self._get_headers(),
                    auth=self._get_auth(),
                    timeout=10.0
                )
                if response.status_code == 200:
                    return response.json()
                return []
        except Exception as e:
            print(f"Error fetching dashboards: {e}")
            return []

    async def get_dashboard_by_uid(self, uid: str) -> Optional[Dict[str, Any]]:
        """Get a specific dashboard by UID."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/api/dashboards/uid/{uid}",
                    headers=self._get_headers(),
                    auth=self._get_auth(),
                    timeout=10.0
                )
                if response.status_code == 200:
                    return response.json()
                return None
        except Exception as e:
            print(f"Error fetching dashboard {uid}: {e}")
            return None

    async def create_experiment_dashboard(
        self,
        experiment_id: int,
        experiment_name: str,
        container_name: Optional[str] = None
    ) -> Optional[str]:
        """Create a new dashboard for an experiment and return its UID."""
        uid = f"exp-{experiment_id}-{uuid.uuid4().hex[:8]}"

        # Build Prometheus query filter based on container name
        container_filter = f'name=~"batsim.*{experiment_id}.*"'
        if container_name:
            container_filter = f'name="{container_name}"'

        dashboard = {
            "dashboard": {
                "uid": uid,
                "title": f"Experiment: {experiment_name}",
                "tags": ["batsim", "experiment", f"exp-{experiment_id}"],
                "timezone": "browser",
                "refresh": "5s",
                "schemaVersion": 38,
                "panels": [
                    {
                        "id": 1,
                        "title": "CPU Usage",
                        "type": "timeseries",
                        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
                        "targets": [{
                            "expr": f'rate(container_cpu_usage_seconds_total{{{container_filter}}}[1m]) * 100',
                            "legendFormat": "{{name}}",
                            "refId": "A"
                        }],
                        "fieldConfig": {
                            "defaults": {
                                "unit": "percent",
                                "custom": {
                                    "drawStyle": "line",
                                    "lineInterpolation": "smooth",
                                    "fillOpacity": 10
                                }
                            }
                        }
                    },
                    {
                        "id": 2,
                        "title": "Memory Usage",
                        "type": "timeseries",
                        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
                        "targets": [{
                            "expr": f'container_memory_usage_bytes{{{container_filter}}}',
                            "legendFormat": "{{name}}",
                            "refId": "A"
                        }],
                        "fieldConfig": {
                            "defaults": {
                                "unit": "bytes",
                                "custom": {
                                    "drawStyle": "line",
                                    "lineInterpolation": "smooth",
                                    "fillOpacity": 10
                                }
                            }
                        }
                    },
                    {
                        "id": 3,
                        "title": "Current CPU",
                        "type": "gauge",
                        "gridPos": {"h": 4, "w": 6, "x": 0, "y": 8},
                        "targets": [{
                            "expr": f'rate(container_cpu_usage_seconds_total{{{container_filter}}}[1m]) * 100',
                            "legendFormat": "CPU",
                            "refId": "A"
                        }],
                        "fieldConfig": {
                            "defaults": {
                                "unit": "percent",
                                "thresholds": {
                                    "steps": [
                                        {"color": "green", "value": None},
                                        {"color": "yellow", "value": 50},
                                        {"color": "red", "value": 80}
                                    ]
                                },
                                "max": 100
                            }
                        }
                    },
                    {
                        "id": 4,
                        "title": "Current Memory",
                        "type": "gauge",
                        "gridPos": {"h": 4, "w": 6, "x": 6, "y": 8},
                        "targets": [{
                            "expr": f'container_memory_usage_bytes{{{container_filter}}}',
                            "legendFormat": "Memory",
                            "refId": "A"
                        }],
                        "fieldConfig": {
                            "defaults": {
                                "unit": "bytes",
                                "thresholds": {
                                    "steps": [
                                        {"color": "green", "value": None},
                                        {"color": "yellow", "value": 536870912},
                                        {"color": "red", "value": 1073741824}
                                    ]
                                }
                            }
                        }
                    },
                    {
                        "id": 5,
                        "title": "Network I/O",
                        "type": "timeseries",
                        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 12},
                        "targets": [
                            {
                                "expr": f'rate(container_network_receive_bytes_total{{{container_filter}}}[1m])',
                                "legendFormat": "RX {{name}}",
                                "refId": "A"
                            },
                            {
                                "expr": f'rate(container_network_transmit_bytes_total{{{container_filter}}}[1m])',
                                "legendFormat": "TX {{name}}",
                                "refId": "B"
                            }
                        ],
                        "fieldConfig": {
                            "defaults": {
                                "unit": "Bps",
                                "custom": {
                                    "drawStyle": "line",
                                    "lineInterpolation": "smooth",
                                    "fillOpacity": 10
                                }
                            }
                        }
                    },
                    {
                        "id": 6,
                        "title": "Disk I/O",
                        "type": "timeseries",
                        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 12},
                        "targets": [
                            {
                                "expr": f'rate(container_fs_reads_bytes_total{{{container_filter}}}[1m])',
                                "legendFormat": "Read {{name}}",
                                "refId": "A"
                            },
                            {
                                "expr": f'rate(container_fs_writes_bytes_total{{{container_filter}}}[1m])',
                                "legendFormat": "Write {{name}}",
                                "refId": "B"
                            }
                        ],
                        "fieldConfig": {
                            "defaults": {
                                "unit": "Bps",
                                "custom": {
                                    "drawStyle": "line",
                                    "lineInterpolation": "smooth",
                                    "fillOpacity": 10
                                }
                            }
                        }
                    }
                ],
                "time": {"from": "now-15m", "to": "now"}
            },
            "folderUid": "batsim",
            "overwrite": True
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/api/dashboards/db",
                    headers={**self._get_headers(), "Content-Type": "application/json"},
                    auth=self._get_auth(),
                    json=dashboard,
                    timeout=15.0
                )
                if response.status_code in (200, 201):
                    result = response.json()
                    return result.get("uid", uid)
                else:
                    print(f"Failed to create dashboard: {response.status_code} - {response.text}")
                    return None
        except Exception as e:
            print(f"Error creating dashboard: {e}")
            return None

    async def delete_dashboard(self, uid: str) -> bool:
        """Delete a dashboard by UID."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    f"{self.base_url}/api/dashboards/uid/{uid}",
                    headers=self._get_headers(),
                    auth=self._get_auth(),
                    timeout=10.0
                )
                return response.status_code == 200
        except Exception as e:
            print(f"Error deleting dashboard {uid}: {e}")
            return False

    def get_embed_url(self, uid: str, panel_id: Optional[int] = None) -> str:
        """Get the embeddable URL for a dashboard or panel."""
        base = f"{self.base_url}/d/{uid}"
        if panel_id:
            return f"{base}?orgId=1&panelId={panel_id}&fullscreen"
        return f"{base}?orgId=1&kiosk"

    def get_panel_embed_url(self, uid: str, panel_id: int) -> str:
        """Get the embeddable URL for a specific panel."""
        return f"{self.base_url}/d-solo/{uid}?orgId=1&panelId={panel_id}"


# Singleton instance
grafana_service = GrafanaService()
