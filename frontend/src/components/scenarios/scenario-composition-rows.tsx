/**
 * Composition rows for a scenario card/drawer: workload + platform with cheap
 * stats shown DIRECTLY (no hover needed) + compatibility badge.
 * Click a row -> detail popover (lazy-fetches workload summary).
 */
import React, { useState } from "react";
import {
  Box, Chip, CircularProgress, Divider, Paper, Popover, Stack, Typography,
} from "@mui/material";
import { Assessment, CheckCircle, Dns, WarningAmber } from "@mui/icons-material";
import {
  Scenario, WorkloadSummary, workloadsAPI,
} from "../../services/api";

function formatFileSize(bytes?: number): string {
  if (bytes == null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface RowProps {
  icon: React.ReactNode;
  name: string;
  version?: number;
  caption: string;
  onClick: (e: React.MouseEvent<HTMLElement>) => void;
}

const CompositionRow: React.FC<RowProps> = ({ icon, name, version, caption, onClick }) => (
  <Stack
    direction="row" alignItems="center" spacing={1.5}
    onClick={(e) => { e.stopPropagation(); onClick(e); }}
    sx={{
      px: 1.5, py: 1, cursor: "pointer", borderRadius: 1,
      transition: "background-color 200ms",
      "&:hover": { bgcolor: "action.hover" },
    }}
  >
    {icon}
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        {/* Primary text weight/color — NOT muted gray (contrast rule) */}
        <Typography variant="body2" fontWeight={600} noWrap title={name}>
          {name}
        </Typography>
        {version != null && <Chip label={`v${version}`} size="small" sx={{ height: 18 }} />}
      </Stack>
      <Typography variant="caption" color="text.secondary">{caption}</Typography>
    </Box>
  </Stack>
);

export const ScenarioCompositionRows: React.FC<{ scenario: Scenario }> = ({ scenario }) => {
  const wl = scenario.workload;
  const pf = scenario.platform;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [popoverKind, setPopoverKind] = useState<"workload" | "platform">("workload");
  const [summary, setSummary] = useState<WorkloadSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const openPopover = (kind: "workload" | "platform") => (e: React.MouseEvent<HTMLElement>) => {
    setPopoverKind(kind);
    setAnchor(e.currentTarget);
    if (kind === "workload" && wl) {
      // Lazy fetch: job/profile counts come from the summary endpoint only
      // when the popover opens — list payload stays cheap.
      setSummaryLoading(true);
      setSummary(null);
      workloadsAPI.getSummary(wl.id)
        .then((res) => setSummary(res.data))
        .catch(() => setSummary(null))
        .finally(() => setSummaryLoading(false));
    }
  };

  const compatible =
    wl?.nb_res != null && pf?.nb_hosts != null ? wl.nb_res <= pf.nb_hosts : null;

  return (
    <>
      <Paper variant="outlined" sx={{ bgcolor: "rgba(255,255,255,0.03)", mb: 1.5 }}>
        <CompositionRow
          icon={<Assessment sx={{ color: "#4a9eff" }} fontSize="small" />}
          name={wl?.name || scenario.workload_name || "-"}
          version={wl?.version ?? scenario.workload_version}
          caption={`${wl?.nb_res ?? "?"} res · ${formatFileSize(wl?.file_size)}`}
          onClick={openPopover("workload")}
        />
        <Divider />
        <CompositionRow
          icon={<Dns sx={{ color: "#9c7bff" }} fontSize="small" />}
          name={pf?.name || scenario.platform_name || "-"}
          version={pf?.version ?? scenario.platform_version}
          caption={`${pf?.nb_hosts ?? "?"} hosts${pf?.nb_clusters ? ` · ${pf.nb_clusters} cluster${pf.nb_clusters > 1 ? "s" : ""}` : ""}`}
          onClick={openPopover("platform")}
        />
      </Paper>

      {compatible != null && (
        <Chip
          size="small"
          icon={compatible ? <CheckCircle /> : <WarningAmber />}
          color={compatible ? "success" : "warning"}
          variant="outlined"
          label={
            compatible
              ? "Compatible"
              : `Workload needs ${wl!.nb_res} res, platform has ${pf!.nb_hosts}`
          }
          sx={{ mb: 1.5 }}
        />
      )}

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, minWidth: 240, maxWidth: 320 }}>
          {popoverKind === "workload" && wl && (
            <>
              <Typography variant="subtitle2" fontWeight={700}>{wl.name}</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Workload · v{wl.version}
              </Typography>
              {summaryLoading ? (
                <CircularProgress size={18} />
              ) : (
                <Stack spacing={0.5}>
                  <Typography variant="body2">Jobs: {summary?.n_jobs ?? "-"}</Typography>
                  <Typography variant="body2">Profiles: {summary?.n_profiles ?? "-"}</Typography>
                  <Typography variant="body2">Resources: {wl.nb_res ?? "-"}</Typography>
                  <Typography variant="body2">File size: {formatFileSize(wl.file_size)}</Typography>
                </Stack>
              )}
            </>
          )}
          {popoverKind === "platform" && pf && (
            <>
              <Typography variant="subtitle2" fontWeight={700}>{pf.name}</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Platform · v{pf.version}
              </Typography>
              <Stack spacing={0.5}>
                <Typography variant="body2">Hosts: {pf.nb_hosts ?? "-"}</Typography>
                <Typography variant="body2">Clusters: {pf.nb_clusters ?? "-"}</Typography>
              </Stack>
            </>
          )}
        </Box>
      </Popover>
    </>
  );
};
