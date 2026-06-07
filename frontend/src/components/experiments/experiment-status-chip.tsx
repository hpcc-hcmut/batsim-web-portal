/**
 * Status chip for experiments, shared by list / card / detail dialog so the
 * status palette lives in ONE place (was duplicated in ExperimentsPage and
 * experiment-detail-dialog).
 *
 * running  -> pulsing dot + soft glow (clear "alive" signal at a glance)
 * queued   -> static dot (waiting, not active)
 * Respects prefers-reduced-motion: animation disabled, dot stays static.
 */
import React from "react";
import { Box, Chip, ChipProps } from "@mui/material";

export function getStatusColor(status: string): ChipProps["color"] {
  switch (status) {
    case "completed": return "success";
    case "running": return "warning";
    case "failed": return "error";
    case "cancelled": return "default";
    case "queued": return "info";
    case "pending": return "secondary";
    default: return "default";
  }
}

const DOT_COLOR: Record<string, string> = {
  running: "#fbbf24", // amber, matches warning chip
  queued: "#60a5fa",  // blue, matches info chip
};

const StatusDot: React.FC<{ status: string }> = ({ status }) => (
  <Box
    component="span"
    sx={{
      width: 8,
      height: 8,
      borderRadius: "50%",
      bgcolor: DOT_COLOR[status],
      display: "inline-block",
      ...(status === "running" && {
        animation: "statusPulse 1.2s ease-in-out infinite",
        "@keyframes statusPulse": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.3 },
        },
        "@media (prefers-reduced-motion: reduce)": {
          animation: "none",
        },
      }),
    }}
  />
);

interface Props extends Pick<ChipProps, "size" | "sx"> {
  status: string;
}

export const ExperimentStatusChip: React.FC<Props> = ({ status, size = "small", sx }) => (
  <Chip
    label={status}
    color={getStatusColor(status)}
    size={size}
    icon={DOT_COLOR[status] ? <StatusDot status={status} /> : undefined}
    sx={{
      // icon slot adds its own margin; keep the dot visually centered
      "& .MuiChip-icon": { ml: 0.75, mr: -0.25 },
      ...(status === "running" && {
        boxShadow: "0 0 8px 0 rgba(251,191,36,0.35)",
      }),
      ...sx,
    }}
  />
);
