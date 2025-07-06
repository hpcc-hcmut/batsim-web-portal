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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  Paper,
  LinearProgress,
  Divider,
} from "@mui/material";
import { Science, PlayArrow, Stop, Add } from "@mui/icons-material";
import {
  experimentsAPI,
  Experiment,
  scenariosAPI,
  strategiesAPI,
  Scenario,
  Strategy,
} from "../services/api";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`experiment-tabpanel-${index}`}
      aria-labelledby={`experiment-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const ExperimentsPage: React.FC = () => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedExperiment, setSelectedExperiment] =
    useState<Experiment | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    scenario_id: "",
    strategy_id: "",
  });

  useEffect(() => {
    const fetchExperiments = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await experimentsAPI.getAll();
        const data = Array.isArray(res.data)
          ? res.data
          : (res.data as any).items || [];
        setExperiments(data);
      } catch (err: any) {
        setError("Failed to load experiments.");
      } finally {
        setLoading(false);
      }
    };
    fetchExperiments();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [scenariosRes, strategiesRes] = await Promise.all([
          scenariosAPI.getAll(),
          strategiesAPI.getAll(),
        ]);
        setScenarios(scenariosRes.data);
        setStrategies(strategiesRes.data);
      } catch (err) {
        console.error("Failed to fetch data:", err);
      }
    };
    fetchData();
  }, []);

  const handleCreateExperiment = async () => {
    try {
      await experimentsAPI.create({
        name: formData.name,
        description: formData.description,
        scenario_id: parseInt(formData.scenario_id),
        strategy_id: parseInt(formData.strategy_id),
      });
      setCreateDialogOpen(false);
      setFormData({
        name: "",
        description: "",
        scenario_id: "",
        strategy_id: "",
      });
      setSnackbar({
        open: true,
        message: "Experiment created successfully!",
        severity: "success",
      });
      // Refresh experiments list
      const res = await experimentsAPI.getAll();
      const data = Array.isArray(res.data)
        ? res.data
        : (res.data as any).items || [];
      setExperiments(data);
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: "Failed to create experiment",
        severity: "error",
      });
    }
  };

  const handleStartExperiment = async (experimentId: number) => {
    try {
      await experimentsAPI.start(experimentId);
      setSnackbar({
        open: true,
        message: "Experiment started successfully!",
        severity: "success",
      });
      // Refresh experiments list
      const res = await experimentsAPI.getAll();
      const data = Array.isArray(res.data)
        ? res.data
        : (res.data as any).items || [];
      setExperiments(data);
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: "Failed to start experiment",
        severity: "error",
      });
    }
  };

  const handleStopExperiment = async (experimentId: number) => {
    try {
      await experimentsAPI.stop(experimentId);
      setSnackbar({
        open: true,
        message: "Experiment stopped successfully!",
        severity: "success",
      });
      // Refresh experiments list
      const res = await experimentsAPI.getAll();
      const data = Array.isArray(res.data)
        ? res.data
        : (res.data as any).items || [];
      setExperiments(data);
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: "Failed to stop experiment",
        severity: "error",
      });
    }
  };

  const handleExperimentClick = (experiment: Experiment) => {
    setSelectedExperiment(experiment);
    setDetailDialogOpen(true);
    setTabValue(0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "default";
      case "running":
        return "primary";
      case "completed":
        return "success";
      case "failed":
        return "error";
      case "cancelled":
        return "warning";
      default:
        return "default";
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={900} gutterBottom>
        Experiments
      </Typography>
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setCreateDialogOpen(true)}
          startIcon={<Add />}
          sx={{ borderRadius: 1, fontWeight: 700 }}
        >
          Start New Experiment
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
      ) : experiments.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 4 }}>
          No experiments found.
        </Typography>
      ) : (
        <Grid container spacing={3}>
          {experiments.map((e) => (
            <Grid item xs={12} sm={6} md={4} key={e.id}>
              <Card
                sx={{
                  borderRadius: 1,
                  background: "rgba(26,32,44,0.98)",
                  height: "100%",
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "0 8px 25px rgba(0,0,0,0.3)",
                  },
                }}
                onClick={() => handleExperimentClick(e)}
              >
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                    <Science sx={{ fontSize: 36, color: "#4a9eff" }} />
                    <Box>
                      <Typography
                        variant="h6"
                        fontWeight={900}
                        sx={{ color: "#fff" }}
                      >
                        {e.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Status: {e.status}
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ mb: 2 }}
                    color="text.secondary"
                  >
                    {e.description || "No description provided."}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    <Chip
                      label={e.created_at?.split("T")[0]}
                      size="small"
                      color="default"
                    />
                    <Chip
                      label={e.scenario_name || "Scenario"}
                      size="small"
                      color="secondary"
                    />
                    <Chip
                      label={e.strategy_name || "Strategy"}
                      size="small"
                      color="secondary"
                    />
                  </Stack>
                  {e.status === "running" && (
                    <Box sx={{ mb: 2 }}>
                      <LinearProgress
                        variant="determinate"
                        value={e.progress_percentage || 0}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 0.5, display: "block" }}
                      >
                        {e.progress_percentage || 0}% Complete
                      </Typography>
                    </Box>
                  )}
                  {e.status === "pending" && (
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      startIcon={<PlayArrow />}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleStartExperiment(e.id);
                      }}
                      sx={{ mr: 1 }}
                    >
                      Start
                    </Button>
                  )}
                  {e.status === "running" && (
                    <Button
                      variant="contained"
                      color="error"
                      size="small"
                      startIcon={<Stop />}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleStopExperiment(e.id);
                      }}
                    >
                      Stop
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Experiment Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Experiment</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Experiment Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              fullWidth
              multiline
              rows={3}
            />
            <FormControl fullWidth required>
              <InputLabel>Scenario</InputLabel>
              <Select
                value={formData.scenario_id}
                onChange={(e) =>
                  setFormData({ ...formData, scenario_id: e.target.value })
                }
                label="Scenario"
              >
                {scenarios.map((scenario) => (
                  <MenuItem key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>Strategy</InputLabel>
              <Select
                value={formData.strategy_id}
                onChange={(e) =>
                  setFormData({ ...formData, strategy_id: e.target.value })
                }
                label="Strategy"
              >
                {strategies.map((strategy) => (
                  <MenuItem key={strategy.id} value={strategy.id}>
                    {strategy.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateExperiment}
            variant="contained"
            disabled={
              !formData.name || !formData.scenario_id || !formData.strategy_id
            }
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Experiment Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { height: "80vh" } }}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Science sx={{ fontSize: 32, color: "#4a9eff" }} />
            <Box>
              <Typography variant="h5" fontWeight={900}>
                {selectedExperiment?.name}
              </Typography>
              <Chip
                label={selectedExperiment?.status}
                color={getStatusColor(selectedExperiment?.status || "")}
                size="small"
              />
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tabs
              value={tabValue}
              onChange={(_, newValue) => setTabValue(newValue)}
            >
              <Tab label="Overview" />
              <Tab label="Execution" />
              <Tab label="Logs" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <Stack spacing={3}>
              <Typography variant="h6">Experiment Details</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedExperiment?.description || "No description provided."}
              </Typography>

              <Divider />

              <Typography variant="h6">Components</Typography>
              <Stack direction="row" spacing={2}>
                <Chip
                  label={`Scenario: ${selectedExperiment?.scenario_name}`}
                  color="primary"
                />
                <Chip
                  label={`Strategy: ${selectedExperiment?.strategy_name}`}
                  color="info"
                />
              </Stack>

              <Divider />

              <Typography variant="h6">Timing</Typography>
              <Stack spacing={1}>
                <Typography variant="body2">
                  Created:{" "}
                  {selectedExperiment?.created_at
                    ? new Date(selectedExperiment.created_at).toLocaleString()
                    : "N/A"}
                </Typography>
                {selectedExperiment?.start_time && (
                  <Typography variant="body2">
                    Started:{" "}
                    {new Date(selectedExperiment.start_time).toLocaleString()}
                  </Typography>
                )}
                {selectedExperiment?.end_time && (
                  <Typography variant="body2">
                    Ended:{" "}
                    {new Date(selectedExperiment.end_time).toLocaleString()}
                  </Typography>
                )}
              </Stack>
            </Stack>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Stack spacing={3}>
              <Typography variant="h6">Execution Status</Typography>

              {selectedExperiment?.status === "running" && (
                <Box>
                  <LinearProgress
                    variant="determinate"
                    value={selectedExperiment.progress_percentage || 0}
                    sx={{ height: 8, borderRadius: 4, mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Progress: {selectedExperiment.progress_percentage || 0}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Jobs: {selectedExperiment.completed_jobs || 0} /{" "}
                    {selectedExperiment.total_jobs || 0}
                  </Typography>
                </Box>
              )}

              <Divider />

              <Typography variant="h6">Actions</Typography>
              <Box sx={{ display: "flex", gap: 2 }}>
                {selectedExperiment?.status === "pending" && (
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<PlayArrow />}
                    onClick={() => {
                      handleStartExperiment(selectedExperiment.id);
                      setDetailDialogOpen(false);
                    }}
                  >
                    Start Experiment
                  </Button>
                )}
                {selectedExperiment?.status === "running" && (
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<Stop />}
                    onClick={() => {
                      handleStopExperiment(selectedExperiment.id);
                      setDetailDialogOpen(false);
                    }}
                  >
                    Stop Experiment
                  </Button>
                )}
              </Box>
            </Stack>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Stack spacing={3}>
              <Typography variant="h6">Execution Logs</Typography>

              {selectedExperiment?.batsim_logs && (
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Batsim Logs
                  </Typography>
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: "grey.900",
                      maxHeight: 200,
                      overflow: "auto",
                    }}
                  >
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                    >
                      {selectedExperiment.batsim_logs}
                    </Typography>
                  </Paper>
                </Box>
              )}

              {selectedExperiment?.pybatsim_logs && (
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Pybatsim Logs
                  </Typography>
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: "grey.900",
                      maxHeight: 200,
                      overflow: "auto",
                    }}
                  >
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                    >
                      {selectedExperiment.pybatsim_logs}
                    </Typography>
                  </Paper>
                </Box>
              )}

              {!selectedExperiment?.batsim_logs &&
                !selectedExperiment?.pybatsim_logs && (
                  <Typography color="text.secondary">
                    No logs available yet.
                  </Typography>
                )}
            </Stack>
          </TabPanel>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ExperimentsPage;
