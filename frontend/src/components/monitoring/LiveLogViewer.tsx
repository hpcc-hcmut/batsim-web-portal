/**
 * LiveLogViewer - Real-time log streaming component.
 *
 * Displays BatSim and PyBatsim logs with auto-scroll and filtering.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  IconButton,
  Stack,
  Chip,
  TextField,
  InputAdornment,
  Tooltip,
} from "@mui/material";
import {
  Clear,
  Search,
  ArrowDownward,
  Pause,
  PlayArrow,
} from "@mui/icons-material";

interface LiveLogViewerProps {
  batsimLogs: string[];
  pybatsimLogs: string[];
  isRunning: boolean;
  onClear?: () => void;
}

const LiveLogViewer: React.FC<LiveLogViewerProps> = ({
  batsimLogs,
  pybatsimLogs,
  isRunning,
  onClear,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState("");
  const logContainerRef = useRef<HTMLDivElement>(null);
  const prevLogLengthRef = useRef({ batsim: 0, pybatsim: 0 });

  const currentLogs = activeTab === 0 ? batsimLogs : pybatsimLogs;

  // Filter logs
  const filteredLogs = filter
    ? currentLogs.filter((log) =>
        log.toLowerCase().includes(filter.toLowerCase())
      )
    : currentLogs;

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    const currentLength = activeTab === 0 ? batsimLogs.length : pybatsimLogs.length;
    const prevLength = activeTab === 0
      ? prevLogLengthRef.current.batsim
      : prevLogLengthRef.current.pybatsim;

    if (autoScroll && currentLength > prevLength && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }

    if (activeTab === 0) {
      prevLogLengthRef.current.batsim = batsimLogs.length;
    } else {
      prevLogLengthRef.current.pybatsim = pybatsimLogs.length;
    }
  }, [batsimLogs, pybatsimLogs, activeTab, autoScroll]);

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  const getLogLineColor = (line: string) => {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes("error") || lowerLine.includes("fail")) {
      return "#f44336";
    }
    if (lowerLine.includes("warn")) {
      return "#ff9800";
    }
    if (lowerLine.includes("success") || lowerLine.includes("complete")) {
      return "#4caf50";
    }
    if (lowerLine.includes("info")) {
      return "#4a9eff";
    }
    return "#e2e8f0";
  };

  return (
    <Paper
      sx={{
        borderRadius: 2,
        background: "rgba(26,32,44,0.98)",
        overflow: "hidden",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          px: 2,
          py: 1,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h6" fontWeight={700} sx={{ color: "#fff" }}>
              Logs
            </Typography>
            {isRunning && (
              <Chip
                label="LIVE"
                size="small"
                sx={{
                  bgcolor: "#4caf5022",
                  color: "#4caf50",
                  fontWeight: 700,
                  animation: "pulse 2s infinite",
                  "@keyframes pulse": {
                    "0%": { opacity: 1 },
                    "50%": { opacity: 0.5 },
                    "100%": { opacity: 1 },
                  },
                }}
              />
            )}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Tooltip title={autoScroll ? "Pause auto-scroll" : "Resume auto-scroll"}>
              <IconButton
                size="small"
                onClick={() => setAutoScroll(!autoScroll)}
                sx={{ color: autoScroll ? "#4caf50" : "#9e9e9e" }}
              >
                {autoScroll ? <Pause /> : <PlayArrow />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Scroll to bottom">
              <IconButton size="small" onClick={scrollToBottom} sx={{ color: "#9e9e9e" }}>
                <ArrowDownward />
              </IconButton>
            </Tooltip>
            {onClear && (
              <Tooltip title="Clear logs">
                <IconButton size="small" onClick={onClear} sx={{ color: "#9e9e9e" }}>
                  <Clear />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{
          minHeight: 40,
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          "& .MuiTab-root": {
            minHeight: 40,
            textTransform: "none",
            fontWeight: 600,
          },
        }}
      >
        <Tab
          label={
            <Stack direction="row" spacing={1} alignItems="center">
              <span>BatSim</span>
              <Chip
                label={batsimLogs.length}
                size="small"
                sx={{ height: 20, fontSize: "0.7rem" }}
              />
            </Stack>
          }
        />
        <Tab
          label={
            <Stack direction="row" spacing={1} alignItems="center">
              <span>PyBatsim</span>
              <Chip
                label={pybatsimLogs.length}
                size="small"
                sx={{ height: 20, fontSize: "0.7rem" }}
              />
            </Stack>
          }
        />
      </Tabs>

      {/* Search Filter */}
      <Box sx={{ px: 2, py: 1, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <TextField
          size="small"
          placeholder="Filter logs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: "#9e9e9e", fontSize: 18 }} />
              </InputAdornment>
            ),
            sx: {
              bgcolor: "rgba(255,255,255,0.05)",
              "& input": { py: 0.75 },
            },
          }}
        />
      </Box>

      {/* Log Content */}
      <Box
        ref={logContainerRef}
        sx={{
          flex: 1,
          overflow: "auto",
          p: 2,
          fontFamily: "monospace",
          fontSize: "0.8rem",
          bgcolor: "#0d1117",
          "&::-webkit-scrollbar": {
            width: 8,
          },
          "&::-webkit-scrollbar-track": {
            bgcolor: "rgba(255,255,255,0.05)",
          },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: "rgba(255,255,255,0.2)",
            borderRadius: 4,
          },
        }}
      >
        {filteredLogs.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontFamily: "monospace" }}
          >
            {filter ? "No logs match the filter." : "No logs available yet."}
          </Typography>
        ) : (
          filteredLogs.map((line, index) => (
            <Box
              key={index}
              sx={{
                py: 0.25,
                color: getLogLineColor(line),
                wordBreak: "break-all",
                "&:hover": {
                  bgcolor: "rgba(255,255,255,0.05)",
                },
              }}
            >
              <Typography
                component="span"
                sx={{
                  color: "#6e7681",
                  mr: 2,
                  userSelect: "none",
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                }}
              >
                {(index + 1).toString().padStart(4, " ")}
              </Typography>
              {line}
            </Box>
          ))
        )}
      </Box>
    </Paper>
  );
};

export default LiveLogViewer;
