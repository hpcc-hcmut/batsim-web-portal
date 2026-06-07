import React, { useState } from "react";
import {
  Box,
  Typography,
  Chip,
  Stack,
  Drawer,
  IconButton,
  Divider,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tab,
  Tabs,
} from "@mui/material";
import {
  Delete,
  Close,
  Download,
  ExpandMore,
  Description,
  Code as CodeIcon,
  PlayArrow,
  Science,
} from "@mui/icons-material";
import { Result } from "../../services/api";
import { ReplayView } from "./replay-view";
import { ErrorBoundary } from "../common/error-boundary";

// Helpers shared with parent
export function formatMetric(value: number | undefined, unit: string = "") {
  if (value === undefined || value === null) return "-";
  return `${value.toFixed(2)}${unit}`;
}

export function getComputedMetrics(result: Result) {
  if (!result.computed_metrics) return null;
  try {
    return JSON.parse(result.computed_metrics);
  } catch {
    return null;
  }
}

interface ResultDetailDrawerProps {
  open: boolean;
  result: Result | null;
  onClose: () => void;
  onDelete: () => void;
  onRerun: () => void;
  onDownload: (format: "json" | "csv") => void;
  /** Opens the source experiment detail ("which config produced this?") */
  onViewExperiment?: () => void;
}

const ResultDetailDrawer: React.FC<ResultDetailDrawerProps> = ({
  open,
  result,
  onClose,
  onDelete,
  onRerun,
  onDownload,
  onViewExperiment,
}) => {
  const [expandedJobs, setExpandedJobs] = useState(false);
  const [expandedSchedule, setExpandedSchedule] = useState(false);
  const [tab, setTab] = useState(0);

  // Drawer widens significantly when Replay tab is active so the Gantt + charts have
  // room to breathe; Summary stays narrow so the side-by-side reading flow remains.
  const drawerWidth = tab === 1
    ? { xs: "100%", md: "90vw", lg: "1100px" }
    : { xs: "100%", md: 420 };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: drawerWidth, p: 3, background: "#1a202c" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 1 }}>
        <Typography variant="h6" fontWeight={900} sx={{ flex: 1, minWidth: 0 }} noWrap>
          {result?.experiment_name || "Result Details"}
        </Typography>
        {result && (
          <>
            {/* Result-level actions live in the header so they're reachable regardless
                of which tab the researcher is currently viewing. */}
            {onViewExperiment && (
              <Tooltip title="View source experiment (configuration, logs)">
                <IconButton size="small" onClick={onViewExperiment} color="info">
                  <Science />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Rerun experiment">
              <IconButton size="small" onClick={onRerun} color="primary">
                <PlayArrow />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete result">
              <IconButton size="small" onClick={onDelete} color="error">
                <Delete />
              </IconButton>
            </Tooltip>
          </>
        )}
        <IconButton onClick={onClose}>
          <Close />
        </IconButton>
      </Box>
      {result && (
        <>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Description sx={{ color: "#4a9eff" }} />
            <Typography variant="subtitle2" color="text.secondary">
              Result Files &bull; {result.created_at?.split("T")[0]}
            </Typography>
            <Tooltip title="Download JSON">
              <IconButton size="small" onClick={() => onDownload("json")}>
                <Download />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download CSV">
              <IconButton size="small" onClick={() => onDownload("csv")}>
                <CodeIcon />
              </IconButton>
            </Tooltip>
          </Stack>
          <Stack direction="row" spacing={1} mb={2}>
            <Chip label={result.scenario_name || "Scenario"} size="small" color="secondary" />
            <Chip label={result.strategy_name || "Strategy"} size="small" color="primary" />
            <Chip label={result.created_at?.split("T")[0]} size="small" color="default" />
          </Stack>

          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
          >
            <Tab label="Summary" />
            <Tab label="Replay" />
          </Tabs>

          {tab === 1 && (
            // Per-tab ErrorBoundary so a Gantt/timeline crash doesn't blank the Summary
            // half of the drawer or kill the whole results page.
            <ErrorBoundary scope="Replay">
              <ReplayView resultId={result.id} />
            </ErrorBoundary>
          )}

          {tab === 0 && (
            <>
          <Divider sx={{ my: 2 }} />

          {/* Key Metrics */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            <b>Key Metrics</b>
          </Typography>
          <Stack spacing={2} mb={3}>
            {([
              ["Makespan", result.makespan, "s"],
              ["Avg Waiting Time", result.average_waiting_time, "s"],
              ["Avg Turnaround Time", result.average_turnaround_time, "s"],
              ["Resource Utilization", result.resource_utilization, "%"],
              ["Simulation Time", result.simulation_time, "s"],
            ] as [string, number | undefined, string][]).map(([label, val, unit]) => (
              <Stack key={label} direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">{label}:</Typography>
                <Typography variant="body2" fontWeight={600}>{formatMetric(val, unit)}</Typography>
              </Stack>
            ))}
          </Stack>

          {/* Job Statistics */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            <b>Job Statistics</b>
          </Typography>
          <Stack direction="row" spacing={2} mb={3}>
            <Chip label={`Total: ${result.total_jobs ?? 0}`} size="small" color="secondary" />
            <Chip label={`Completed: ${result.completed_jobs ?? 0}`} size="small" color="success" />
            <Chip label={`Failed: ${result.failed_jobs ?? 0}`} size="small" color="error" />
          </Stack>

          {/* Extended Metrics from post-processing */}
          {(() => {
            const cm = getComputedMetrics(result);
            if (!cm) return null;
            const rows: [string, string][] = [];
            if (cm.max_waiting_time != null) rows.push(["Max Waiting Time", `${cm.max_waiting_time.toFixed(2)}s`]);
            if (cm.max_turnaround_time != null) rows.push(["Max Turnaround Time", `${cm.max_turnaround_time.toFixed(2)}s`]);
            if (cm.mean_slowdown != null) rows.push(["Mean Slowdown", cm.mean_slowdown.toFixed(4)]);
            if (cm.throughput != null) rows.push(["Throughput", `${cm.throughput.toFixed(4)} jobs/s`]);
            if (cm.consumed_joules != null) rows.push(["Energy", `${cm.consumed_joules.toFixed(0)} J`]);
            if (cm.success_rate != null) rows.push(["Success Rate", `${(cm.success_rate * 100).toFixed(1)}%`]);
            if (cm.nb_computing_machines != null) rows.push(["Computing Machines", String(cm.nb_computing_machines)]);
            if (rows.length === 0) return null;
            return (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  <b>Extended Metrics</b>
                </Typography>
                <Stack spacing={1} mb={2}>
                  {rows.map(([label, val]) => (
                    <Stack key={label} direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">{label}:</Typography>
                      <Typography variant="body2" fontWeight={600}>{val}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </>
            );
          })()}

          {/* Data Files */}
          <Accordion expanded={expandedJobs} onChange={() => setExpandedJobs((v) => !v)}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>Jobs Data</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ maxHeight: 180, overflow: "auto" }}>
                <pre style={{ fontSize: 12, margin: 0 }}>
                  {result.jobs_data || "No jobs data available"}
                </pre>
              </Box>
            </AccordionDetails>
          </Accordion>
          <Accordion expanded={expandedSchedule} onChange={() => setExpandedSchedule((v) => !v)}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>Schedule Data</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ maxHeight: 180, overflow: "auto" }}>
                <pre style={{ fontSize: 12, margin: 0 }}>
                  {result.schedule_data || "No schedule data available"}
                </pre>
              </Box>
            </AccordionDetails>
          </Accordion>

            </>
          )}
        </>
      )}
    </Drawer>
  );
};

export default ResultDetailDrawer;
