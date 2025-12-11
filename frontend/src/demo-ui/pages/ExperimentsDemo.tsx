import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
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
  Snackbar,
  Alert,
  LinearProgress,
  Tabs,
  Tab,
  Divider,
  Paper,
} from "@mui/material";
import {
  Science,
  PlayArrow,
  Pause,
  Stop,
  Add,
  Refresh,
} from "@mui/icons-material";
import {
  mockExperiments,
  mockScenarios,
  mockStrategies,
  MockExperiment,
} from "../mockData";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const ExperimentsDemo: React.FC = () => {
  const [experiments, setExperiments] = useState<MockExperiment[]>(mockExperiments);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<MockExperiment | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    scenario_id: "",
    strategy_id: "",
  });

  // Simulate running experiments progress
  useEffect(() => {
    const interval = setInterval(() => {
      setExperiments((prev) =>
        prev.map((exp) => {
          if (exp.status === "running" && exp.progress_percentage < 100) {
            const newProgress = Math.min(exp.progress_percentage + Math.random() * 3, 100);
            const newCompleted = Math.floor((newProgress / 100) * exp.total_jobs);
            return {
              ...exp,
              progress_percentage: newProgress,
              completed_jobs: newCompleted,
              status: newProgress >= 100 ? "completed" : "running",
              end_time: newProgress >= 100 ? new Date().toISOString() : null,
            };
          }
          return exp;
        })
      );
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  const handleCreateExperiment = () => {
    const scenario = mockScenarios.find((s) => s.id === parseInt(formData.scenario_id));
    const strategy = mockStrategies.find((s) => s.id === parseInt(formData.strategy_id));
    const newExperiment: MockExperiment = {
      id: Date.now(),
      name: formData.name,
      description: formData.description,
      scenario_id: parseInt(formData.scenario_id),
      strategy_id: parseInt(formData.strategy_id),
      scenario_name: scenario?.name || "Unknown",
      strategy_name: strategy?.name || "Unknown",
      status: "pending",
      progress_percentage: 0,
      completed_jobs: 0,
      total_jobs: Math.floor(Math.random() * 1000) + 100,
      start_time: null,
      end_time: null,
      created_at: new Date().toISOString(),
      creator_username: "demo_user",
    };
    setExperiments((prev) => [newExperiment, ...prev]);
    setCreateDialogOpen(false);
    setFormData({ name: "", description: "", scenario_id: "", strategy_id: "" });
    setSnackbar({ open: true, message: "Experiment created successfully!", severity: "success" });
  };

  const handleStartExperiment = (experimentId: number) => {
    setExperiments((prev) =>
      prev.map((exp) =>
        exp.id === experimentId
          ? { ...exp, status: "running", start_time: new Date().toISOString() }
          : exp
      )
    );
    setSnackbar({ open: true, message: "Experiment started!", severity: "success" });
  };

  const handlePauseExperiment = (experimentId: number) => {
    setExperiments((prev) =>
      prev.map((exp) =>
        exp.id === experimentId ? { ...exp, status: "paused" } : exp
      )
    );
    setSnackbar({ open: true, message: "Experiment paused!", severity: "success" });
  };

  const handleStopExperiment = (experimentId: number) => {
    setExperiments((prev) =>
      prev.map((exp) =>
        exp.id === experimentId
          ? { ...exp, status: "cancelled", end_time: new Date().toISOString() }
          : exp
      )
    );
    setSnackbar({ open: true, message: "Experiment stopped!", severity: "success" });
  };

  const handleExperimentClick = (experiment: MockExperiment) => {
    setSelectedExperiment(experiment);
    setDetailDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "default";
      case "running": return "primary";
      case "paused": return "warning";
      case "completed": return "success";
      case "failed": return "error";
      case "cancelled": return "error";
      default: return "default";
    }
  };

  const pendingExperiments = experiments.filter((e) => e.status === "pending");
  const runningExperiments = experiments.filter((e) => e.status === "running" || e.status === "paused");
  const completedExperiments = experiments.filter((e) => e.status === "completed" || e.status === "failed" || e.status === "cancelled");

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={900} gutterBottom>
            Experiments
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create, run, and manage BatSim simulation experiments
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{ borderRadius: 1, fontWeight: 700 }}
        >
          New Experiment
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ p: 2, background: "rgba(26,32,44,0.98)", borderRadius: 2 }}>
            <Typography variant="h4" fontWeight={700} color="text.secondary">
              {pendingExperiments.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">Pending</Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ p: 2, background: "rgba(26,32,44,0.98)", borderRadius: 2 }}>
            <Typography variant="h4" fontWeight={700} sx={{ color: "#4a9eff" }}>
              {runningExperiments.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">Running</Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ p: 2, background: "rgba(26,32,44,0.98)", borderRadius: 2 }}>
            <Typography variant="h4" fontWeight={700} sx={{ color: "#4caf50" }}>
              {completedExperiments.filter((e) => e.status === "completed").length}
            </Typography>
            <Typography variant="body2" color="text.secondary">Completed</Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ p: 2, background: "rgba(26,32,44,0.98)", borderRadius: 2 }}>
            <Typography variant="h4" fontWeight={700} sx={{ color: "#f44336" }}>
              {completedExperiments.filter((e) => e.status === "failed" || e.status === "cancelled").length}
            </Typography>
            <Typography variant="body2" color="text.secondary">Failed/Cancelled</Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ background: "rgba(26,32,44,0.98)", borderRadius: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          sx={{ px: 2, pt: 1 }}
        >
          <Tab label={`Pending (${pendingExperiments.length})`} sx={{ fontWeight: 700 }} />
          <Tab label={`Running (${runningExperiments.length})`} sx={{ fontWeight: 700 }} />
          <Tab label={`Completed (${completedExperiments.length})`} sx={{ fontWeight: 700 }} />
        </Tabs>
        <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

        <Box sx={{ p: 2 }}>
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={2}>
              {pendingExperiments.map((exp) => (
                <Grid item xs={12} md={6} lg={4} key={exp.id}>
                  <ExperimentCard
                    experiment={exp}
                    onClick={() => handleExperimentClick(exp)}
                    onStart={() => handleStartExperiment(exp.id)}
                  />
                </Grid>
              ))}
              {pendingExperiments.length === 0 && (
                <Grid item xs={12}>
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    No pending experiments
                  </Typography>
                </Grid>
              )}
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={2}>
              {runningExperiments.map((exp) => (
                <Grid item xs={12} md={6} lg={4} key={exp.id}>
                  <ExperimentCard
                    experiment={exp}
                    onClick={() => handleExperimentClick(exp)}
                    onPause={() => handlePauseExperiment(exp.id)}
                    onStop={() => handleStopExperiment(exp.id)}
                    onStart={() => handleStartExperiment(exp.id)}
                  />
                </Grid>
              ))}
              {runningExperiments.length === 0 && (
                <Grid item xs={12}>
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    No running experiments
                  </Typography>
                </Grid>
              )}
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Grid container spacing={2}>
              {completedExperiments.map((exp) => (
                <Grid item xs={12} md={6} lg={4} key={exp.id}>
                  <ExperimentCard
                    experiment={exp}
                    onClick={() => handleExperimentClick(exp)}
                  />
                </Grid>
              ))}
              {completedExperiments.length === 0 && (
                <Grid item xs={12}>
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    No completed experiments
                  </Typography>
                </Grid>
              )}
            </Grid>
          </TabPanel>
        </Box>
      </Paper>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Experiment</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Experiment Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
            <FormControl fullWidth required>
              <InputLabel>Scenario</InputLabel>
              <Select
                value={formData.scenario_id}
                onChange={(e) => setFormData({ ...formData, scenario_id: e.target.value })}
                label="Scenario"
              >
                {mockScenarios.map((scenario) => (
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
                onChange={(e) => setFormData({ ...formData, strategy_id: e.target.value })}
                label="Strategy"
              >
                {mockStrategies.map((strategy) => (
                  <MenuItem key={strategy.id} value={strategy.id}>
                    {strategy.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} sx={{ color: "#fff" }}>Cancel</Button>
          <Button
            onClick={handleCreateExperiment}
            variant="contained"
            disabled={!formData.name || !formData.scenario_id || !formData.strategy_id}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
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
        <DialogContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Description
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {selectedExperiment?.description || "No description"}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Configuration
              </Typography>
              <Stack spacing={1}>
                <Chip label={`Scenario: ${selectedExperiment?.scenario_name}`} />
                <Chip label={`Strategy: ${selectedExperiment?.strategy_name}`} />
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Progress
              </Typography>
              {selectedExperiment && (
                <>
                  <LinearProgress
                    variant="determinate"
                    value={selectedExperiment.progress_percentage}
                    sx={{ height: 10, borderRadius: 5, mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {selectedExperiment.progress_percentage.toFixed(0)}% - Jobs: {selectedExperiment.completed_jobs}/{selectedExperiment.total_jobs}
                  </Typography>
                </>
              )}
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Timeline
              </Typography>
              <Stack spacing={1}>
                <Typography variant="body2">
                  Created: {selectedExperiment?.created_at?.split("T")[0]}
                </Typography>
                {selectedExperiment?.start_time && (
                  <Typography variant="body2">
                    Started: {selectedExperiment.start_time.split("T")[0]}
                  </Typography>
                )}
                {selectedExperiment?.end_time && (
                  <Typography variant="body2">
                    Ended: {selectedExperiment.end_time.split("T")[0]}
                  </Typography>
                )}
              </Stack>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Experiment Card Component
interface ExperimentCardProps {
  experiment: MockExperiment;
  onClick: () => void;
  onStart?: () => void;
  onPause?: () => void;
  onStop?: () => void;
}

const ExperimentCard: React.FC<ExperimentCardProps> = ({
  experiment,
  onClick,
  onStart,
  onPause,
  onStop,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "default";
      case "running": return "primary";
      case "paused": return "warning";
      case "completed": return "success";
      case "failed": return "error";
      case "cancelled": return "error";
      default: return "default";
    }
  };

  return (
    <Card
      sx={{
        borderRadius: 2,
        background: "rgba(26,32,44,0.98)",
        height: "100%",
        cursor: "pointer",
        transition: "all 0.2s",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "0 8px 25px rgba(0,0,0,0.3)",
        },
      }}
      onClick={onClick}
    >
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2} mb={2}>
          <Science sx={{ fontSize: 32, color: "#4a9eff" }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={900} sx={{ color: "#fff" }}>
              {experiment.name}
            </Typography>
            <Chip
              label={experiment.status.charAt(0).toUpperCase() + experiment.status.slice(1)}
              size="small"
              color={getStatusColor(experiment.status)}
              sx={{ fontWeight: 700 }}
            />
          </Box>
        </Stack>
        <Typography variant="body2" sx={{ mb: 2 }} color="text.secondary">
          {experiment.description}
        </Typography>
        <Stack direction="row" spacing={1} mb={2}>
          <Chip label={experiment.scenario_name} size="small" color="secondary" />
          <Chip label={experiment.strategy_name} size="small" color="secondary" />
        </Stack>

        {(experiment.status === "running" || experiment.status === "paused") && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress
              variant="determinate"
              value={experiment.progress_percentage}
              sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
            />
            <Typography variant="caption" color="text.secondary">
              {experiment.progress_percentage.toFixed(0)}% - {experiment.completed_jobs}/{experiment.total_jobs} jobs
            </Typography>
          </Box>
        )}

        <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
          {experiment.status === "pending" && onStart && (
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<PlayArrow />}
              onClick={onStart}
            >
              Start
            </Button>
          )}
          {experiment.status === "running" && onPause && (
            <Button
              variant="contained"
              color="warning"
              size="small"
              startIcon={<Pause />}
              onClick={onPause}
            >
              Pause
            </Button>
          )}
          {experiment.status === "paused" && onStart && (
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<PlayArrow />}
              onClick={onStart}
            >
              Resume
            </Button>
          )}
          {(experiment.status === "running" || experiment.status === "paused") && onStop && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<Stop />}
              onClick={onStop}
            >
              Stop
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ExperimentsDemo;
