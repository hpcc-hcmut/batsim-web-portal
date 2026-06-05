/**
 * Scenario detail drawer: composition info + experiments using this scenario
 * + "New Experiment" CTA (prefilled). Follows the drawer pattern used by
 * Workloads/Results pages.
 */
import React, { useEffect, useState } from "react";
import {
  Box, Button, Chip, CircularProgress, Divider, Drawer, IconButton, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from "@mui/material";
import { Add, Close, Settings } from "@mui/icons-material";
import { Experiment, Scenario, experimentsAPI } from "../../services/api";
import { formatRelativeTime } from "../../utils/format-relative-time";
import { ScenarioCompositionRows } from "./scenario-composition-rows";

function statusColor(status: string) {
  switch (status) {
    case "completed": return "success" as const;
    case "running": return "warning" as const;
    case "failed": return "error" as const;
    case "queued": return "info" as const;
    default: return "default" as const;
  }
}

interface Props {
  scenario: Scenario | null;
  open: boolean;
  onClose: () => void;
  onCreateExperiment: (scenario: Scenario) => void;
}

export const ScenarioDetailDrawer: React.FC<Props> = ({
  scenario, open, onClose, onCreateExperiment,
}) => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [expLoading, setExpLoading] = useState(false);

  // Fetch experiments referencing this scenario each time the drawer opens
  useEffect(() => {
    if (!open || !scenario) return;
    let cancelled = false;
    setExpLoading(true);
    experimentsAPI
      .getAll({ scenario_id: scenario.id, limit: 50 })
      .then((res) => { if (!cancelled) setExperiments(res.data); })
      .catch(() => { if (!cancelled) setExperiments([]); })
      .finally(() => { if (!cancelled) setExpLoading(false); });
    return () => { cancelled = true; };
  }, [open, scenario?.id]);

  if (!scenario) return null;

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 480 } } }}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
          <Settings sx={{ color: "#4a9eff" }} />
          <Typography variant="h6" fontWeight={800} noWrap sx={{ flex: 1 }} title={scenario.name}>
            {scenario.name}
          </Typography>
          <IconButton onClick={onClose} aria-label="Close scenario details">
            <Close />
          </IconButton>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {scenario.description || "No description provided."}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Chip label={formatRelativeTime(scenario.created_at)} size="small" />
          <Chip label={scenario.creator_username || "user"} size="small" color="secondary" />
        </Stack>

        {/* Composition */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
          Composition
        </Typography>
        <ScenarioCompositionRows scenario={scenario} />

        <Divider sx={{ my: 2 }} />

        {/* Experiments using this scenario */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
          Experiments using this scenario
        </Typography>
        {expLoading ? (
          <CircularProgress size={20} sx={{ my: 2 }} />
        ) : experiments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
            No experiments yet.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {experiments.map((e) => (
                <TableRow key={e.id} hover>
                  <TableCell sx={{ maxWidth: 180 }}>
                    <Typography variant="body2" noWrap title={e.name}>{e.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={e.status} size="small" color={statusColor(e.status)} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {formatRelativeTime(e.created_at)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* CTA */}
        <Button
          variant="contained" fullWidth startIcon={<Add />} sx={{ mt: 3 }}
          onClick={() => onCreateExperiment(scenario)}
        >
          New Experiment
        </Button>
      </Box>
    </Drawer>
  );
};
