import { useCallback, useEffect, useRef, useState, CSSProperties } from "react";
import { List, RowComponentProps } from "react-window";
import { Box, CircularProgress, Stack, Typography, Alert } from "@mui/material";
import { workloadsAPI } from "../../services/api";

interface Props {
  workloadId: number;
  height?: number;
  rowHeight?: number;
  pageSize?: number;
}

/**
 * Virtualized scroll over a workload's jobs list. Fetches a fixed page on mount and
 * refetches when the user scrolls near the end — avoids loading thousands of rows into
 * the DOM at once (root cause of the old <pre>{JSON.stringify(...)}</pre> dump's lag).
 *
 * Server already caps `limit` at 500; we ask for 200 per page which keeps over-the-wire
 * payloads small and renders quickly. Each row shows id / submit / walltime / res / profile —
 * enough for researchers to inspect shape without opening per-job detail.
 *
 * Uses react-window v2 List API: rowComponent receives index+style, custom data flows
 * via rowProps which v2 spreads into the row component.
 */
export function VirtualJobList({
  workloadId,
  height = 320,
  rowHeight = 36,
  pageSize = 200,
}: Props) {
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(
    async (offset: number) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      try {
        const res = await workloadsAPI.getJobs(workloadId, offset, pageSize);
        setJobs((prev) => {
          // Splice the new page into the existing array starting at offset.
          // Sentinel `{}` (0 keys) marks "page not yet loaded" — BatSim jobs always
          // ship with id/walltime/subtime fields, so collision with a real empty
          // object is not possible in practice.
          const next = prev.slice();
          while (next.length < offset) next.push({});
          for (let i = 0; i < res.data.jobs.length; i += 1) {
            next[offset + i] = res.data.jobs[i];
          }
          return next;
        });
        setTotal(res.data.total);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load jobs";
        setError(msg);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [workloadId, pageSize],
  );

  useEffect(() => {
    setJobs([]);
    setTotal(null);
    setError(null);
    loadMore(0);
  }, [workloadId, loadMore]);

  const handleRowsRendered = useCallback(
    (visible: { startIndex: number; stopIndex: number }) => {
      if (total === null) return;
      const loadedTo = jobs.length;
      // Fetch next page when user scrolls within half-page of the end of loaded data.
      if (visible.stopIndex >= loadedTo - pageSize / 2 && loadedTo < total) {
        loadMore(loadedTo);
      }
    },
    [jobs.length, total, pageSize, loadMore],
  );

  if (error) {
    return (
      <Alert severity="error" sx={{ my: 1 }}>
        {error}
      </Alert>
    );
  }

  if (total === null && loading) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 2 }}>
        <CircularProgress size={18} />
        <Typography variant="body2">Loading jobs…</Typography>
      </Stack>
    );
  }

  if (total === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
        Workload has no jobs.
      </Typography>
    );
  }

  const itemCount = total ?? 0;

  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "60px 1fr 1fr 80px 1fr",
          px: 1,
          py: 0.5,
          bgcolor: "action.hover",
          fontWeight: 600,
          fontSize: 12,
        }}
      >
        <span>#</span>
        <span>id</span>
        <span>subtime</span>
        <span>res</span>
        <span>walltime / profile</span>
      </Box>
      <List
        rowComponent={JobRow}
        rowCount={itemCount}
        rowHeight={rowHeight}
        rowProps={{ jobs }}
        defaultHeight={height}
        onRowsRendered={handleRowsRendered}
        style={{ height }}
      />
      {loading && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 0.5 }}>
          <CircularProgress size={14} />
          <Typography variant="caption" color="text.secondary">
            Loading more…
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

interface JobRowExtras {
  jobs: Array<Record<string, unknown>>;
}

function JobRow({ index, style, jobs }: RowComponentProps<JobRowExtras>) {
  const cellSx: CSSProperties = {
    fontSize: 12,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
  const job = jobs[index];
  // Empty slot means this row's page hasn't loaded yet — show placeholder so virtualization
  // doesn't reflow when the page arrives.
  if (!job || Object.keys(job).length === 0) {
    return (
      <div style={{ ...style, padding: "0 8px", color: "#999" }}>
        <span style={cellSx}>{index}</span> loading…
      </div>
    );
  }
  const id = job["id"];
  const subtime = job["subtime"];
  const res = job["res"];
  const walltime = job["walltime"];
  const profile = job["profile"];
  return (
    <div
      style={{
        ...style,
        display: "grid",
        gridTemplateColumns: "60px 1fr 1fr 80px 1fr",
        padding: "0 8px",
        alignItems: "center",
        borderTop: "1px solid #f0f0f0",
      }}
    >
      <span style={cellSx}>{index}</span>
      <span style={cellSx}>{String(id ?? "-")}</span>
      <span style={cellSx}>{typeof subtime === "number" ? subtime.toFixed(2) : "-"}</span>
      <span style={cellSx}>{typeof res === "number" ? res : "-"}</span>
      <span style={cellSx}>
        {typeof walltime === "number" ? walltime.toFixed(2) : "-"} / {String(profile ?? "-")}
      </span>
    </div>
  );
}
