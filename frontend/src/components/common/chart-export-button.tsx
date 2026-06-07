/**
 * Small overlay button that downloads the host chart as PNG.
 * Absolutely positioned - parent Paper/Box must have position: relative.
 */
import React from "react";
import { IconButton, Tooltip } from "@mui/material";
import { Download } from "@mui/icons-material";

interface Props {
  onExport: () => void;
  title?: string;
  /** Offset tweaks when the corner is occupied (e.g. chart legend) */
  top?: number;
  right?: number;
}

export const ChartExportButton: React.FC<Props> = ({
  onExport,
  title = "Download as PNG",
  top = 2,
  right = 2,
}) => (
  <Tooltip title={title}>
    <IconButton
      size="small"
      onClick={onExport}
      sx={{
        position: "absolute",
        top,
        right,
        zIndex: 2,
        color: "text.secondary",
        "&:hover": { color: "text.primary" },
      }}
    >
      <Download sx={{ fontSize: 16 }} />
    </IconButton>
  </Tooltip>
);

export default ChartExportButton;
