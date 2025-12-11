import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Button,
  Stack,
  Chip,
  Drawer,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Alert,
  Divider,
} from "@mui/material";
import {
  Settings,
  Edit,
  Delete,
  Close,
  Add,
  Storage,
  Computer,
} from "@mui/icons-material";
import {
  scenariosAPI,
  Scenario,
  workloadsAPI,
  platformsAPI,
  Workload,
  Platform,
  PredictionMode,
} from "../services/api";
import PredictionConfig from "../components/PredictionConfig";

type PanelMode = "view" | "edit" | "add";

// Mock data for demonstration
const mockScenarios: Scenario[] = [
  {
    id: 1,
    name: "HPC Batch Processing",
    description:
      "High-performance computing scenario with batch job scheduling for scientific simulations.",
    workload_id: 1,
    platform_id: 1,
    created_at: "2024-12-01T10:00:00Z",
    workload_name: "Scientific Workload",
    platform_name: "Cluster-128",
    creator_username: "admin",
  },
  {
    id: 2,
    name: "Cloud Burst Test",
    description:
      "Testing cloud burst capabilities with sudden load increases and auto-scaling.",
    workload_id: 2,
    platform_id: 2,
    created_at: "2024-12-05T14:30:00Z",
    workload_name: "Web Traffic Simulation",
    platform_name: "Cloud-Hybrid",
    creator_username: "researcher",
  },
  {
    id: 3,
    name: "Energy Efficiency Analysis",
    description:
      "Analyzing energy consumption patterns under various scheduling strategies.",
    workload_id: 3,
    platform_id: 1,
    created_at: "2024-12-08T09:15:00Z",
    workload_name: "Mixed Workload",
    platform_name: "Cluster-128",
    creator_username: "admin",
  },
];

const mockWorkloads: Workload[] = [
  {
    id: 1,
    name: "Scientific Workload",
    description: "Large-scale scientific computation jobs",
    file_path: "/workloads/scientific.json",
    created_at: "2024-11-15T08:00:00Z",
  },
  {
    id: 2,
    name: "Web Traffic Simulation",
    description: "Simulated web server request patterns",
    file_path: "/workloads/webtraffic.json",
    created_at: "2024-11-20T12:00:00Z",
  },
  {
    id: 3,
    name: "Mixed Workload",
    description: "Combination of batch and interactive jobs",
    file_path: "/workloads/mixed.json",
    created_at: "2024-11-25T16:00:00Z",
  },
];

const mockPlatforms: Platform[] = [
  {
    id: 1,
    name: "Cluster-128",
    description: "128-node HPC cluster with InfiniBand",
    file_path: "/platforms/cluster128.xml",
    created_at: "2024-11-10T10:00:00Z",
    nb_hosts: 128,
    nb_clusters: 4,
  },
  {
    id: 2,
    name: "Cloud-Hybrid",
    description: "Hybrid cloud platform with on-demand scaling",
    file_path: "/platforms/cloud_hybrid.xml",
    created_at: "2024-11-12T14:00:00Z",
    nb_hosts: 256,
    nb_clusters: 8,
  },
];

const ScenariosPage: React.FC = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [workloads, setWorkloads] = useState<Workload[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("view");
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(
    null
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });
  const [form, setForm] = useState({
    name: "",
    description: "",
    workload_id: "",
    platform_id: "",
    prediction_enabled: false,
    prediction_model_id: null as number | null,
    prediction_mode: "no_prediction" as PredictionMode,
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [scenariosRes, workloadsRes, platformsRes] = await Promise.all([
          scenariosAPI.getAll(),
          workloadsAPI.getAll(),
          platformsAPI.getAll(),
        ]);
        const scenarioData = Array.isArray(scenariosRes.data)
          ? scenariosRes.data
          : (scenariosRes.data as any).items || [];
        const workloadData = Array.isArray(workloadsRes.data)
          ? workloadsRes.data
          : (workloadsRes.data as any).items || [];
        const platformData = Array.isArray(platformsRes.data)
          ? platformsRes.data
          : (platformsRes.data as any).items || [];

        // Use mock data if API returns empty
        setScenarios(scenarioData.length > 0 ? scenarioData : mockScenarios);
        setWorkloads(workloadData.length > 0 ? workloadData : mockWorkloads);
        setPlatforms(platformData.length > 0 ? platformData : mockPlatforms);
      } catch (err: any) {
        // Use mock data on error
        setScenarios(mockScenarios);
        setWorkloads(mockWorkloads);
        setPlatforms(mockPlatforms);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const openDrawer = (mode: PanelMode, scenario?: Scenario) => {
    setPanelMode(mode);
    setSelectedScenario(scenario || null);
    setFormError(null);
    if (mode === "add") {
      setForm({ name: "", description: "", workload_id: "", platform_id: "", prediction_enabled: false, prediction_model_id: null, prediction_mode: "no_prediction" });
    } else if (scenario) {
      setForm({
        name: scenario.name,
        description: scenario.description || "",
        workload_id: scenario.workload_id.toString(),
        platform_id: scenario.platform_id.toString(),
        prediction_enabled: scenario.prediction_enabled || false,
        prediction_model_id: scenario.prediction_model_id || null,
        prediction_mode: scenario.prediction_mode || "no_prediction",
      });
    }
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedScenario(null);
    setFormError(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.workload_id || !form.platform_id) {
      setFormError("Name, workload, and platform are required.");
      return;
    }

    setActionLoading(true);
    setFormError(null);
    try {
      const res = await scenariosAPI.create({
        name: form.name,
        description: form.description,
        workload_id: parseInt(form.workload_id),
        platform_id: parseInt(form.platform_id),
        prediction_enabled: form.prediction_enabled,
        prediction_model_id: form.prediction_model_id,
        prediction_mode: form.prediction_mode,
      });
      setScenarios((prev) => [res.data, ...prev]);
      closeDrawer();
      setSnackbar({
        open: true,
        message: "Scenario created successfully!",
        severity: "success",
      });
    } catch (err: any) {
      // Mock add for demo
      const newScenario: Scenario = {
        id: Date.now(),
        name: form.name,
        description: form.description,
        workload_id: parseInt(form.workload_id),
        platform_id: parseInt(form.platform_id),
        created_at: new Date().toISOString(),
        workload_name:
          workloads.find((w) => w.id === parseInt(form.workload_id))?.name ||
          "Unknown",
        platform_name:
          platforms.find((p) => p.id === parseInt(form.platform_id))?.name ||
          "Unknown",
        creator_username: "user",
      };
      setScenarios((prev) => [newScenario, ...prev]);
      closeDrawer();
      setSnackbar({
        open: true,
        message: "Scenario created successfully! (Demo mode)",
        severity: "success",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScenario) return;

    setActionLoading(true);
    setFormError(null);
    try {
      const res = await scenariosAPI.update(selectedScenario.id, {
        name: form.name,
        description: form.description,
        workload_id: parseInt(form.workload_id),
        platform_id: parseInt(form.platform_id),
        prediction_enabled: form.prediction_enabled,
        prediction_model_id: form.prediction_model_id,
        prediction_mode: form.prediction_mode,
      });
      setScenarios((prev) =>
        prev.map((s) => (s.id === selectedScenario.id ? res.data : s))
      );
      closeDrawer();
      setSnackbar({
        open: true,
        message: "Scenario updated successfully!",
        severity: "success",
      });
    } catch (err: any) {
      // Mock edit for demo
      setScenarios((prev) =>
        prev.map((s) =>
          s.id === selectedScenario.id
            ? {
                ...s,
                name: form.name,
                description: form.description,
                workload_id: parseInt(form.workload_id),
                platform_id: parseInt(form.platform_id),
                workload_name:
                  workloads.find((w) => w.id === parseInt(form.workload_id))
                    ?.name || "Unknown",
                platform_name:
                  platforms.find((p) => p.id === parseInt(form.platform_id))
                    ?.name || "Unknown",
              }
            : s
        )
      );
      closeDrawer();
      setSnackbar({
        open: true,
        message: "Scenario updated successfully! (Demo mode)",
        severity: "success",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedScenario) return;

    setActionLoading(true);
    try {
      await scenariosAPI.delete(selectedScenario.id);
      setScenarios((prev) => prev.filter((s) => s.id !== selectedScenario.id));
      setDeleteDialogOpen(false);
      closeDrawer();
      setSnackbar({
        open: true,
        message: "Scenario deleted successfully!",
        severity: "success",
      });
    } catch (err: any) {
      // Mock delete for demo
      setScenarios((prev) => prev.filter((s) => s.id !== selectedScenario.id));
      setDeleteDialogOpen(false);
      closeDrawer();
      setSnackbar({
        open: true,
        message: "Scenario deleted successfully! (Demo mode)",
        severity: "success",
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        height: "100%",
      }}
    >
      {/* Scenario List */}
      <Box sx={{ flex: 1, pr: { md: 2 }, minWidth: 0 }}>
        <Typography variant="h4" fontWeight={900} gutterBottom>
          Scenarios
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Scenarios combine workloads and platforms to define simulation
          configurations.
        </Typography>
        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            sx={{ borderRadius: 1, fontWeight: 700 }}
            onClick={() => openDrawer("add")}
          >
            Create Scenario
          </Button>
        </Box>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : error ? (
          <Typography color="error" sx={{ mt: 4 }}>
            {error}
          </Typography>
        ) : scenarios.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 4 }}>
            No scenarios found.
          </Typography>
        ) : (
          <Grid container spacing={3}>
            {scenarios.map((s) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={s.id}>
                <Card
                  sx={{
                    borderRadius: 1,
                    background: "rgba(26,32,44,0.98)",
                    height: "100%",
                    cursor: "pointer",
                    transition: "all 0.2s ease-in-out",
                    border:
                      selectedScenario?.id === s.id && drawerOpen
                        ? "2px solid #4a9eff"
                        : "2px solid transparent",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: "0 8px 25px rgba(0,0,0,0.3)",
                    },
                  }}
                  onClick={() => openDrawer("view", s)}
                >
                  <CardContent>
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={2}
                      mb={2}
                    >
                      <Settings sx={{ fontSize: 36, color: "#4a9eff" }} />
                      <Box>
                        <Typography
                          variant="h6"
                          fontWeight={900}
                          sx={{ color: "#fff" }}
                        >
                          {s.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {s.created_at?.split("T")[0]}
                        </Typography>
                      </Box>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{ mb: 2 }}
                      color="text.secondary"
                    >
                      {s.description || "No description provided."}
                    </Typography>
                    {/* Workload & Platform Info */}
                    <Stack spacing={1} mb={2}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Storage sx={{ fontSize: 16, color: "#a0aec0" }} />
                        <Typography variant="body2" color="text.secondary">
                          {s.workload_name || "No workload"}
                        </Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Computer sx={{ fontSize: 16, color: "#a0aec0" }} />
                        <Typography variant="body2" color="text.secondary">
                          {s.platform_name || "No platform"}
                        </Typography>
                      </Stack>
                    </Stack>
                    <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
                      <Chip
                        label={s.creator_username || "user"}
                        size="small"
                        color="secondary"
                      />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Detail/Edit Panel */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        PaperProps={{
          sx: { width: { xs: "100%", md: 420 }, p: 3, background: "#1a202c" },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <Typography variant="h6" fontWeight={900} sx={{ flex: 1 }}>
            {panelMode === "add"
              ? "Create New Scenario"
              : panelMode === "edit"
              ? "Edit Scenario"
              : selectedScenario?.name || "Scenario Details"}
          </Typography>
          <IconButton onClick={closeDrawer}>
            <Close />
          </IconButton>
        </Box>
        {panelMode === "view" && selectedScenario && (
          <>
            <Typography variant="body2" sx={{ mb: 2 }} color="text.secondary">
              {selectedScenario.description || "No description provided."}
            </Typography>
            <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" gap={0.5}>
              <Chip
                label={selectedScenario.created_at?.split("T")[0]}
                size="small"
                color="default"
              />
              {selectedScenario.creator_username && (
                <Chip
                  label={`By ${selectedScenario.creator_username}`}
                  size="small"
                  color="primary"
                />
              )}
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <b>Components</b>
            </Typography>
            <Stack spacing={2} mb={2}>
              <Box
                sx={{
                  p: 2,
                  background: "rgba(74,158,255,0.08)",
                  borderRadius: 2,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <Storage sx={{ color: "#4a9eff" }} />
                  <Typography variant="subtitle2" fontWeight={700}>
                    Workload
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {selectedScenario.workload_name || "Not assigned"}
                </Typography>
              </Box>
              <Box
                sx={{
                  p: 2,
                  background: "rgba(74,158,255,0.08)",
                  borderRadius: 2,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <Computer sx={{ color: "#4a9eff" }} />
                  <Typography variant="subtitle2" fontWeight={700}>
                    Platform
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {selectedScenario.platform_name || "Not assigned"}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={2} mt={2}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<Edit />}
                onClick={() => setPanelMode("edit")}
                sx={{ fontWeight: 700, borderRadius: 1 }}
              >
                Edit
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Delete />}
                onClick={() => setDeleteDialogOpen(true)}
                sx={{ fontWeight: 700, borderRadius: 1 }}
              >
                Delete
              </Button>
            </Stack>
          </>
        )}
        {(panelMode === "edit" || panelMode === "add") && (
          <Box
            component="form"
            onSubmit={panelMode === "add" ? handleAdd : handleEdit}
            sx={{ mt: 2 }}
          >
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
              required
              sx={{ mb: 2 }}
            />
            <TextField
              label="Description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              fullWidth
              multiline
              minRows={2}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }} required>
              <InputLabel>Workload</InputLabel>
              <Select
                value={form.workload_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, workload_id: e.target.value }))
                }
                label="Workload"
              >
                {workloads.map((w) => (
                  <MenuItem key={w.id} value={w.id.toString()}>
                    {w.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }} required>
              <InputLabel>Platform</InputLabel>
              <Select
                value={form.platform_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, platform_id: e.target.value }))
                }
                label="Platform"
              >
                {platforms.map((p) => (
                  <MenuItem key={p.id} value={p.id.toString()}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {/* Prediction Configuration */}
            <PredictionConfig
              enabled={form.prediction_enabled}
              modelId={form.prediction_model_id}
              mode={form.prediction_mode}
              onEnabledChange={(enabled) => setForm((f) => ({ ...f, prediction_enabled: enabled }))}
              onModelChange={(modelId) => setForm((f) => ({ ...f, prediction_model_id: modelId }))}
              onModeChange={(mode) => setForm((f) => ({ ...f, prediction_mode: mode }))}
            />
            {formError && (
              <Typography color="error" sx={{ mb: 2 }}>
                {formError}
              </Typography>
            )}
            <Stack direction="row" spacing={2}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={
                  actionLoading ||
                  !form.name ||
                  !form.workload_id ||
                  !form.platform_id
                }
                sx={{ fontWeight: 700, borderRadius: 1 }}
              >
                {panelMode === "add" ? "Create" : "Save"}
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={closeDrawer}
                sx={{ fontWeight: 700, borderRadius: 1 }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
            </Stack>
          </Box>
        )}
        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>Delete Scenario</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete "{selectedScenario?.name}"? This
              action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setDeleteDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              color="error"
              disabled={actionLoading}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
        {/* Snackbar for feedback */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            severity={snackbar.severity}
            onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Drawer>
    </Box>
  );
};

export default ScenariosPage;
