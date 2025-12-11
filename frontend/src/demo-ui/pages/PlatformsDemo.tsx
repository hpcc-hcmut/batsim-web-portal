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
  Computer,
  Edit,
  Delete,
  Close,
  Add,
  Download,
  Dns,
} from "@mui/icons-material";
import { mockPlatforms, MockPlatform } from "../mockData";

type SortField = "name" | "created_at" | "nb_hosts" | "nb_clusters";
type SortOrder = "asc" | "desc";

const PlatformsDemo: React.FC = () => {
  const [platforms, setPlatforms] = useState<MockPlatform[]>(mockPlatforms);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<"view" | "edit" | "add">("view");
  const [selectedPlatform, setSelectedPlatform] = useState<MockPlatform | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [form, setForm] = useState({ name: "", description: "", nb_hosts: "", nb_clusters: "" });

  const handleSort = (field: SortField) => {
    const isAsc = sortField === field && sortOrder === "asc";
    setSortOrder(isAsc ? "desc" : "asc");
    setSortField(field);
  };

  const sortedPlatforms = [...platforms].sort((a, b) => {
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

  const openDrawer = (mode: "view" | "edit" | "add", platform?: MockPlatform) => {
    setPanelMode(mode);
    setSelectedPlatform(platform || null);
    if (mode === "add") {
      setForm({ name: "", description: "", nb_hosts: "", nb_clusters: "" });
    } else if (platform) {
      setForm({
        name: platform.name,
        description: platform.description,
        nb_hosts: platform.nb_hosts.toString(),
        nb_clusters: platform.nb_clusters.toString(),
      });
    }
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedPlatform(null);
  };

  const handleAdd = () => {
    const newPlatform: MockPlatform = {
      id: Date.now(),
      name: form.name,
      description: form.description,
      file_path: `/platforms/${form.name.toLowerCase().replace(/\s+/g, "_")}.xml`,
      file_size: Math.floor(Math.random() * 50000) + 20000,
      file_type: "application/xml",
      created_at: new Date().toISOString(),
      creator_username: "demo_user",
      nb_hosts: parseInt(form.nb_hosts) || 64,
      nb_clusters: parseInt(form.nb_clusters) || 2,
    };
    setPlatforms((prev) => [newPlatform, ...prev]);
    closeDrawer();
    setSnackbar({ open: true, message: "Platform created successfully!", severity: "success" });
  };

  const handleEdit = () => {
    if (!selectedPlatform) return;
    setPlatforms((prev) =>
      prev.map((p) =>
        p.id === selectedPlatform.id
          ? {
              ...p,
              name: form.name,
              description: form.description,
              nb_hosts: parseInt(form.nb_hosts) || p.nb_hosts,
              nb_clusters: parseInt(form.nb_clusters) || p.nb_clusters,
            }
          : p
      )
    );
    closeDrawer();
    setSnackbar({ open: true, message: "Platform updated successfully!", severity: "success" });
  };

  const handleDelete = () => {
    if (!selectedPlatform) return;
    setPlatforms((prev) => prev.filter((p) => p.id !== selectedPlatform.id));
    setDeleteDialogOpen(false);
    closeDrawer();
    setSnackbar({ open: true, message: "Platform deleted successfully!", severity: "success" });
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
            Platforms
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage platform configuration files for BatSim simulations
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={() => openDrawer("add")}
          sx={{ borderRadius: 1, fontWeight: 700 }}
        >
          Upload Platform
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
                  active={sortField === "nb_hosts"}
                  direction={sortField === "nb_hosts" ? sortOrder : "asc"}
                  onClick={() => handleSort("nb_hosts")}
                  sx={{ fontWeight: 700 }}
                >
                  Hosts
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "nb_clusters"}
                  direction={sortField === "nb_clusters" ? sortOrder : "asc"}
                  onClick={() => handleSort("nb_clusters")}
                  sx={{ fontWeight: 700 }}
                >
                  Clusters
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
            {sortedPlatforms.map((p) => (
              <TableRow
                key={p.id}
                hover
                sx={{
                  cursor: "pointer",
                  "&:hover": { background: "rgba(74,158,255,0.08)" },
                }}
                onClick={() => openDrawer("view", p)}
              >
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Computer sx={{ color: "#4a9eff" }} />
                    <Typography fontWeight={600}>{p.name}</Typography>
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
                    {p.description}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={p.nb_hosts} size="small" color="primary" />
                </TableCell>
                <TableCell>
                  <Chip label={p.nb_clusters} size="small" color="info" />
                </TableCell>
                <TableCell>{p.created_at.split("T")[0]}</TableCell>
                <TableCell>
                  <Chip label={p.creator_username} size="small" color="secondary" />
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDrawer("edit", p);
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
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
              <Dns sx={{ color: "#4a9eff" }} />
              <Typography variant="body2" color="text.secondary">
                {selectedPlatform.file_type} • {formatFileSize(selectedPlatform.file_size)}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ mb: 2 }} color="text.secondary">
              {selectedPlatform.description}
            </Typography>
            <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" gap={0.5}>
              <Chip label={selectedPlatform.created_at.split("T")[0]} size="small" />
              <Chip label={`By ${selectedPlatform.creator_username}`} size="small" color="primary" />
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <b>Platform Configuration</b>
            </Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <Card sx={{ p: 2, background: "rgba(74,158,255,0.08)", borderRadius: 2 }}>
                  <Typography variant="h4" fontWeight={700} color="primary">
                    {selectedPlatform.nb_hosts}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Hosts
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={6}>
                <Card sx={{ p: 2, background: "rgba(74,158,255,0.08)", borderRadius: 2 }}>
                  <Typography variant="h4" fontWeight={700} color="primary">
                    {selectedPlatform.nb_clusters}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Clusters
                  </Typography>
                </Card>
              </Grid>
            </Grid>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <b>File Path</b>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontFamily: "monospace" }}>
              {selectedPlatform.file_path}
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
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <TextField
                  label="Number of Hosts"
                  type="number"
                  value={form.nb_hosts}
                  onChange={(e) => setForm((f) => ({ ...f, nb_hosts: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Number of Clusters"
                  type="number"
                  value={form.nb_clusters}
                  onChange={(e) => setForm((f) => ({ ...f, nb_clusters: e.target.value }))}
                  fullWidth
                />
              </Grid>
            </Grid>
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
                <Computer sx={{ fontSize: 40, color: "#4a9eff", mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Click to upload XML platform file
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
        <DialogTitle>Delete Platform</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedPlatform?.name}"?
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

export default PlatformsDemo;
