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
  Storage,
  Edit,
  Delete,
  Close,
  Add,
  Download,
  Description,
} from "@mui/icons-material";
import { mockWorkloads, MockWorkload } from "../mockData";

type SortField = "name" | "created_at" | "file_size" | "jobs_count";
type SortOrder = "asc" | "desc";

const WorkloadsDemo: React.FC = () => {
  const [workloads, setWorkloads] = useState<MockWorkload[]>(mockWorkloads);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<"view" | "edit" | "add">("view");
  const [selectedWorkload, setSelectedWorkload] = useState<MockWorkload | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [form, setForm] = useState({ name: "", description: "" });

  const handleSort = (field: SortField) => {
    const isAsc = sortField === field && sortOrder === "asc";
    setSortOrder(isAsc ? "desc" : "asc");
    setSortField(field);
  };

  const sortedWorkloads = [...workloads].sort((a, b) => {
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

  const openDrawer = (mode: "view" | "edit" | "add", workload?: MockWorkload) => {
    setPanelMode(mode);
    setSelectedWorkload(workload || null);
    if (mode === "add") {
      setForm({ name: "", description: "" });
    } else if (workload) {
      setForm({ name: workload.name, description: workload.description });
    }
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedWorkload(null);
  };

  const handleAdd = () => {
    const newWorkload: MockWorkload = {
      id: Date.now(),
      name: form.name,
      description: form.description,
      file_path: `/workloads/${form.name.toLowerCase().replace(/\s+/g, "_")}.json`,
      file_size: Math.floor(Math.random() * 200000) + 50000,
      file_type: "application/json",
      created_at: new Date().toISOString(),
      creator_username: "demo_user",
      nb_res: Math.floor(Math.random() * 200) + 32,
      jobs_count: Math.floor(Math.random() * 2000) + 100,
    };
    setWorkloads((prev) => [newWorkload, ...prev]);
    closeDrawer();
    setSnackbar({ open: true, message: "Workload created successfully!", severity: "success" });
  };

  const handleEdit = () => {
    if (!selectedWorkload) return;
    setWorkloads((prev) =>
      prev.map((w) =>
        w.id === selectedWorkload.id
          ? { ...w, name: form.name, description: form.description }
          : w
      )
    );
    closeDrawer();
    setSnackbar({ open: true, message: "Workload updated successfully!", severity: "success" });
  };

  const handleDelete = () => {
    if (!selectedWorkload) return;
    setWorkloads((prev) => prev.filter((w) => w.id !== selectedWorkload.id));
    setDeleteDialogOpen(false);
    closeDrawer();
    setSnackbar({ open: true, message: "Workload deleted successfully!", severity: "success" });
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
            Workloads
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage job workload files for BatSim simulations
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={() => openDrawer("add")}
          sx={{ borderRadius: 1, fontWeight: 700 }}
        >
          Upload Workload
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
              <TableCell>
                <TableSortLabel
                  active={sortField === "jobs_count"}
                  direction={sortField === "jobs_count" ? sortOrder : "asc"}
                  onClick={() => handleSort("jobs_count")}
                  sx={{ fontWeight: 700 }}
                >
                  Jobs
                </TableSortLabel>
              </TableCell>
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
            {sortedWorkloads.map((w) => (
              <TableRow
                key={w.id}
                hover
                sx={{
                  cursor: "pointer",
                  "&:hover": { background: "rgba(74,158,255,0.08)" },
                }}
                onClick={() => openDrawer("view", w)}
              >
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Storage sx={{ color: "#4a9eff" }} />
                    <Typography fontWeight={600}>{w.name}</Typography>
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
                    {w.description}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={w.jobs_count} size="small" color="primary" />
                </TableCell>
                <TableCell>{formatFileSize(w.file_size)}</TableCell>
                <TableCell>{w.created_at.split("T")[0]}</TableCell>
                <TableCell>
                  <Chip label={w.creator_username} size="small" color="secondary" />
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDrawer("edit", w);
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
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
              <Description sx={{ color: "#4a9eff" }} />
              <Typography variant="body2" color="text.secondary">
                {selectedWorkload.file_type} • {formatFileSize(selectedWorkload.file_size)}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ mb: 2 }} color="text.secondary">
              {selectedWorkload.description}
            </Typography>
            <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" gap={0.5}>
              <Chip label={selectedWorkload.created_at.split("T")[0]} size="small" />
              <Chip label={`By ${selectedWorkload.creator_username}`} size="small" color="primary" />
              <Chip label={`${selectedWorkload.jobs_count} jobs`} size="small" color="info" />
              <Chip label={`${selectedWorkload.nb_res} resources`} size="small" color="info" />
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <b>File Path</b>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontFamily: "monospace" }}>
              {selectedWorkload.file_path}
            </Typography>
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
              minRows={3}
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
                <Storage sx={{ fontSize: 40, color: "#4a9eff", mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Click to upload JSON workload file
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
        <DialogTitle>Delete Workload</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedWorkload?.name}"?
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

export default WorkloadsDemo;
