import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Tabs,
  Tab,
  TextField,
  Button,
  Chip,
  Alert,
  Skeleton,
  Typography,
} from "@mui/material";
import { Refresh, Download } from "@mui/icons-material";
import { experimentsAPI } from "../../services/api";
import { renderLine } from "./log-line-renderer";

type StreamKey = "batsim_stdout" | "batsim_stderr" | "pybatsim_stdout" | "pybatsim_stderr";

interface StreamData {
  content: string;
  truncated: boolean;
  size_bytes: number;
}

type StreamsState = Record<StreamKey, StreamData>;

const STREAM_KEYS: StreamKey[] = [
  "batsim_stdout",
  "batsim_stderr",
  "pybatsim_stdout",
  "pybatsim_stderr",
];

const STREAM_LABELS: Record<StreamKey, string> = {
  batsim_stdout: "BatSim stdout",
  batsim_stderr: "BatSim stderr",
  pybatsim_stdout: "PyBatsim stdout",
  pybatsim_stderr: "PyBatsim stderr",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface LogStreamViewerProps {
  experimentId: number;
  live: boolean; // drives 5s auto-refresh when RUNNING
}

export const LogStreamViewer: React.FC<LogStreamViewerProps> = ({ experimentId, live }) => {
  const [streams, setStreams] = useState<StreamsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchStreams = useCallback(async () => {
    try {
      const res = await experimentsAPI.getLogStreams(experimentId);
      setStreams(res.data as StreamsState);
      setFetchError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load logs";
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    fetchStreams();
  }, [fetchStreams]);

  // Auto-refresh when live
  useEffect(() => {
    if (!live) return;
    const id = setInterval(fetchStreams, 5000);
    return () => clearInterval(id);
  }, [live, fetchStreams]);

  const activeKey = STREAM_KEYS[activeTab];
  const activeStream = streams?.[activeKey];

  const renderedLines = useMemo(() => {
    if (!activeStream?.content) return null;
    const lines = activeStream.content.split("\n");
    const filtered = searchTerm
      ? lines.filter((l) => l.toLowerCase().includes(searchTerm.toLowerCase()))
      : lines;
    if (filtered.length === 0) return null;
    return filtered.map((line, i) => renderLine(line, i + 1));
  }, [activeStream?.content, searchTerm]);

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rectangular" height={40} sx={{ mb: 1 }} />
        <Skeleton variant="rectangular" height={300} />
      </Box>
    );
  }

  if (fetchError) {
    return <Alert severity="error" sx={{ m: 2 }}>{fetchError}</Alert>;
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => { setActiveTab(v as number); setSearchTerm(""); }}
          variant="scrollable"
          scrollButtons="auto"
        >
          {STREAM_KEYS.map((key) => {
            const s = streams?.[key];
            const label = `${STREAM_LABELS[key]}${s ? ` · ${formatSize(s.size_bytes)}` : ""}`;
            return (
              <Tab
                key={key}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <span>{label}</span>
                    {s?.truncated && (
                      <Chip label="TRUNCATED" size="small" color="warning" sx={{ height: 16, fontSize: "0.6rem" }} />
                    )}
                  </Box>
                }
              />
            );
          })}
        </Tabs>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1, borderBottom: 1, borderColor: "divider" }}>
        <TextField
          size="small"
          placeholder="Search lines..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ width: 200 }}
          inputProps={{ "aria-label": "search log lines" }}
        />
        <Button size="small" startIcon={<Refresh />} onClick={fetchStreams} variant="outlined">
          Refresh
        </Button>
        <Button
          size="small"
          startIcon={<Download />}
          variant="outlined"
          component="a"
          href={experimentsAPI.downloadLogStreamUrl(experimentId, activeKey)}
          download
        >
          Download .txt
        </Button>
        {live && (
          <Chip label="LIVE" color="success" size="small" sx={{ ml: "auto" }} />
        )}
      </Box>

      {activeStream?.truncated && (
        <Alert severity="warning" sx={{ mx: 2, mt: 1, py: 0.5 }}>
          Stream truncated to 5 MB. Download for full content.
        </Alert>
      )}

      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          p: 1.5,
          bgcolor: "grey.900",
          fontFamily: "monospace",
          fontSize: "0.75rem",
          color: "grey.100",
          minHeight: 200,
        }}
      >
        {renderedLines ?? (
          <Typography
            sx={{
              color: "grey.500",
              fontFamily: "monospace",
              fontSize: "0.75rem",
              textAlign: "center",
              mt: 4,
            }}
          >
            No output captured.
          </Typography>
        )}
      </Box>
    </Box>
  );
};
