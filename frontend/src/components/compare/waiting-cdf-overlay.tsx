/**
 * Waiting-time CDF overlay: one stepped line per compared experiment on the
 * SAME axes - the standard scheduler-comparison chart in the literature.
 * Read: the further a curve hugs the top-left, the less its jobs waited.
 *
 * Data: server-computed waiting_cdf from the timeline endpoint (fetched with
 * limit=1 to skip the heavy per-job list; series are always built from all jobs).
 */
import React, { useEffect, useRef, useState } from "react";
import { Alert, Box, CircularProgress, Paper, Typography } from "@mui/material";
import { Line } from "react-chartjs-2";
import { resultsAPI, TimelineSeriesPoint } from "../../services/api";
import { ChartExportButton } from "../common/chart-export-button";
import { exportCanvasPng } from "../../utils/export-chart-png";

export interface CdfOverlayEntry {
  resultId: number;
  label: string;
  color: string;
}

interface Props {
  entries: CdfOverlayEntry[];
}

type CdfMap = Record<number, TimelineSeriesPoint[]>;

export const WaitingCdfOverlay: React.FC<Props> = ({ entries }) => {
  const [cdfs, setCdfs] = useState<CdfMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);

  // Re-fetch when the compared set changes (key on the id list)
  const idsKey = entries.map((e) => e.resultId).join(",");
  useEffect(() => {
    if (!entries.length) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all(
      entries.map((e) =>
        resultsAPI.getTimeline(e.resultId, 1).then((res) => [e.resultId, res.data.waiting_cdf] as const),
      ),
    )
      .then((pairs) => {
        if (!cancelled) setCdfs(Object.fromEntries(pairs));
      })
      .catch(() => {
        if (!cancelled) setError("Could not load waiting-time distributions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  if (!entries.length) return null;

  const data = cdfs && {
    datasets: entries.map((e) => ({
      label: e.label,
      // {x: wait seconds, y: % of jobs} - stepped so the empirical CDF reads correctly
      data: (cdfs[e.resultId] || []).map((p) => ({ x: p.t, y: p.value * 100 })),
      borderColor: e.color,
      backgroundColor: e.color,
      stepped: "before" as const,
      pointRadius: 0,
      borderWidth: 2,
    })),
  };

  return (
    <Paper sx={{ p: 3, mb: 3, position: "relative" }}>
      {data && (
        <ChartExportButton
          top={12}
          right={12}
          onExport={() =>
            chartRef.current && exportCanvasPng(chartRef.current.canvas, "waiting-cdf-comparison")
          }
        />
      )}
      <Typography variant="h6" gutterBottom>
        Waiting Time Distribution (CDF)
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
        Each point reads "y% of jobs waited at most x seconds". Curves closer to the
        top-left mean the strategy kept more jobs waiting less - this exposes the full
        distribution that averages hide.
      </Typography>
      {loading ? (
        <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={24} />
        </Box>
      ) : error ? (
        <Alert severity="warning">{error}</Alert>
      ) : data ? (
        <Box sx={{ height: 320 }}>
          <Line
            ref={(instance) => {
              chartRef.current = instance;
            }}
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: false,
              plugins: {
                legend: { position: "top", labels: { color: "#e2e8f0" } },
                tooltip: {
                  callbacks: {
                    label: (ctx) =>
                      `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toFixed(1)}% of jobs waited <= ${(ctx.parsed.x ?? 0).toFixed(1)}s`,
                  },
                },
              },
              scales: {
                x: {
                  type: "linear",
                  title: { display: true, text: "Waiting time (s)", color: "#a0aec0" },
                  ticks: { color: "#a0aec0" },
                  grid: { color: "#2d3748" },
                },
                y: {
                  min: 0,
                  max: 100,
                  title: { display: true, text: "% of jobs", color: "#a0aec0" },
                  ticks: { color: "#a0aec0", callback: (v) => `${v}%` },
                  grid: { color: "#2d3748" },
                },
              },
            }}
          />
        </Box>
      ) : null}
    </Paper>
  );
};

export default WaitingCdfOverlay;
