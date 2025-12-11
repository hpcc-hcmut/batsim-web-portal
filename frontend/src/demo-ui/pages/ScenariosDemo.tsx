import React, { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
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
  Snackbar,
  Alert,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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
import { mockScenarios, mockWorkloads, mockPlatforms, MockScenario } from "../mockData";

const ScenariosDemo: React.FC = () => {
  const [scenarios, setScenarios] = useState<MockScenario[]>(mockScenarios);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<"view" | "edit" | "add">("view");
  const [selectedScenario, setSelectedScenario] = useState<MockScenario | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });
  const [form, setForm] = useState({
    name: "",
    description: "",
    workload_id: "",
    platform_id: "",
  });

  const openDrawer = (mode: "view" | "edit" | "add", scenario?: MockScenario) => {
    setPanelMode(mode);
    setSelectedScenario(scenario || null);
    if (mode === "add") {
      setForm({ name: "", description: "", workload_id: "", platform_id: "" });
    } else if (scenario) {
      setForm({
        name: scenario.name,
        description: scenario.description,
        workload_id: scenario.workload_id.toString(),
        platform_id: scenario.platform_id.toString(),
      });
    }
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedScenario(null);
  };

  const handleAdd = () => {
    const workload = mockWorkloads.find((w) => w.id === parseInt(form.workload_id));
    const platform = mockPlatforms.find((p) => p.id === parseInt(form.platform_id));
    const newScenario: MockScenario = {
      id: Date.now(),
      name: form.name,
      description: form.description,
      workload_id: parseInt(form.workload_id),
      platform_id: parseInt(form.platform_id),
      workload_name: workload?.name || "Unknown",
      platform_name: platform?.name || "Unknown",
      created_at: new Date().toISOString(),
      creator_username: "demo_user",
    };
    setScenarios((prev) => [newScenario, ...prev]);
    closeDrawer();
    setSnackbar({ open: true, message: "Scenario created successfully!", severity: "success" });
  };

  const handleEdit = () => {
    if (!selectedScenario) return;
    const workload = mockWorkloads.find((w) => w.id === parseInt(form.workload_id));
    const platform = mockPlatforms.find((p) => p.id === parseInt(form.platform_id));
    setScenarios((prev) =>
      prev.map((s) =>
        s.id === selectedScenario.id
          ? {
              ...s,
              name: form.name,
              description: form.description,
              workload_id: parseInt(form.workload_id),
              platform_id: parseInt(form.platform_id),
              workload_name: workload?.name || s.workload_name,
              platform_name: platform?.name || s.platform_name,
            }
          : s
      )
    );
    closeDrawer();
    setSnackbar({ open: true, message: "Scenario updated successfully!", severity: "success" });
  };

  const handleDelete = () => {
    if (!selectedScenario) return;
    setScenarios((prev) => prev.filter((s) => s.id !== selectedScenario.id));
    setDeleteDialogOpen(false);
    closeDrawer();
    setSnackbar({ open: true, message: "Scenario deleted successfully!", severity: "success" });
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={900} gutterBottom>
            Scenarios
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Combine workloads and platforms to define simulation configurations
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={() => openDrawer("add")}
          sx={{ borderRadius: 1, fontWeight: 700 }}
        >
          Create Scenario
        </Button>
      </Box>

      {/* Card Grid */}
      <Grid container spacing={3}>
        {scenarios.map((s) => (
          <Grid item xs={12} sm={6} md={4} key={s.id}>
            <Card
              sx={{
                borderRadius: 2,
                background: "rgba(26,32,44,0.98)",
                height: "100%",
                cursor: "pointer",
                transition: "all 0.2s ease-in-out",
                border: selectedScenario?.id === s.id && drawerOpen
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
                <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                  <Settings sx={{ fontSize: 36, color: "#4a9eff" }} />
                  <Box>
                    <Typography variant="h6" fontWeight={900} sx={{ color: "#fff" }}>
                      {s.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {s.created_at.split("T")[0]}
                    </Typography>
                  </Box>
                </Stack>
                <Typography variant="body2" sx={{ mb: 2 }} color="text.secondary">
                  {s.description}
                </Typography>
                <Stack spacing={1} mb={2}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Storage sx={{ fontSize: 16, color: "#a0aec0" }} />
                    <Typography variant="body2" color="text.secondary">
                      {s.workload_name}
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Computer sx={{ fontSize: 16, color: "#a0aec0" }} />
                    <Typography variant="body2" color="text.secondary">
                      {s.platform_name}
                    </Typography>
                  </Stack>
                </Stack>
                <Chip label={s.creator_username} size="small" color="secondary" />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

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
              {selectedScenario.description}
            </Typography>
            <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" gap={0.5}>
              <Chip label={selectedScenario.created_at.split("T")[0]} size="small" />
              <Chip label={`By ${selectedScenario.creator_username}`} size="small" color="primary" />
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <b>Components</b>
            </Typography>
            <Stack spacing={2} mb={2}>
              <Box sx={{ p: 2, background: "rgba(74,158,255,0.08)", borderRadius: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <Storage sx={{ color: "#4a9eff" }} />
                  <Typography variant="subtitle2" fontWeight={700}>
                    Workload
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {selectedScenario.workload_name}
                </Typography>
              </Box>
              <Box sx={{ p: 2, background: "rgba(74,158,255,0.08)", borderRadius: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <Computer sx={{ color: "#4a9eff" }} />
                  <Typography variant="subtitle2" fontWeight={700}>
                    Platform
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {selectedScenario.platform_name}
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
          <Box component="form" sx={{ mt: 2 }}>
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
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }} required>
              <InputLabel>Workload</InputLabel>
              <Select
                value={form.workload_id}
                onChange={(e) => setForm((f) => ({ ...f, workload_id: e.target.value }))}
                label="Workload"
              >
                {mockWorkloads.map((w) => (
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
                onChange={(e) => setForm((f) => ({ ...f, platform_id: e.target.value }))}
                label="Platform"
              >
                {mockPlatforms.map((p) => (
                  <MenuItem key={p.id} value={p.id.toString()}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={panelMode === "add" ? handleAdd : handleEdit}
                disabled={!form.name || !form.workload_id || !form.platform_id}
                sx={{ fontWeight: 700, borderRadius: 1 }}
              >
                {panelMode === "add" ? "Create" : "Save"}
              </Button>
              <Button
                variant="outlined"
                onClick={closeDrawer}
                sx={{ fontWeight: 700, borderRadius: 1, color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}
              >
                Cancel
              </Button>
            </Stack>
          </Box>
        )}
      </Drawer>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Scenario</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedScenario?.name}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: "#fff" }}>Cancel</Button>
          <Button onClick={handleDelete} color="error">Delete</Button>
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

export default ScenariosDemo;
