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
  Computer,
} from "@mui/icons-material";
import { platformsAPI, Platform } from "../services/api";

type PanelMode = "view" | "edit" | "add";

function getFileTypeIcon(fileType: string | undefined) {
  if (!fileType) return <Description sx={{ color: "#4a9eff" }} />;
  if (fileType.includes("xml")) return <CodeIcon sx={{ color: "#4a9eff" }} />;
  return <Description sx={{ color: "#4a9eff" }} />;
}

const PlatformsPage: React.FC = () => {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("view");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(
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
  const [expandedConfig, setExpandedConfig] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    file: null as File | null,
  });

  useEffect(() => {
    const fetchPlatforms = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await platformsAPI.getAll();
        const data = Array.isArray(res.data)
          ? res.data
          : (res.data as any).items || [];
        setPlatforms(data);
      } catch (err: any) {
        setError("Failed to load platforms.");
      } finally {
        setLoading(false);
      }
    };
    fetchPlatforms();
  }, []);

  const openDrawer = (mode: PanelMode, platform?: Platform) => {
    setPanelMode(mode);
    setSelectedPlatform(platform || null);
    setFormError(null);
    if (mode === "add") {
      setForm({ name: "", description: "", file: null });
    } else if (platform) {
      setForm({
        name: platform.name,
        description: platform.description || "",
        file: null,
      });
    }
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedPlatform(null);
    setFormError(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.file) return;

    setActionLoading(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("description", form.description);
      formData.append("file", form.file);

      const res = await platformsAPI.create(formData);
      setPlatforms((prev) => [res.data, ...prev]);
      closeDrawer();
      setSnackbar({
        open: true,
        message: "Platform uploaded successfully!",
        severity: "success",
      });
    } catch (err: any) {
      setFormError("Failed to add platform.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlatform) return;

    setActionLoading(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("description", form.description);
      if (form.file) {
        formData.append("file", form.file);
      }

      const res = await platformsAPI.updateFile(selectedPlatform.id, formData);
      setPlatforms((prev) =>
        prev.map((p) => (p.id === selectedPlatform.id ? res.data : p))
      );
      closeDrawer();
      setSnackbar({
        open: true,
        message: "Platform updated successfully!",
        severity: "success",
      });
    } catch (err: any) {
      setFormError("Failed to update platform.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPlatform) return;

    setActionLoading(true);
    try {
      await platformsAPI.delete(selectedPlatform.id);
      setPlatforms((prev) => prev.filter((p) => p.id !== selectedPlatform.id));
      setDeleteDialogOpen(false);
      closeDrawer();
      setSnackbar({
        open: true,
        message: "Platform deleted successfully!",
        severity: "success",
      });
    } catch (err: any) {
      setFormError("Failed to delete platform.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedPlatform) return;
    try {
      const res = await platformsAPI.download(selectedPlatform.id);
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
      {/* Platform List */}
      <Box sx={{ flex: 1, p: 3 }}>
        <Typography variant="h4" fontWeight={900} gutterBottom>
          Platforms
        </Typography>
        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => openDrawer("add")}
            sx={{ borderRadius: 1, fontWeight: 700 }}
          >
            Upload New Platform
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
        ) : platforms.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 4 }}>
            No platforms found.
          </Typography>
        ) : (
          <Grid container spacing={3}>
            {platforms.map((p) => (
              <Grid item xs={12} sm={6} md={4} key={p.id}>
                <Card
                  sx={{
                    borderRadius: 1,
                    background: "rgba(26,32,44,0.98)",
                    height: "100%",
                    cursor: "pointer",
                    transition: "all 0.2s ease-in-out",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: "0 8px 25px rgba(0,0,0,0.3)",
                    },
                  }}
                  onClick={() => openDrawer("view", p)}
                >
                  <CardContent>
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={2}
                      mb={2}
                    >
                      <Computer sx={{ fontSize: 36, color: "#4a9eff" }} />
                      <Box>
                        <Typography
                          variant="h6"
                          fontWeight={900}
                          sx={{ color: "#fff" }}
                        >
                          {p.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {p.file_type?.toUpperCase() || "File"} •{" "}
                          {p.file_size
                            ? `${(p.file_size / 1024).toFixed(1)} KB`
                            : "Unknown size"}
                        </Typography>
                      </Box>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{ mb: 2 }}
                      color="text.secondary"
                    >
                      {p.description || "No description provided."}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip
                        label={p.file_type || "file"}
                        size="small"
                        color="secondary"
                      />
                      <Chip
                        label={p.created_at?.split("T")[0]}
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
              ? "Upload New Platform"
              : panelMode === "edit"
              ? "Edit Platform"
              : selectedPlatform?.name || "Platform Details"}
          </Typography>
          <IconButton onClick={closeDrawer}>
            <Close />
          </IconButton>
        </Box>
        {panelMode === "view" && selectedPlatform && (
          <>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 1 }}
            >
              {getFileTypeIcon(selectedPlatform.file_type)}
              <Typography variant="subtitle2" color="text.secondary">
                {selectedPlatform.file_type?.toUpperCase() || "File"} •{" "}
                {selectedPlatform.file_size
                  ? `${(selectedPlatform.file_size / 1024).toFixed(1)} KB`
                  : "Unknown size"}
              </Typography>
              <Tooltip title="Download file">
                <IconButton size="small" onClick={handleDownload}>
                  <Download />
                </IconButton>
              </Tooltip>
            </Stack>
            <Typography variant="body2" sx={{ mb: 2 }} color="text.secondary">
              {selectedPlatform.description || "No description provided."}
            </Typography>
            <Stack direction="row" spacing={1} mb={2}>
              <Chip
                label={selectedPlatform.file_type || "file"}
                size="small"
                color="secondary"
              />
              <Chip
                label={selectedPlatform.created_at?.split("T")[0]}
                size="small"
                color="default"
              />
              {selectedPlatform.creator_username && (
                <Chip
                  label={`By ${selectedPlatform.creator_username}`}
                  size="small"
                  color="primary"
                />
              )}
              {selectedPlatform.updated_at && (
                <Chip
                  label={`Updated ${selectedPlatform.updated_at.split("T")[0]}`}
                  size="small"
                  color="info"
                />
              )}
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <b>Platform Metadata</b>
            </Typography>
            <Stack direction="row" spacing={2} mb={2}>
              <Chip
                label={`Hosts: ${selectedPlatform.nb_hosts ?? "-"}`}
                size="small"
                color="secondary"
              />
              <Chip
                label={`Clusters: ${selectedPlatform.nb_clusters ?? "-"}`}
                size="small"
                color="secondary"
              />
            </Stack>
            <Accordion
              expanded={expandedConfig}
              onChange={() => setExpandedConfig((v) => !v)}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography>Platform Configuration</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ maxHeight: 180, overflow: "auto" }}>
                  <pre style={{ fontSize: 12, margin: 0 }}>
                    {selectedPlatform.platform_config ||
                      "No configuration available"}
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
                <InputLabel shrink htmlFor="platform-file">
                  File {panelMode === "add" ? "*" : "(optional)"}
                </InputLabel>
                <input
                  id="platform-file"
                  type="file"
                  accept=".xml,.txt,.platform"
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
                    ? "Choose a platform file"
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
          <DialogTitle>Delete Platform</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete "{selectedPlatform?.name}"? This
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

export default PlatformsPage;
