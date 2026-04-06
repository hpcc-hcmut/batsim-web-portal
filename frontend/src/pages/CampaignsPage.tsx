import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { campaignsAPI, Campaign, Scenario, scenariosAPI, Strategy, strategiesAPI, downloadBlob } from "../services/api";

const CampaignsPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    notes: "",
    scenario_ids: [] as number[],
    strategy_ids: [] as number[],
    seeds: "1,2,3",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [campaignsRes, scenariosRes, strategiesRes] = await Promise.all([
        campaignsAPI.getAll(),
        scenariosAPI.getAll(),
        strategiesAPI.getAll(),
      ]);
      setCampaigns(campaignsRes.data);
      setScenarios(scenariosRes.data);
      setStrategies(strategiesRes.data);
      setError(null);
    } catch {
      setError("Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    try {
      await campaignsAPI.create({
        name: form.name,
        description: form.description,
        notes: form.notes,
        scenario_ids: form.scenario_ids,
        strategy_ids: form.strategy_ids,
        seeds: form.seeds
          .split(",")
          .map((item) => Number(item.trim()))
          .filter((value) => !Number.isNaN(value)),
      });
      setDialogOpen(false);
      setForm({
        name: "",
        description: "",
        notes: "",
        scenario_ids: [],
        strategy_ids: [],
        seeds: "1,2,3",
      });
      await load();
    } catch {
      setError("Failed to create campaign.");
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={900}>
          Campaigns
        </Typography>
        <Button variant="contained" onClick={() => setDialogOpen(true)}>
          Create Campaign
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2}>
          {campaigns.map((campaign) => (
            <Card key={campaign.id} sx={{ background: "rgba(26,32,44,0.98)" }}>
              <CardContent>
                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography variant="h6" fontWeight={900}>
                      {campaign.name}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 1 }}>
                      {campaign.description || "No description provided."}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip label={campaign.status} size="small" color="primary" />
                      <Chip label={`Runs: ${campaign.total_runs ?? 0}`} size="small" />
                      <Chip label={`Completed: ${campaign.completed_runs ?? 0}`} size="small" color="success" />
                      <Chip label={`Failed: ${campaign.failed_runs ?? 0}`} size="small" color="error" />
                    </Stack>
                  </Box>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button variant="outlined" onClick={() => campaignsAPI.start(campaign.id).then(load)}>
                      Start
                    </Button>
                    <Button variant="outlined" color="warning" onClick={() => campaignsAPI.stop(campaign.id).then(load)}>
                      Stop
                    </Button>
                    <Button variant="outlined" onClick={() => campaignsAPI.retryFailed(campaign.id).then(load)}>
                      Retry Failed
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={async () => {
                        const response = await campaignsAPI.exportBundle(campaign.id);
                        downloadBlob(response.data, `campaign-${campaign.id}.zip`);
                      }}
                    >
                      Export
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
          {!campaigns.length && (
            <Typography color="text.secondary">No campaigns created yet.</Typography>
          )}
        </Stack>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Campaign</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} multiline rows={3} />
            <TextField label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} multiline rows={2} />
            <FormControl fullWidth>
              <InputLabel>Scenarios</InputLabel>
              <Select
                multiple
                value={form.scenario_ids}
                label="Scenarios"
                onChange={(e) => setForm({ ...form, scenario_ids: e.target.value as number[] })}
              >
                {scenarios.map((scenario) => (
                  <MenuItem key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Strategies</InputLabel>
              <Select
                multiple
                value={form.strategy_ids}
                label="Strategies"
                onChange={(e) => setForm({ ...form, strategy_ids: e.target.value as number[] })}
              >
                {strategies.map((strategy) => (
                  <MenuItem key={strategy.id} value={strategy.id}>
                    {strategy.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Seeds"
              helperText="Comma-separated integers, e.g. 1,2,3"
              value={form.seeds}
              onChange={(e) => setForm({ ...form, seeds: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!form.name || !form.scenario_ids.length || !form.strategy_ids.length}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CampaignsPage;
