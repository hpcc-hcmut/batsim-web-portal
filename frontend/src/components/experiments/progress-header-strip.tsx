// Live progress header strip — polls /progress every 2s while experiment is RUNNING (Task 7.5)
import React, { useEffect, useState, useRef } from "react";
import {
  Box,
  Typography,
  LinearProgress,
  Alert,
  Skeleton,
  CircularProgress,
} from "@mui/material";
import { experimentsAPI } from "../../services/api";
import { Sparkline } from "./sparkline";

const POLL_INTERVAL_MS = 2000; // locked at 2s per D4 — do not lower

interface ProgressData {
  live_jobs_submitted: number;
  live_jobs_completed: number;
  live_jobs_running: number;
  live_jobs_failed: number;
  last_sim_time: number;
  progress_percentage: number;
  total_jobs: number | null;
  completed_jobs: number | null;
  wall_seconds: number;
  live: boolean;
  history?: Array<[number, number]>;
}

// Formats wall_seconds as HH:MM:SS; hides hours when 0
function formatHMS(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return "00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${String(h).padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
}

export interface ProgressHeaderStripProps {
  experimentId: number;
  live: boolean; // true = 2s polling; false = single fetch (final snapshot)
}

export const ProgressHeaderStrip: React.FC<ProgressHeaderStripProps> = ({
  experimentId,
  live,
}) => {
  const [data, setData] = useState<ProgressData | null>(null);
  const [firstLoad, setFirstLoad] = useState(true);
  const [pollError, setPollError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchOnce = async () => {
      try {
        const res = await experimentsAPI.getProgress(experimentId, true);
        if (!cancelled) {
          setData(res.data as ProgressData);
          setPollError(null);
          setFirstLoad(false);
        }
      } catch (e) {
        if (!cancelled) {
          setPollError(e instanceof Error ? e.message : "Failed to fetch progress");
          setFirstLoad(false);
        }
      }
    };

    fetchOnce();

    if (live) {
      intervalRef.current = setInterval(fetchOnce, POLL_INTERVAL_MS);
    }

    return () => {
      cancelled = true;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [experimentId, live]);

  // Loading skeleton on first fetch
  if (firstLoad) {
    return (
      <Skeleton
        variant="rectangular"
        height={36}
        sx={{ mx: 0, borderRadius: 1 }}
      />
    );
  }

  // Error state — non-blocking, sits above the log viewer
  if (pollError && !data) {
    return (
      <Alert severity="error" variant="standard" sx={{ py: 0.25, px: 1.5, fontSize: "0.75rem" }}>
        Progress unavailable: {pollError}
      </Alert>
    );
  }

  if (!data) return null;

  const completed = data.live_jobs_completed || data.completed_jobs || 0;
  const total = data.total_jobs;
  // Recompute pct locally so it's consistent with completed/total when available
  const pct =
    total && total > 0
      ? Math.min(100, Math.round((completed / total) * 100))
      : (data.progress_percentage || 0);

  const showSimTime = data.last_sim_time > 0;
  const showWall = data.wall_seconds > 0;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: 1,
        px: 1.5,
        borderRadius: 1,
        bgcolor: "rgba(74,158,255,0.06)",
        borderBottom: 1,
        borderColor: "divider",
        minHeight: 36,
        flexWrap: "wrap",
      }}
    >
      {/* Live spinner — visible "alive" signal even between poll updates */}
      {live && <CircularProgress size={14} thickness={5} sx={{ flexShrink: 0 }} />}

      {/* Job counter */}
      <Typography
        variant="caption"
        sx={{ fontFamily: "monospace", whiteSpace: "nowrap" }}
      >
        {total ? `${completed}/${total}` : `${completed}`} jobs done ({pct}%)
      </Typography>

      {/* Inline progress bar; bar eases between 2s poll snapshots */}
      <LinearProgress
        variant={total ? "determinate" : "indeterminate"}
        value={total ? pct : undefined}
        sx={{
          width: 120, height: 4, borderRadius: 2, flexShrink: 0,
          "& .MuiLinearProgress-bar": { transition: "transform 500ms linear" },
        }}
      />

      {/* Running count — only when non-zero */}
      {data.live_jobs_running > 0 && (
        <Typography variant="caption" sx={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>
          · {data.live_jobs_running} running
        </Typography>
      )}

      {/* Sim time */}
      {showSimTime && (
        <Typography variant="caption" sx={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>
          · sim_time={data.last_sim_time.toFixed(1)}s
        </Typography>
      )}

      {/* Wall time */}
      {showWall && (
        <Typography variant="caption" sx={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>
          · wall={formatHMS(data.wall_seconds)}
        </Typography>
      )}

      {/* Spacer pushes sparkline to the right */}
      <Box sx={{ flexGrow: 1 }} />

      {/* Sparkline */}
      <Sparkline
        data={data.history || []}
        width={120}
        height={28}
        ariaLabel="jobs completed over time"
      />
    </Box>
  );
};
