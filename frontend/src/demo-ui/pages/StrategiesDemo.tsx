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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
} from "@mui/material";
import {
  Code,
  Edit,
  Delete,
  Close,
  Add,
  Download,
  PlayArrow,
} from "@mui/icons-material";
import { mockStrategies, MockStrategy } from "../mockData";

type SortField = "name" | "created_at" | "file_size";
type SortOrder = "asc" | "desc";

const StrategiesDemo: React.FC = () => {
  const [strategies, setStrategies] = useState<MockStrategy[]>(mockStrategies);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<"view" | "edit" | "add">("view");
  const [selectedStrategy, setSelectedStrategy] = useState<MockStrategy | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [form, setForm] = useState({ name: "", description: "", main_entry: "" });

  const handleSort = (field: SortField) => {
    const isAsc = sortField === field && sortOrder === "asc";
    setSortOrder(isAsc ? "desc" : "asc");
    setSortField(field);
  };

  const sortedStrategies = [...strategies].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];
    if (sortField === "created_at") {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }
    if (sortOrder === "asc") {
      return aVal < bVal ? -1 : 1;
    }
    return aVal > bVal ? -1 : 1;
  });

  const openDrawer = (mode: "view" | "edit" | "add", strategy?: MockStrategy) => {
    setPanelMode(mode);
    setSelectedStrategy(strategy || null);
    if (mode === "add") {
      setForm({ name: "", description: "", main_entry: "" });
    } else if (strategy) {
      setForm({
        name: strategy.name,
        description: strategy.description,
        main_entry: strategy.main_entry,
      });
    }
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedStrategy(null);
  };

  const handleAdd = () => {
    const newStrategy: MockStrategy = {
      id: Date.now(),
      name: form.name,
      description: form.description,
      file_path: `/strategies/${form.name.toLowerCase().replace(/\s+/g, "_")}.py`,
      file_size: Math.floor(Math.random() * 30000) + 10000,
      file_type: "text/x-python",
      created_at: new Date().toISOString(),
      creator_username: "demo_user",
      main_entry: form.main_entry || "scheduler.py",
    };
    setStrategies((prev) => [newStrategy, ...prev]);
    closeDrawer();
    setSnackbar({ open: true, message: "Strategy created successfully!", severity: "success" });
  };

  const handleEdit = () => {
    if (!selectedStrategy) return;
    setStrategies((prev) =>
      prev.map((s) =>
        s.id === selectedStrategy.id
          ? {
              ...s,
              name: form.name,
              description: form.description,
              main_entry: form.main_entry,
            }
          : s
      )
    );
    closeDrawer();
    setSnackbar({ open: true, message: "Strategy updated successfully!", severity: "success" });
  };

  const handleDelete = () => {
    if (!selectedStrategy) return;
    setStrategies((prev) => prev.filter((s) => s.id !== selectedStrategy.id));
    setDeleteDialogOpen(false);
    closeDrawer();
    setSnackbar({ open: true, message: "Strategy deleted successfully!", severity: "success" });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={900} gutterBottom>
            Strategies
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage scheduling algorithm strategies for BatSim simulations
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={() => openDrawer("add")}
          sx={{ borderRadius: 1, fontWeight: 700 }}
        >
          Upload Strategy
        </Button>
      </Box>

      {/* Table View */}
      <TableContainer component={Paper} sx={{ background: "rgba(26,32,44,0.98)", borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortField === "name"}
                  direction={sortField === "name" ? sortOrder : "asc"}
                  onClick={() => handleSort("name")}
                  sx={{ fontWeight: 700 }}
                >
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Entry Point</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "file_size"}
                  direction={sortField === "file_size" ? sortOrder : "asc"}
                  onClick={() => handleSort("file_size")}
                  sx={{ fontWeight: 700 }}
                >
                  Size
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "created_at"}
                  direction={sortField === "created_at" ? sortOrder : "asc"}
                  onClick={() => handleSort("created_at")}
                  sx={{ fontWeight: 700 }}
                >
                  Created
                </TableSortLabel>
              </TableCell>
              <TableCell>Creator</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedStrategies.map((s) => (
              <TableRow
                key={s.id}
                hover
                sx={{
                  cursor: "pointer",
                  "&:hover": { background: "rgba(74,158,255,0.08)" },
                }}
                onClick={() => openDrawer("view", s)}
              >
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Code sx={{ color: "#4a9eff" }} />
                    <Typography fontWeight={600}>{s.name}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      maxWidth: 200,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.description}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={s.main_entry}
                    size="small"
                    icon={<PlayArrow sx={{ fontSize: 14 }} />}
                    sx={{ fontFamily: "monospace", fontSize: 11 }}
                  />
                </TableCell>
                <TableCell>{formatFileSize(s.file_size)}</TableCell>
                <TableCell>{s.created_at.split("T")[0]}</TableCell>
                <TableCell>
                  <Chip label={s.creator_username} size="small" color="secondary" />
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDrawer("edit", s);
                    }}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSnackbar({ open: true, message: "Download started!", severity: "success" });
                    }}
                  >
                    <Download fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

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
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
              <Code sx={{ color: "#4a9eff" }} />
              <Typography variant="body2" color="text.secondary">
                {selectedStrategy.file_type} • {formatFileSize(selectedStrategy.file_size)}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ mb: 2 }} color="text.secondary">
              {selectedStrategy.description}
            </Typography>
            <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" gap={0.5}>
              <Chip label={selectedStrategy.created_at.split("T")[0]} size="small" />
              <Chip label={`By ${selectedStrategy.creator_username}`} size="small" color="primary" />
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <b>Entry Point</b>
            </Typography>
            <Chip
              label={selectedStrategy.main_entry}
              icon={<PlayArrow />}
              sx={{ mb: 2, fontFamily: "monospace" }}
            />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <b>File Path</b>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontFamily: "monospace" }}>
              {selectedStrategy.file_path}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <b>Code Preview</b>
            </Typography>
            <Box
              sx={{
                p: 2,
                background: "rgba(0,0,0,0.3)",
                borderRadius: 1,
                fontFamily: "monospace",
                fontSize: 12,
                overflow: "auto",
                maxHeight: 200,
              }}
            >
              <pre style={{ margin: 0, color: "#a0aec0" }}>
{`# ${selectedStrategy.name}
# BatSim Scheduling Strategy

from pybatsim.scheduler import Scheduler

class ${selectedStrategy.name.replace(/\s+/g, "")}(Scheduler):
    def __init__(self):
        super().__init__()

    def onJobSubmission(self, job):
        # Schedule job logic
        self.schedule(job)

    def onJobCompletion(self, job):
        # Handle completion
        pass`}
              </pre>
            </Box>
            <Stack direction="row" spacing={2} mt={3}>
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
              minRows={3}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Main Entry Point"
              value={form.main_entry}
              onChange={(e) => setForm((f) => ({ ...f, main_entry: e.target.value }))}
              fullWidth
              placeholder="scheduler.py"
              sx={{ mb: 2 }}
            />
            {panelMode === "add" && (
              <Box
                sx={{
                  border: "2px dashed rgba(74,158,255,0.3)",
                  borderRadius: 2,
                  p: 3,
                  textAlign: "center",
                  mb: 2,
                  cursor: "pointer",
                  "&:hover": { borderColor: "#4a9eff" },
                }}
              >
                <Code sx={{ fontSize: 40, color: "#4a9eff", mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Click to upload Python strategy files
                </Typography>
                {/* <Typography variant="caption" color="text.secondary">
                  (Demo mode - file will be simulated)
                </Typography> */}
              </Box>
            )}
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={panelMode === "add" ? handleAdd : handleEdit}
                disabled={!form.name}
                sx={{ fontWeight: 700, borderRadius: 1 }}
              >
                {panelMode === "add" ? "Upload" : "Save"}
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
        <DialogTitle>Delete Strategy</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedStrategy?.name}"?
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

export default StrategiesDemo;
