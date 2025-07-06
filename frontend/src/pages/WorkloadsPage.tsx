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
  InputLabel,
  FormControl,
  FormHelperText,
  Snackbar,
  Alert,
  Collapse,
  Divider,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import {
  Edit,
  Delete,
  Close,
  UploadFile,
  Download,
  ExpandMore,
  Description,
  Code as CodeIcon,
} from "@mui/icons-material";
import { Storage } from "@mui/icons-material";
import { workloadsAPI, Workload } from "../services/api";

type PanelMode = "view" | "edit" | "add";

function getFileTypeIcon(fileType: string | undefined) {
  if (!fileType) return <Description sx={{ color: "#4a9eff" }} />;
  if (fileType.includes("json")) return <CodeIcon sx={{ color: "#4a9eff" }} />;
  if (fileType.includes("csv")) return <CodeIcon sx={{ color: "#4a9eff" }} />;
  return <Description sx={{ color: "#4a9eff" }} />;
}

const WorkloadsPage: React.FC = () => {
  const [workloads, setWorkloads] = useState<Workload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("view");
  const [selectedWorkload, setSelectedWorkload] = useState<Workload | null>(
    null
  );
  const [form, setForm] = useState<{
    name: string;
    description: string;
    file: File | null;
  }>({ name: "", description: "", file: null });
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });
  const [expandedJobs, setExpandedJobs] = useState(false);
  const [expandedProfiles, setExpandedProfiles] = useState(false);

  useEffect(() => {
    const fetchWorkloads = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await workloadsAPI.getAll();
        setWorkloads(res.data);
      } catch (err: any) {
        setError("Failed to load workloads.");
      } finally {
        setLoading(false);
      }
    };
    fetchWorkloads();
  }, []);

  const openDrawer = (mode: PanelMode, workload?: Workload) => {
    setPanelMode(mode);
    setSelectedWorkload(workload || null);
    setForm({
      name: workload?.name || "",
      description: workload?.description || "",
      file: null,
    });
    setDrawerOpen(true);
    setFormError(null);
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedWorkload(null);
    setFormError(null);
  };
  const handleDelete = async () => {
    if (!selectedWorkload) return;
    setActionLoading(true);
    try {
      await workloadsAPI.delete(selectedWorkload.id);
      setWorkloads((prev) => prev.filter((w) => w.id !== selectedWorkload.id));
      setDeleteDialogOpen(false);
      closeDrawer();
      setSnackbar({
        open: true,
        message: "Workload deleted successfully!",
        severity: "success",
      });
    } catch (err: any) {
      setFormError("Failed to delete workload.");
    } finally {
      setActionLoading(false);
    }
  };
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkload) return;
    setActionLoading(true);
    try {
      await workloadsAPI.update(selectedWorkload.id, {
        name: form.name,
        description: form.description,
      });
      setWorkloads((prev) =>
        prev.map((w) =>
          w.id === selectedWorkload.id
            ? { ...w, name: form.name, description: form.description }
            : w
        )
      );
      closeDrawer();
      setSnackbar({
        open: true,
        message: "Workload updated successfully!",
        severity: "success",
      });
    } catch (err: any) {
      setFormError("Failed to update workload.");
    } finally {
      setActionLoading(false);
    }
  };
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.file) {
      setFormError("Name and file are required.");
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("description", form.description);
      formData.append("file", form.file);
      const res = await workloadsAPI.create(formData);
      setWorkloads((prev) => [res.data, ...prev]);
      closeDrawer();
      setSnackbar({
        open: true,
        message: "Workload uploaded successfully!",
        severity: "success",
      });
    } catch (err: any) {
      setFormError("Failed to add workload.");
    } finally {
      setActionLoading(false);
    }
  };
  const handleDownload = async () => {
    if (!selectedWorkload) return;
    try {
      const res = await workloadsAPI.download(selectedWorkload.id);
      const { file_path, file_name } = res.data;
      // For demo: just open the file path (in real app, use a proper download endpoint)
      window.open(file_path, "_blank");
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to download file.",
        severity: "error",
      });
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
      {/* Workload List */}
      <Box sx={{ flex: 1, pr: { md: 2 }, minWidth: 0 }}>
        <Typography variant="h4" fontWeight={900} gutterBottom>
          Workloads
        </Typography>
        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<UploadFile />}
            sx={{ borderRadius: 1, fontWeight: 700 }}
            onClick={() => openDrawer("add")}
          >
            Upload New Workload
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
        ) : workloads.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 4 }}>
            No workloads found.
          </Typography>
        ) : (
          <Grid container spacing={3}>
            {workloads.map((w) => (
              <Grid item xs={12} sm={6} md={4} key={w.id}>
                <Card
                  sx={{
                    borderRadius: 1,
                    background: "rgba(26,32,44,0.98)",
                    height: "100%",
                    cursor: "pointer",
                    border:
                      selectedWorkload?.id === w.id && drawerOpen
                        ? "2px solid #4a9eff"
                        : undefined,
                  }}
                  onClick={() => openDrawer("view", w)}
                >
                  <CardContent>
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={2}
                      mb={2}
                    >
                      <Storage sx={{ fontSize: 36, color: "#4a9eff" }} />
                      <Box>
                        <Typography
                          variant="h6"
                          fontWeight={900}
                          sx={{ color: "#fff" }}
                        >
                          {w.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {w.file_type?.toUpperCase() || "File"} •{" "}
                          {w.file_size
                            ? `${(w.file_size / 1024).toFixed(1)} KB`
                            : "Unknown size"}
                        </Typography>
                      </Box>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{ mb: 2 }}
                      color="text.secondary"
                    >
                      {w.description || "No description provided."}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip
                        label={w.file_type || "file"}
                        size="small"
                        color="secondary"
                      />
                      <Chip
                        label={w.created_at?.split("T")[0]}
                        size="small"
                        color="default"
                      />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
      {/* Drawer for Detail/Edit/Add */}
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
              ? "Upload New Workload"
              : panelMode === "edit"
              ? "Edit Workload"
              : selectedWorkload?.name || "Workload Details"}
          </Typography>
          <IconButton onClick={closeDrawer}>
            <Close />
          </IconButton>
        </Box>
        {panelMode === "view" && selectedWorkload && (
          <>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 1 }}
            >
              {getFileTypeIcon(selectedWorkload.file_type)}
              <Typography variant="subtitle2" color="text.secondary">
                {selectedWorkload.file_type?.toUpperCase() || "File"} •{" "}
                {selectedWorkload.file_size
                  ? `${(selectedWorkload.file_size / 1024).toFixed(1)} KB`
                  : "Unknown size"}
              </Typography>
              <Tooltip title="Download file">
                <IconButton size="small" onClick={handleDownload}>
                  <Download />
                </IconButton>
              </Tooltip>
            </Stack>
            <Typography variant="body2" sx={{ mb: 2 }} color="text.secondary">
              {selectedWorkload.description || "No description provided."}
            </Typography>
            <Stack direction="row" spacing={1} mb={2}>
              <Chip
                label={selectedWorkload.file_type || "file"}
                size="small"
                color="secondary"
              />
              <Chip
                label={selectedWorkload.created_at?.split("T")[0]}
                size="small"
                color="default"
              />
              {selectedWorkload.creator_username && (
                <Chip
                  label={`By ${selectedWorkload.creator_username}`}
                  size="small"
                  color="primary"
                />
              )}
              {selectedWorkload.updated_at && (
                <Chip
                  label={`Updated ${selectedWorkload.updated_at.split("T")[0]}`}
                  size="small"
                  color="info"
                />
              )}
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <b>Workload Metadata</b>
            </Typography>
            <Stack direction="row" spacing={2} mb={2}>
              <Chip
                label={`nb_res: ${selectedWorkload.nb_res ?? "-"}`}
                size="small"
                color="secondary"
              />
              <Chip
                label={`jobs: ${
                  selectedWorkload.jobs
                    ? JSON.parse(selectedWorkload.jobs).length
                    : 0
                }`}
                size="small"
                color="secondary"
              />
              <Chip
                label={`profiles: ${
                  selectedWorkload.profiles
                    ? Object.keys(JSON.parse(selectedWorkload.profiles)).length
                    : 0
                }`}
                size="small"
                color="secondary"
              />
            </Stack>
            <Accordion
              expanded={expandedJobs}
              onChange={() => setExpandedJobs((v) => !v)}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography>Jobs</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ maxHeight: 180, overflow: "auto" }}>
                  <pre style={{ fontSize: 12, margin: 0 }}>
                    {selectedWorkload.jobs
                      ? JSON.stringify(
                          JSON.parse(selectedWorkload.jobs),
                          null,
                          2
                        )
                      : "No jobs"}
                  </pre>
                </Box>
              </AccordionDetails>
            </Accordion>
            <Accordion
              expanded={expandedProfiles}
              onChange={() => setExpandedProfiles((v) => !v)}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography>Profiles</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ maxHeight: 180, overflow: "auto" }}>
                  <pre style={{ fontSize: 12, margin: 0 }}>
                    {selectedWorkload.profiles
                      ? JSON.stringify(
                          JSON.parse(selectedWorkload.profiles),
                          null,
                          2
                        )
                      : "No profiles"}
                  </pre>
                </Box>
              </AccordionDetails>
            </Accordion>
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
              disabled={panelMode === "edit"}
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
            {(panelMode === "add" || panelMode === "edit") && (
              <FormControl
                fullWidth
                sx={{ mb: 2 }}
                required={panelMode === "add"}
              >
                <InputLabel shrink htmlFor="workload-file">
                  File {panelMode === "add" ? "*" : "(optional)"}
                </InputLabel>
                <input
                  id="workload-file"
                  type="file"
                  accept=".json,.txt,.csv,.dat,.workload"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setForm((f) => ({ ...f, file }));
                  }}
                  style={{ marginTop: 8 }}
                  required={panelMode === "add"}
                />
                <FormHelperText>
                  {form.file
                    ? form.file.name
                    : panelMode === "add"
                    ? "Choose a workload file"
                    : "Leave blank to keep current file"}
                </FormHelperText>
              </FormControl>
            )}
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
                  (panelMode === "add" && (!form.name || !form.file))
                }
                sx={{ fontWeight: 700, borderRadius: 1 }}
              >
                {panelMode === "add" ? "Upload" : "Save"}
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
          <DialogTitle>Delete Workload</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete this workload?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setDeleteDialogOpen(false)}
              color="secondary"
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

export default WorkloadsPage;
