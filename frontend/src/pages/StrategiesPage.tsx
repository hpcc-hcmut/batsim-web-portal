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
  Snackbar,
  Alert,
  Divider,
  Tooltip,
} from "@mui/material";
import {
  Code,
  Edit,
  Delete,
  Close,
  UploadFile,
  Download,
  Description,
  Code as CodeIcon,
} from "@mui/icons-material";
import {
  strategiesAPI,
  extractValidationErrors,
  Strategy,
  ValidationResponse,
} from "../services/api";
import ValidationErrorPanel from "../components/ValidationErrorPanel";
import FileDropzone from "../components/common/file-dropzone";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import oneDark from "react-syntax-highlighter/dist/esm/styles/prism/one-dark";

SyntaxHighlighter.registerLanguage("python", python);

type PanelMode = "view" | "edit" | "add";

function getFileTypeIcon(fileType: string | undefined) {
  if (!fileType) return <Description sx={{ color: "#4a9eff" }} />;
  if (fileType.includes("python") || fileType.includes("py"))
    return <CodeIcon sx={{ color: "#4a9eff" }} />;
  return <Description sx={{ color: "#4a9eff" }} />;
}

const StrategiesPage: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("view");
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(
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
  const [codePreview, setCodePreview] = useState<{
    filename: string;
    content: string;
    language: string;
    truncated: boolean;
  } | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [validationResult, setValidationResult] =
    useState<ValidationResponse | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    file: null as File | null,
  });

  useEffect(() => {
    const fetchStrategies = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await strategiesAPI.getAll();
        const data = Array.isArray(res.data)
          ? res.data
          : (res.data as any).items || [];
        setStrategies(data);
      } catch (err: any) {
        setError("Failed to load strategies.");
      } finally {
        setLoading(false);
      }
    };
    fetchStrategies();
  }, []);

  const openDrawer = (mode: PanelMode, strategy?: Strategy) => {
    setPanelMode(mode);
    setSelectedStrategy(strategy || null);
    setFormError(null);
    setValidationResult(null);
    setCodePreview(null);
    setCodeError(null);
    if (mode === "add") {
      setForm({ name: "", description: "", file: null });
    } else if (strategy) {
      setForm({
        name: strategy.name,
        description: strategy.description || "",
        file: null,
      });
      if (mode === "view") {
        setCodeLoading(true);
        strategiesAPI
          .getContent(strategy.id)
          .then((res) => {
            setCodePreview({
              filename: res.data.filename,
              content: res.data.content,
              language: res.data.language || "python",
              truncated: res.data.truncated,
            });
          })
          .catch((err) => {
            const detail = err?.response?.data?.detail;
            setCodeError(
              typeof detail === "string"
                ? detail
                : "Could not load source preview."
            );
          })
          .finally(() => setCodeLoading(false));
      }
    }
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedStrategy(null);
    setFormError(null);
    setValidationResult(null);
    setCodePreview(null);
    setCodeError(null);
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

      const res = await strategiesAPI.create(formData);
      setStrategies((prev) => [res.data, ...prev]);
      closeDrawer();
      setSnackbar({
        open: true,
        message: "Strategy uploaded successfully!",
        severity: "success",
      });
    } catch (err: any) {
      const validation = extractValidationErrors(err);
      if (validation) {
        setValidationResult(validation);
      } else {
        setFormError("Failed to add strategy.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStrategy) return;

    setActionLoading(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("description", form.description);
      if (form.file) {
        formData.append("file", form.file);
      }

      const res = await strategiesAPI.updateFile(selectedStrategy.id, formData);
      setStrategies((prev) =>
        prev.map((s) => (s.id === selectedStrategy.id ? res.data : s))
      );
      closeDrawer();
      setSnackbar({
        open: true,
        message: "Strategy updated successfully!",
        severity: "success",
      });
    } catch (err: any) {
      setFormError("Failed to update strategy.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedStrategy) return;

    setActionLoading(true);
    try {
      await strategiesAPI.delete(selectedStrategy.id);
      setStrategies((prev) => prev.filter((s) => s.id !== selectedStrategy.id));
      setDeleteDialogOpen(false);
      closeDrawer();
      setSnackbar({
        open: true,
        message: "Strategy deleted successfully!",
        severity: "success",
      });
    } catch (err: any) {
      setFormError("Failed to delete strategy.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedStrategy) return;
    try {
      const res = await strategiesAPI.download(selectedStrategy.id);
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

  const getStrategyFiles = (strategy: Strategy) => {
    if (!strategy.strategy_files) return [];
    try {
      return JSON.parse(strategy.strategy_files);
    } catch {
      return [];
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
      {/* Strategy List */}
      <Box sx={{ flex: 1, p: 3 }}>
        <Typography variant="h4" fontWeight={900} gutterBottom>
          Strategies
        </Typography>
        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => openDrawer("add")}
            sx={{ borderRadius: 1, fontWeight: 700 }}
          >
            Upload New Strategy
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
        ) : strategies.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 4 }}>
            No strategies found.
          </Typography>
        ) : (
          <Grid container spacing={3}>
            {strategies.map((s) => {
              const strategyFiles = getStrategyFiles(s);
              return (
                <Grid item xs={12} sm={6} md={4} key={s.id}>
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
                    onClick={() => openDrawer("view", s)}
                  >
                    <CardContent>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={2}
                        mb={2}
                      >
                        <Code sx={{ fontSize: 36, color: "#4a9eff" }} />
                        <Box>
                          <Typography
                            variant="h6"
                            fontWeight={900}
                            sx={{ color: "#fff" }}
                          >
                            {s.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {s.file_type?.toUpperCase() || "File"} •{" "}
                            {s.file_size
                              ? `${(s.file_size / 1024).toFixed(1)} KB`
                              : "Unknown size"}
                          </Typography>
                        </Box>
                      </Stack>
                      {/* Strategy Metadata */}
                      <Stack spacing={1} mb={2}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Files:
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {s.nb_files ?? 1}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Main Entry:
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {s.main_entry || "Not detected"}
                          </Typography>
                        </Stack>
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
                          label={s.file_type || "file"}
                          size="small"
                          color="secondary"
                        />
                        <Chip
                          label={s.created_at?.split("T")[0]}
                          size="small"
                          color="default"
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
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
              ? "Upload New Strategy"
              : panelMode === "edit"
              ? "Edit Strategy"
              : selectedStrategy?.name || "Strategy Details"}
          </Typography>
          <IconButton onClick={closeDrawer}>
            <Close />
          </IconButton>
        </Box>
        {panelMode === "view" && selectedStrategy && (
          <>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 1 }}
            >
              {getFileTypeIcon(selectedStrategy.file_type)}
              <Typography variant="subtitle2" color="text.secondary">
                {selectedStrategy.file_type?.toUpperCase() || "File"} •{" "}
                {selectedStrategy.file_size
                  ? `${(selectedStrategy.file_size / 1024).toFixed(1)} KB`
                  : "Unknown size"}
              </Typography>
              <Tooltip title="Download file">
                <IconButton size="small" onClick={handleDownload}>
                  <Download />
                </IconButton>
              </Tooltip>
            </Stack>
            <Typography variant="body2" sx={{ mb: 2 }} color="text.secondary">
              {selectedStrategy.description || "No description provided."}
            </Typography>
            <Stack direction="row" spacing={1} mb={2}>
              <Chip
                label={selectedStrategy.file_type || "file"}
                size="small"
                color="secondary"
              />
              <Chip
                label={selectedStrategy.created_at?.split("T")[0]}
                size="small"
                color="default"
              />
              {selectedStrategy.creator_username && (
                <Chip
                  label={`By ${selectedStrategy.creator_username}`}
                  size="small"
                  color="primary"
                />
              )}
              {selectedStrategy.updated_at && (
                <Chip
                  label={`Updated ${selectedStrategy.updated_at.split("T")[0]}`}
                  size="small"
                  color="info"
                />
              )}
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <b>Strategy Metadata</b>
            </Typography>
            <Stack direction="row" spacing={2} mb={2}>
              <Chip
                label={`Files: ${selectedStrategy.nb_files ?? 1}`}
                size="small"
                color="secondary"
              />
              <Chip
                label={`Main: ${selectedStrategy.main_entry || "Not detected"}`}
                size="small"
                color="secondary"
              />
            </Stack>

            {/* Strategy Files */}
            {getStrategyFiles(selectedStrategy).length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  <b>Strategy Files</b>
                </Typography>
                <Stack spacing={1} mb={2}>
                  {getStrategyFiles(selectedStrategy).map(
                    (file: any, index: number) => (
                      <Chip
                        key={index}
                        label={`${file.filename}${
                          file.is_main ? " (Main)" : ""
                        }`}
                        size="small"
                        color={file.is_main ? "success" : "default"}
                      />
                    )
                  )}
                </Stack>
              </>
            )}

            {/* Code Preview */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <b>Source Preview</b>
              {codePreview?.filename && (
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 1 }}
                >
                  {codePreview.filename}
                </Typography>
              )}
            </Typography>
            {codeLoading ? (
              <Box sx={{ py: 2, display: "flex", justifyContent: "center" }}>
                <CircularProgress size={20} />
              </Box>
            ) : codeError ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {codeError}
              </Alert>
            ) : codePreview ? (
              <Box sx={{ mb: 2, maxHeight: 400, overflow: "auto", borderRadius: 1 }}>
                <SyntaxHighlighter
                  language={codePreview.language || "python"}
                  style={oneDark}
                  showLineNumbers
                  customStyle={{ margin: 0, fontSize: 12, borderRadius: 4 }}
                  wrapLongLines
                >
                  {codePreview.content}
                </SyntaxHighlighter>
                {codePreview.truncated && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    Source truncated at 100 KB. Download for full file.
                  </Alert>
                )}
              </Box>
            ) : null}

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
            <Box sx={{ mb: 2 }}>
              <FileDropzone
                id="strategy-file"
                accept=".py,.txt"
                file={form.file}
                onFileChange={(file) => setForm((f) => ({ ...f, file }))}
                label={`Python File${panelMode === "add" ? " (required)" : " (optional)"}`}
                hint={
                  panelMode === "edit"
                    ? "Python scheduler module (.py) — leave empty to keep current file"
                    : "Python scheduler module (.py)"
                }
                required={panelMode === "add"}
              />
            </Box>
            <ValidationErrorPanel validation={validationResult} />
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
          <DialogTitle>Delete Strategy</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete "{selectedStrategy?.name}"? This
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

export default StrategiesPage;
