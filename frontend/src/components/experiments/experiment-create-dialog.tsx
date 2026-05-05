import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
} from "@mui/material";
import { experimentsAPI, Scenario, Strategy } from "../../services/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  scenarios: Scenario[];
  strategies: Strategy[];
  onSnackbar: (message: string, severity: "success" | "error") => void;
}

export const ExperimentCreateDialog: React.FC<Props> = ({
  open,
  onClose,
  onCreated,
  scenarios,
  strategies,
  onSnackbar,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    scenario_id: "",
    strategy_id: "",
    seed: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      await experimentsAPI.create({
        name: formData.name,
        description: formData.description,
        scenario_id: parseInt(formData.scenario_id),
        strategy_id: parseInt(formData.strategy_id),
        seed: formData.seed ? parseInt(formData.seed) : undefined,
      });
      onClose();
      setFormData({ name: "", description: "", scenario_id: "", strategy_id: "", seed: "" });
      onSnackbar("Experiment created successfully!", "success");
      onCreated();
    } catch (err: any) {
      onSnackbar(err.response?.data?.detail || "Failed to create experiment.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Experiment</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="Experiment Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            fullWidth
            required
          />
          <TextField
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            fullWidth
            multiline
            rows={3}
          />
          <FormControl fullWidth required>
            <InputLabel>Scenario</InputLabel>
            <Select
              value={formData.scenario_id}
              onChange={(e) => setFormData({ ...formData, scenario_id: e.target.value })}
              label="Scenario"
            >
              {scenarios.map((s) => {
                const detail = [
                  s.workload_name && `WL: ${s.workload_name}`,
                  s.platform_name && `PF: ${s.platform_name}`,
                ]
                  .filter(Boolean)
                  .join(" / ");
                return (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                    {detail && (
                      <span style={{ opacity: 0.65, marginLeft: 8 }}>
                        — {detail}
                      </span>
                    )}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          <FormControl fullWidth required>
            <InputLabel>Strategy</InputLabel>
            <Select
              value={formData.strategy_id}
              onChange={(e) => setFormData({ ...formData, strategy_id: e.target.value })}
              label="Strategy"
            >
              {strategies.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Seed (optional)"
            type="number"
            value={formData.seed}
            onChange={(e) => setFormData({ ...formData, seed: e.target.value })}
            helperText="Random seed for reproducibility. Leave empty for auto-generated."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={submitting || !formData.name || !formData.scenario_id || !formData.strategy_id}
        >
          {submitting ? "Creating..." : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
