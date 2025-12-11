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
  List,
  ListItem,
  ListItemText,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Avatar,
} from "@mui/material";
import {
  Edit,
  Delete,
  Close,
  Add,
  FolderSpecial,
  Group,
  PersonAdd,
  PersonRemove,
} from "@mui/icons-material";
import { projectsAPI, Project, ProjectMember, ProjectRole } from "../services/api";
import useAuthStore from "../store/authStore";

type PanelMode = "view" | "edit" | "add" | "members";

const ProjectsPage: React.FC = () => {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("view");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [form, setForm] = useState<{
    name: string;
    description: string;
  }>({ name: "", description: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  // Member add form
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState<string>("");
  const [newMemberRole, setNewMemberRole] = useState<ProjectRole>("member");

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await projectsAPI.getAll();
        setProjects(res.data);
      } catch (err: any) {
        setError("Failed to load projects.");
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const fetchMembers = async (projectId: number) => {
    try {
      const res = await projectsAPI.getMembers(projectId);
      setMembers(res.data);
    } catch {
      setMembers([]);
    }
  };

  const openDrawer = async (mode: PanelMode, project?: Project) => {
    setPanelMode(mode);
    setSelectedProject(project || null);
    setForm({
      name: project?.name || "",
      description: project?.description || "",
    });
    setDrawerOpen(true);
    setFormError(null);

    if (project && (mode === "view" || mode === "members")) {
      await fetchMembers(project.id);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedProject(null);
    setFormError(null);
    setMembers([]);
  };

  const handleDelete = async () => {
    if (!selectedProject) return;
    setActionLoading(true);
    try {
      await projectsAPI.delete(selectedProject.id);
      setProjects((prev) => prev.filter((p) => p.id !== selectedProject.id));
      setDeleteDialogOpen(false);
      closeDrawer();
      setSnackbar({
        open: true,
        message: "Project deleted successfully!",
        severity: "success",
      });
    } catch (err: any) {
      setFormError("Failed to delete project.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setActionLoading(true);
    try {
      const res = await projectsAPI.update(selectedProject.id, {
        name: form.name,
        description: form.description,
      });
      setProjects((prev) =>
        prev.map((p) => (p.id === selectedProject.id ? res.data : p))
      );
      closeDrawer();
      setSnackbar({
        open: true,
        message: "Project updated successfully!",
        severity: "success",
      });
    } catch (err: any) {
      setFormError("Failed to update project.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      setFormError("Name is required.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await projectsAPI.create({
        name: form.name,
        description: form.description,
      });
      setProjects((prev) => [res.data, ...prev]);
      closeDrawer();
      setSnackbar({
        open: true,
        message: "Project created successfully!",
        severity: "success",
      });
    } catch (err: any) {
      setFormError(err.response?.data?.detail || "Failed to create project.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedProject || !newMemberUserId) return;
    setActionLoading(true);
    try {
      await projectsAPI.addMember(selectedProject.id, {
        user_id: parseInt(newMemberUserId),
        role: newMemberRole,
      });
      await fetchMembers(selectedProject.id);
      setAddMemberDialogOpen(false);
      setNewMemberUserId("");
      setNewMemberRole("member");
      setSnackbar({
        open: true,
        message: "Member added successfully!",
        severity: "success",
      });
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || "Failed to add member.",
        severity: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!selectedProject) return;
    setActionLoading(true);
    try {
      await projectsAPI.removeMember(selectedProject.id, userId);
      await fetchMembers(selectedProject.id);
      setSnackbar({
        open: true,
        message: "Member removed successfully!",
        severity: "success",
      });
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || "Failed to remove member.",
        severity: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const canManageProject = (project: Project) => {
    return (
      user?.role === "admin" ||
      project.owner_id === user?.id
    );
  };

  const getRoleColor = (role: ProjectRole) => {
    switch (role) {
      case "owner":
        return "primary";
      case "member":
        return "secondary";
      case "viewer":
        return "default";
      default:
        return "default";
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
      {/* Project List */}
      <Box sx={{ flex: 1, pr: { md: 2 }, minWidth: 0 }}>
        <Typography variant="h4" fontWeight={900} gutterBottom>
          Projects
        </Typography>
        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            sx={{ borderRadius: 1, fontWeight: 700 }}
            onClick={() => openDrawer("add")}
          >
            Create New Project
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
        ) : projects.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 4 }}>
            No projects found. Create your first project!
          </Typography>
        ) : (
          <Grid container spacing={3}>
            {projects.map((p) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={p.id}>
                <Card
                  sx={{
                    borderRadius: 1,
                    background: "rgba(26,32,44,0.98)",
                    height: "100%",
                    cursor: "pointer",
                    border:
                      selectedProject?.id === p.id && drawerOpen
                        ? "2px solid #4a9eff"
                        : undefined,
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
                      <FolderSpecial sx={{ fontSize: 36, color: "#4a9eff" }} />
                      <Box>
                        <Typography
                          variant="h6"
                          fontWeight={900}
                          sx={{ color: "#fff" }}
                        >
                          {p.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Owner: {p.owner_username || "Unknown"}
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
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip
                        icon={<Group sx={{ fontSize: 16 }} />}
                        label={`${p.member_count || 0} members`}
                        size="small"
                        color="primary"
                      />
                      <Chip
                        label={`${p.workload_count || 0} workloads`}
                        size="small"
                        color="secondary"
                      />
                      <Chip
                        label={`${p.experiment_count || 0} experiments`}
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

      {/* Drawer for Detail/Edit/Add/Members */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        PaperProps={{
          sx: { width: { xs: "100%", md: 450 }, p: 3, background: "#1a202c" },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <Typography variant="h6" fontWeight={900} sx={{ flex: 1 }}>
            {panelMode === "add"
              ? "Create New Project"
              : panelMode === "edit"
              ? "Edit Project"
              : panelMode === "members"
              ? "Manage Members"
              : selectedProject?.name || "Project Details"}
          </Typography>
          <IconButton onClick={closeDrawer}>
            <Close />
          </IconButton>
        </Box>

        {panelMode === "view" && selectedProject && (
          <>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <FolderSpecial sx={{ color: "#4a9eff" }} />
              <Typography variant="subtitle2" color="text.secondary">
                Created {selectedProject.created_at?.split("T")[0]}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ mb: 2 }} color="text.secondary">
              {selectedProject.description || "No description provided."}
            </Typography>
            <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap>
              <Chip
                label={`Owner: ${selectedProject.owner_username}`}
                size="small"
                color="primary"
              />
              {selectedProject.updated_at && (
                <Chip
                  label={`Updated ${selectedProject.updated_at.split("T")[0]}`}
                  size="small"
                  color="info"
                />
              )}
            </Stack>

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <b>Project Statistics</b>
            </Typography>
            <Grid container spacing={1} sx={{ mb: 2 }}>
              <Grid size={{ xs: 4 }}>
                <Box sx={{ textAlign: "center", p: 1, bgcolor: "rgba(74,158,255,0.1)", borderRadius: 1 }}>
                  <Typography variant="h6" fontWeight={700}>{selectedProject.workload_count || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">Workloads</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <Box sx={{ textAlign: "center", p: 1, bgcolor: "rgba(74,158,255,0.1)", borderRadius: 1 }}>
                  <Typography variant="h6" fontWeight={700}>{selectedProject.platform_count || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">Platforms</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <Box sx={{ textAlign: "center", p: 1, bgcolor: "rgba(74,158,255,0.1)", borderRadius: 1 }}>
                  <Typography variant="h6" fontWeight={700}>{selectedProject.scenario_count || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">Scenarios</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <Box sx={{ textAlign: "center", p: 1, bgcolor: "rgba(74,158,255,0.1)", borderRadius: 1 }}>
                  <Typography variant="h6" fontWeight={700}>{selectedProject.strategy_count || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">Strategies</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <Box sx={{ textAlign: "center", p: 1, bgcolor: "rgba(74,158,255,0.1)", borderRadius: 1 }}>
                  <Typography variant="h6" fontWeight={700}>{selectedProject.experiment_count || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">Experiments</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <Box sx={{ textAlign: "center", p: 1, bgcolor: "rgba(74,158,255,0.1)", borderRadius: 1 }}>
                  <Typography variant="h6" fontWeight={700}>{selectedProject.member_count || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">Members</Typography>
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <b>Members</b>
            </Typography>
            <List dense>
              {members.map((m) => (
                <ListItem key={m.id}>
                  <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: "#4a9eff" }}>
                    {m.username?.[0]?.toUpperCase() || "U"}
                  </Avatar>
                  <ListItemText
                    primary={m.username || `User #${m.user_id}`}
                    secondary={m.email}
                  />
                  <Chip
                    label={m.role}
                    size="small"
                    color={getRoleColor(m.role)}
                    sx={{ mr: 1 }}
                  />
                  {canManageProject(selectedProject) && m.role !== "owner" && (
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveMember(m.user_id);
                      }}
                    >
                      <PersonRemove fontSize="small" />
                    </IconButton>
                  )}
                </ListItem>
              ))}
            </List>

            <Stack direction="row" spacing={2} mt={3}>
              {canManageProject(selectedProject) && (
                <>
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
                    color="secondary"
                    startIcon={<PersonAdd />}
                    onClick={() => setAddMemberDialogOpen(true)}
                    sx={{ fontWeight: 700, borderRadius: 1 }}
                  >
                    Add Member
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
                </>
              )}
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
              label="Project Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
              required
              sx={{ mb: 2 }}
            />
            <TextField
              label="Description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              fullWidth
              multiline
              minRows={3}
              sx={{ mb: 2 }}
            />
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
                disabled={actionLoading || !form.name}
                sx={{ fontWeight: 700, borderRadius: 1 }}
              >
                {panelMode === "add" ? "Create" : "Save"}
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

        {/* Add Member Dialog */}
        <Dialog
          open={addMemberDialogOpen}
          onClose={() => setAddMemberDialogOpen(false)}
        >
          <DialogTitle>Add Member</DialogTitle>
          <DialogContent>
            <TextField
              label="User ID"
              type="number"
              value={newMemberUserId}
              onChange={(e) => setNewMemberUserId(e.target.value)}
              fullWidth
              sx={{ mb: 2, mt: 1 }}
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={newMemberRole}
                label="Role"
                onChange={(e) => setNewMemberRole(e.target.value as ProjectRole)}
              >
                <MenuItem value="member">Member</MenuItem>
                <MenuItem value="viewer">Viewer</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddMemberDialogOpen(false)} color="secondary">
              Cancel
            </Button>
            <Button
              onClick={handleAddMember}
              color="primary"
              disabled={actionLoading || !newMemberUserId}
            >
              Add
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>Delete Project</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete this project? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} color="secondary">
              Cancel
            </Button>
            <Button onClick={handleDelete} color="error" disabled={actionLoading}>
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

export default ProjectsPage;
