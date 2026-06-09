import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Skeleton,
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
  IconButton,
} from "@mui/material";
import { Settings, Delete } from "@mui/icons-material";
import {
  scenariosAPI,
  workloadsAPI,
  platformsAPI,
  strategiesAPI,
  Scenario,
  Workload,
  Platform,
  Strategy,
} from "../services/api";
import { formatRelativeTime } from "../utils/format-relative-time";
import { SortMenu } from "../components/common/sort-menu";
import { PaginationFooter } from "../components/common/pagination-footer";
import { useListQueryParams } from "../utils/use-list-query-params";
import { SCENARIO_SORTS } from "../config/sort-options";
import { ScenarioCompositionRows } from "../components/scenarios/scenario-composition-rows";
import { ScenarioDetailDrawer } from "../components/scenarios/scenario-detail-drawer";
import { ExperimentCreateDialog } from "../components/experiments/experiment-create-dialog";
import { useViewMode } from "../utils/use-view-mode";
import { ViewToggle } from "../components/common/view-toggle";
import { EntityListTable } from "../components/common/entity-list-table";

const ScenariosPage: React.FC = () => {
  const { sort, order, page, size, skip, update } = useListQueryParams();
  const [total, setTotal] = useState(0);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [workloads, setWorkloads] = useState<Workload[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  // Drawer + "New Experiment" CTA state
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useViewMode("scenarios");
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [createExpOpen, setCreateExpOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    workload_id: "",
    platform_id: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Scenario | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    severity: "success" | "error";
  }>({ open: false, msg: "", severity: "success" });

  const loadScenarios = async () => {
    try {
      const res = await scenariosAPI.getAll({ sort_by: sort, order, skip, limit: size });
      const data = Array.isArray(res.data)
        ? res.data
        : (res.data as any).items || [];
      setScenarios(data);
      setTotal(Number(res.headers["x-total-count"] ?? data.length));
    } catch {
      setError("Failed to load scenarios.");
    }
  };

  const loadOptions = async () => {
    try {
      // Dropdowns need all entities, bypass the new default 20-item pagination
      const [wlRes, pfRes, stRes] = await Promise.all([
        workloadsAPI.getAll({ limit: 1000 }),
        platformsAPI.getAll({ limit: 1000 }),
        strategiesAPI.getAll({ limit: 1000 }),
      ]);
      const wl = Array.isArray(wlRes.data)
        ? wlRes.data
        : (wlRes.data as any).items || [];
      const pf = Array.isArray(pfRes.data)
        ? pfRes.data
        : (pfRes.data as any).items || [];
      setWorkloads(wl);
      setPlatforms(pf);
      setStrategies(Array.isArray(stRes.data) ? stRes.data : []);
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
  }, [sort, order, skip, size]);

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await scenariosAPI.delete(deleteTarget.id);
      setSnack({ open: true, msg: "Scenario deleted.", severity: "success" });
      setDeleteTarget(null);
      await loadScenarios();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : "Không xóa được — scenario có thể đang được thí nghiệm dùng.";
      setSnack({ open: true, msg, severity: "error" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={900} gutterBottom>
        Scenarios
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" spacing={2} sx={{ mb: 3, width: "100%" }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleOpenDialog}
          sx={{ borderRadius: 1, fontWeight: 700 }}
        >
          Create Scenario
        </Button>
        <Stack direction="row" spacing={2} alignItems="center">
          <ViewToggle value={viewMode} onChange={setViewMode} />
          <SortMenu
            options={SCENARIO_SORTS}
            value={`${sort}:${order}`}
            onChange={(s, o) => update({ sort: s, order: o, page: 1 })}
          />
        </Stack>
      </Stack>
      {loading ? (
        <Grid container spacing={3}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
      ) : error ? (
        <Alert severity="error" sx={{ mt: 4 }}>{error}</Alert>
      ) : scenarios.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 4 }}>
          No scenarios yet — click Create Scenario to define one.
        </Typography>
      ) : viewMode === "list" ? (
        <EntityListTable
          rows={scenarios}
          rowKey={(s) => s.id}
          onRowClick={(s) => { setSelectedScenario(s); setDrawerOpen(true); }}
          columns={[
            {
              key: "name", label: "Name",
              render: (s) => (
                <Typography variant="body2" fontWeight={600} noWrap title={s.name}>{s.name}</Typography>
              ),
            },
            {
              key: "workload", label: "Workload",
              render: (s) => (
                <Box>
                  <Typography variant="body2" noWrap>{s.workload?.name || s.workload_name || "-"}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {s.workload?.nb_res != null ? `${s.workload.nb_res} res` : ""}
                  </Typography>
                </Box>
              ),
            },
            {
              key: "platform", label: "Platform",
              render: (s) => (
                <Box>
                  <Typography variant="body2" noWrap>{s.platform?.name || s.platform_name || "-"}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {s.platform?.nb_hosts != null ? `${s.platform.nb_hosts} hosts` : ""}
                  </Typography>
                </Box>
              ),
            },
            {
              key: "compat", label: "Compatible",
              render: (s) =>
                s.workload?.nb_res != null && s.platform?.nb_hosts != null ? (
                  <Chip
                    size="small"
                    variant="outlined"
                    color={s.workload.nb_res <= s.platform.nb_hosts ? "success" : "warning"}
                    label={s.workload.nb_res <= s.platform.nb_hosts ? "Yes" : "Needs more hosts"}
                  />
                ) : "-",
            },
            {
              key: "created", label: "Created",
              render: (s) => (
                <Typography variant="caption" color="text.secondary">
                  {formatRelativeTime(s.created_at)}
                </Typography>
              ),
            },
            {
              key: "actions", label: "", align: "right", width: 56,
              render: (s) => (
                <IconButton
                  size="small"
                  color="error"
                  title="Delete scenario"
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }}
                >
                  <Delete fontSize="small" />
                </IconButton>
              ),
            },
          ]}
        />
      ) : (
        <Grid container spacing={3}>
          {scenarios.map((s) => (
            <Grid item xs={12} sm={6} md={4} key={s.id}>
              <Card
                onClick={() => { setSelectedScenario(s); setDrawerOpen(true); }}
                sx={{
                  borderRadius: 1,
                  background: "rgba(26,32,44,0.98)",
                  height: "100%",
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "box-shadow 200ms",
                  "&:hover": { boxShadow: 6 },
                }}
              >
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2} mb={1.5}>
                    <Settings sx={{ fontSize: 32, color: "#4a9eff" }} />
                    <Typography
                      variant="h6"
                      fontWeight={900}
                      noWrap
                      title={s.name}
                      sx={{ color: "#fff", minWidth: 0, flex: 1 }}
                    >
                      {s.name}
                    </Typography>
                    <IconButton
                      size="small"
                      color="error"
                      title="Delete scenario"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ mb: 1.5 }}
                    color="text.secondary"
                  >
                    {s.description || "No description provided."}
                  </Typography>
                  {/* Composition rows: workload + platform with direct stats */}
                  <ScenarioCompositionRows scenario={s} />
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label={formatRelativeTime(s.created_at)}
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
      {!loading && !error && (
        <PaginationFooter
          page={page}
          size={size}
          total={total}
          onPageChange={(p) => update({ page: p })}
          onSizeChange={(s) => update({ size: s, page: 1 })}
        />
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

      {/* Scenario detail drawer + prefilled New Experiment dialog */}
      <ScenarioDetailDrawer
        scenario={selectedScenario}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreateExperiment={() => setCreateExpOpen(true)}
      />
      <ExperimentCreateDialog
        open={createExpOpen}
        onClose={() => setCreateExpOpen(false)}
        onCreated={() => setCreateExpOpen(false)}
        scenarios={selectedScenario ? [selectedScenario] : []}
        strategies={strategies}
        onSnackbar={(msg, severity) => setSnack({ open: true, msg, severity })}
        initialScenarioId={selectedScenario?.id}
      />

      <Dialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Xóa scenario?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Xóa "{deleteTarget?.name}"? Hành động này không hoàn tác.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Hủy
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? "Đang xóa..." : "Xóa"}
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
