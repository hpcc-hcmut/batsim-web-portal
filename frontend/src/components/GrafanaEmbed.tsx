import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Stack,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
} from "@mui/material";
import {
  OpenInNew,
  Refresh,
  Fullscreen,
  Dashboard,
  Timeline,
} from "@mui/icons-material";

interface GrafanaEmbedProps {
  dashboardUid?: string;
  panelId?: number;
  title?: string;
  height?: number | string;
  refreshInterval?: number;
  showControls?: boolean;
  experimentId?: number;
}

interface PredefinedDashboard {
  uid: string;
  title: string;
  description: string;
  embed_url: string;
  panels: Array<{ id: number; title: string }>;
}

const GrafanaEmbed: React.FC<GrafanaEmbedProps> = ({
  dashboardUid,
  panelId,
  title,
  height = 400,
  refreshInterval = 5000,
  showControls = true,
  experimentId,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grafanaStatus, setGrafanaStatus] = useState<{
    available: boolean;
    url: string;
  } | null>(null);
  const [selectedDashboard, setSelectedDashboard] = useState<string>(
    dashboardUid || "batsim-experiment"
  );
  const [selectedPanel, setSelectedPanel] = useState<number | null>(
    panelId || null
  );
  const [predefinedDashboards, setPredefinedDashboards] = useState<
    PredefinedDashboard[]
  >([]);
  const [key, setKey] = useState(0);

  useEffect(() => {
    checkGrafanaStatus();
    fetchPredefinedDashboards();
  }, []);

  const checkGrafanaStatus = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/grafana/status`
      );
      if (response.ok) {
        const data = await response.json();
        setGrafanaStatus(data);
        if (!data.available) {
          setError("Grafana is not available. Please start the Grafana service.");
        }
      } else {
        setError("Failed to check Grafana status");
      }
    } catch (err) {
      setError("Cannot connect to backend API");
    } finally {
      setLoading(false);
    }
  };

  const fetchPredefinedDashboards = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/grafana/predefined-dashboards`
      );
      if (response.ok) {
        const data = await response.json();
        setPredefinedDashboards(data.dashboards || []);
      }
    } catch (err) {
      console.error("Failed to fetch predefined dashboards:", err);
    }
  };

  const getEmbedUrl = (): string => {
    if (!grafanaStatus?.url) return "";

    const baseUrl = grafanaStatus.url;
    const dashboard = selectedDashboard;

    if (selectedPanel) {
      return `${baseUrl}/d-solo/${dashboard}?orgId=1&panelId=${selectedPanel}&refresh=${refreshInterval}ms`;
    }

    return `${baseUrl}/d/${dashboard}?orgId=1&kiosk&refresh=${refreshInterval}ms`;
  };

  const handleRefresh = () => {
    setKey((prev) => prev + 1);
  };

  const handleOpenInNew = () => {
    const url = grafanaStatus?.url
      ? `${grafanaStatus.url}/d/${selectedDashboard}`
      : "";
    if (url) {
      window.open(url, "_blank");
    }
  };

  const handleFullscreen = () => {
    const iframe = document.querySelector(
      ".grafana-embed-iframe"
    ) as HTMLIFrameElement;
    if (iframe && iframe.requestFullscreen) {
      iframe.requestFullscreen();
    }
  };

  const currentDashboard = predefinedDashboards.find(
    (d) => d.uid === selectedDashboard
  );

  if (loading) {
    return (
      <Card sx={{ borderRadius: 4, background: "rgba(26,32,44,0.98)" }}>
        <CardContent>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: 200,
            }}
          >
            <CircularProgress />
            <Typography sx={{ ml: 2 }} color="text.secondary">
              Connecting to Grafana...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error || !grafanaStatus?.available) {
    return (
      <Card sx={{ borderRadius: 4, background: "rgba(26,32,44,0.98)" }}>
        <CardContent>
          <Alert
            severity="warning"
            sx={{
              backgroundColor: "rgba(237, 137, 54, 0.1)",
              color: "#ed8936",
              "& .MuiAlert-icon": { color: "#ed8936" },
            }}
          >
            <Typography variant="subtitle1" fontWeight={600}>
              Grafana Not Available
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {error ||
                "Grafana service is not running. Start it with: docker-compose up grafana"}
            </Typography>
          </Alert>
          <Box sx={{ mt: 2, textAlign: "center" }}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<Refresh />}
              onClick={checkGrafanaStatus}
            >
              Retry Connection
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ borderRadius: 4, background: "rgba(26,32,44,0.98)" }}>
      {showControls && (
        <Box
          sx={{
            p: 2,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Dashboard sx={{ color: "#4a9eff" }} />
            <Typography variant="h6" fontWeight={700} color="#fff">
              {title || currentDashboard?.title || "Grafana Dashboard"}
            </Typography>
            <Chip
              label="Live"
              size="small"
              color="success"
              sx={{ fontWeight: 700 }}
            />
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="dashboard-select-label">Dashboard</InputLabel>
              <Select
                labelId="dashboard-select-label"
                value={selectedDashboard}
                label="Dashboard"
                onChange={(e) => {
                  setSelectedDashboard(e.target.value);
                  setSelectedPanel(null);
                }}
              >
                {predefinedDashboards.map((d) => (
                  <MenuItem key={d.uid} value={d.uid}>
                    {d.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {currentDashboard && currentDashboard.panels.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel id="panel-select-label">Panel</InputLabel>
                <Select
                  labelId="panel-select-label"
                  value={selectedPanel || ""}
                  label="Panel"
                  onChange={(e) =>
                    setSelectedPanel(
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                >
                  <MenuItem value="">
                    <em>Full Dashboard</em>
                  </MenuItem>
                  {currentDashboard.panels.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Stack direction="row" spacing={1}>
              <Tooltip title="Refresh">
                <IconButton onClick={handleRefresh} size="small" color="primary">
                  <Refresh />
                </IconButton>
              </Tooltip>
              <Tooltip title="Fullscreen">
                <IconButton
                  onClick={handleFullscreen}
                  size="small"
                  color="primary"
                >
                  <Fullscreen />
                </IconButton>
              </Tooltip>
              <Tooltip title="Open in Grafana">
                <IconButton
                  onClick={handleOpenInNew}
                  size="small"
                  color="primary"
                >
                  <OpenInNew />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Box>
      )}

      <CardContent sx={{ p: 0 }}>
        <Box
          sx={{
            position: "relative",
            width: "100%",
            height: typeof height === "number" ? `${height}px` : height,
            overflow: "hidden",
            borderRadius: showControls ? 0 : 4,
          }}
        >
          <iframe
            key={key}
            className="grafana-embed-iframe"
            src={getEmbedUrl()}
            width="100%"
            height="100%"
            frameBorder="0"
            style={{
              border: "none",
              background: "#1a202c",
            }}
            title={title || "Grafana Dashboard"}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

export default GrafanaEmbed;
