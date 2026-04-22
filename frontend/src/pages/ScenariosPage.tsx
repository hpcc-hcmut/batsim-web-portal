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
  Snackbar,
  Alert,
} from "@mui/material";
import { Settings } from "@mui/icons-material";
import {
  scenariosAPI,
  workloadsAPI,
  platformsAPI,
  Scenario,
  Workload,
  Platform,
} from "../services/api";

const ScenariosPage: React.FC = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [workloads, setWorkloads] = useState<Workload[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    workload_id: "",
    platform_id: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    severity: "success" | "error";
  }>({ open: false, msg: "", severity: "success" });

  const loadScenarios = async () => {
    try {
      const res = await scenariosAPI.getAll();
      const data = Array.isArray(res.data)
        ? res.data
        : (res.data as any).items || [];
      setScenarios(data);
    } catch {
      setError("Failed to load scenarios.");
    }
  };

  const loadOptions = async () => {
    try {
      const [wlRes, pfRes] = await Promise.all([
        workloadsAPI.getAll(),
        platformsAPI.getAll(),
      ]);
      const wl = Array.isArray(wlRes.data)
        ? wlRes.data
        : (wlRes.data as any).items || [];
      const pf = Array.isArray(pfRes.data)
        ? pfRes.data
        : (pfRes.data as any).items || [];
      setWorkloads(wl);
      setPlatforms(pf);
    } catch {
      // non-fatal — the dialog will just show empty selects
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      await Promise.all([loadScenarios(), loadOptions()]);
      setLoading(false);
    })();
  }, []);

  const handleOpenDialog = () => {
    setForm({ name: "", description: "", workload_id: "", platform_id: "" });
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!form.name || !form.workload_id || !form.platform_id) {
      setSnack({
        open: true,
        msg: "Name, workload and platform are required.",
        severity: "error",
      });
      return;
    }
    setSubmitting(true);
    try {
      await scenariosAPI.create({
        name: form.name,
        description: form.description || undefined,
        workload_id: parseInt(form.workload_id),
        platform_id: parseInt(form.platform_id),
      } as any);
      setDialogOpen(false);
      setSnack({
        open: true,
        msg: "Scenario created successfully.",
        severity: "success",
      });
      await loadScenarios();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : detail?.[0]?.msg || "Failed to create scenario.";
      setSnack({ open: true, msg, severity: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={900} gutterBottom>
        Scenarios
      </Typography>
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleOpenDialog}
          sx={{ borderRadius: 1, fontWeight: 700 }}
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
            <Grid item xs={12} sm={6} md={4} key={s.id}>
              <Card
                sx={{
                  borderRadius: 1,
                  background: "rgba(26,32,44,0.98)",
                  height: "100%",
                }}
              >
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
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
                        Workload: {s.workload_name || "-"}
                        {s.workload_version ? ` (v${s.workload_version})` : ""} | Platform:{" "}
                        {s.platform_name || "-"}
                        {s.platform_version ? ` (v${s.platform_version})` : ""}
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
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label={s.created_at?.split("T")[0]}
                      size="small"
                      color="default"
                    />
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

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Scenario</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Scenario Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              fullWidth
              multiline
              rows={3}
            />
            <FormControl fullWidth required>
              <InputLabel>Workload</InputLabel>
              <Select
                label="Workload"
                value={form.workload_id}
                onChange={(e) =>
                  setForm({ ...form, workload_id: String(e.target.value) })
                }
              >
                {workloads.map((w) => (
                  <MenuItem key={w.id} value={w.id}>
                    {w.name}
                    {w.version ? ` (v${w.version})` : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>Platform</InputLabel>
              <Select
                label="Platform"
                value={form.platform_id}
                onChange={(e) =>
                  setForm({ ...form, platform_id: String(e.target.value) })
                }
              >
                {platforms.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                    {p.version ? ` (v${p.version})` : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={submitting}
          >
            {submitting ? "Creating..." : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack({ ...snack, open: false })}
          variant="filled"
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ScenariosPage;
