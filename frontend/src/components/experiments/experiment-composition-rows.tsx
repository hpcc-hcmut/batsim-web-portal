/**
 * Composition rows for the experiment Overview tab: Workload / Platform /
 * Strategy shown as clickable rows (same look as scenario drawer rows).
 *
 * Versions displayed come from frozen_config when the experiment has been
 * started (reproducibility truth); live entity data is lazy-fetched for the
 * popover stats and for the "updated since freeze" warning chip.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Chip, CircularProgress, Divider, Paper, Popover, Stack, Typography,
} from "@mui/material";
import { Assessment, Code, Dns } from "@mui/icons-material";
import {
  Experiment, Scenario, Strategy, WorkloadSummary,
  scenariosAPI, strategiesAPI, workloadsAPI,
} from "../../services/api";
import {
  CompositionRow, formatFileSize,
} from "../scenarios/scenario-composition-rows";

type Kind = "workload" | "platform" | "strategy";

interface FrozenEntity { name?: string; version?: number }
interface FrozenConfig {
  created_at?: string;
  config?: { workload?: FrozenEntity; platform?: FrozenEntity; strategy?: FrozenEntity };
  hashes?: Record<string, string>;
}

/** Warning chip shown when the live entity moved past the frozen version */
function driftChip(frozen?: number, live?: number): React.ReactNode {
  if (frozen == null || live == null || live <= frozen) return undefined;
  return (
    <Chip
      label={`frozen v${frozen} · now v${live}`}
      size="small"
      color="warning"
      variant="outlined"
      sx={{ height: 18 }}
    />
  );
}

export const ExperimentCompositionRows: React.FC<{ experiment: Experiment }> = ({ experiment }) => {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [kind, setKind] = useState<Kind>("workload");
  const [summary, setSummary] = useState<WorkloadSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const frozen: FrozenConfig | null = useMemo(() => {
    try {
      return experiment.frozen_config ? JSON.parse(experiment.frozen_config) : null;
    } catch { return null; }
  }, [experiment.frozen_config]);

  // One fetch per dialog open; deleted entities just leave rows on frozen data
  useEffect(() => {
    scenariosAPI.getById(experiment.scenario_id)
      .then((res) => setScenario(res.data)).catch(() => setScenario(null));
    strategiesAPI.getById(experiment.strategy_id)
      .then((res) => setStrategy(res.data)).catch(() => setStrategy(null));
  }, [experiment.scenario_id, experiment.strategy_id]);

  const wl = scenario?.workload;
  const pf = scenario?.platform;
  const fz = frozen?.config;

  const openPopover = (k: Kind) => (e: React.MouseEvent<HTMLElement>) => {
    setKind(k);
    setAnchor(e.currentTarget);
    if (k === "workload" && wl) {
      setSummaryLoading(true);
      setSummary(null);
      workloadsAPI.getSummary(wl.id)
        .then((res) => setSummary(res.data))
        .catch(() => setSummary(null))
        .finally(() => setSummaryLoading(false));
    }
  };

  return (
    <>
      <Paper variant="outlined" sx={{ bgcolor: "rgba(255,255,255,0.03)" }}>
        <CompositionRow
          icon={<Assessment sx={{ color: "#4a9eff" }} fontSize="small" />}
          name={fz?.workload?.name || wl?.name || "-"}
          version={fz?.workload?.version ?? wl?.version}
          trailing={driftChip(fz?.workload?.version, wl?.version)}
          caption={`Workload · ${wl?.nb_res ?? "?"} res · ${formatFileSize(wl?.file_size)}`}
          onClick={openPopover("workload")}
        />
        <Divider />
        <CompositionRow
          icon={<Dns sx={{ color: "#9c7bff" }} fontSize="small" />}
          name={fz?.platform?.name || pf?.name || "-"}
          version={fz?.platform?.version ?? pf?.version}
          trailing={driftChip(fz?.platform?.version, pf?.version)}
          caption={`Platform · ${pf?.nb_hosts ?? "?"} hosts`}
          onClick={openPopover("platform")}
        />
        <Divider />
        <CompositionRow
          icon={<Code sx={{ color: "#34d399" }} fontSize="small" />}
          name={fz?.strategy?.name || strategy?.name || experiment.strategy_name || "-"}
          version={fz?.strategy?.version ?? strategy?.version}
          trailing={driftChip(fz?.strategy?.version, strategy?.version)}
          caption={`Strategy · ${strategy?.main_entry || "Python scheduler"}`}
          onClick={openPopover("strategy")}
        />
      </Paper>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, minWidth: 240, maxWidth: 320 }}>
          {kind === "workload" && (
            <>
              <Typography variant="subtitle2" fontWeight={700}>
                {fz?.workload?.name || wl?.name || "-"}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Workload · frozen v{fz?.workload?.version ?? wl?.version ?? "?"}
              </Typography>
              {summaryLoading ? (
                <CircularProgress size={18} />
              ) : (
                <Stack spacing={0.5}>
                  <Typography variant="body2">Jobs: {summary?.n_jobs ?? "-"}</Typography>
                  <Typography variant="body2">Profiles: {summary?.n_profiles ?? "-"}</Typography>
                  <Typography variant="body2">Resources: {wl?.nb_res ?? "-"}</Typography>
                  <Typography variant="body2">File size: {formatFileSize(wl?.file_size)}</Typography>
                </Stack>
              )}
            </>
          )}
          {kind === "platform" && (
            <>
              <Typography variant="subtitle2" fontWeight={700}>
                {fz?.platform?.name || pf?.name || "-"}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Platform · frozen v{fz?.platform?.version ?? pf?.version ?? "?"}
              </Typography>
              <Stack spacing={0.5}>
                <Typography variant="body2">Hosts: {pf?.nb_hosts ?? "-"}</Typography>
                <Typography variant="body2">Clusters: {pf?.nb_clusters ?? "-"}</Typography>
              </Stack>
            </>
          )}
          {kind === "strategy" && (
            <>
              <Typography variant="subtitle2" fontWeight={700}>
                {fz?.strategy?.name || strategy?.name || "-"}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Strategy · frozen v{fz?.strategy?.version ?? strategy?.version ?? "?"}
              </Typography>
              <Stack spacing={0.5}>
                <Typography variant="body2">Entry point: {strategy?.main_entry ?? "-"}</Typography>
                <Typography variant="body2">Files: {strategy?.nb_files ?? 1}</Typography>
                <Typography variant="body2">File size: {formatFileSize(strategy?.file_size)}</Typography>
              </Stack>
            </>
          )}
        </Box>
      </Popover>
    </>
  );
};
