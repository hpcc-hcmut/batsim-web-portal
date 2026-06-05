/** Cards/List view switcher — sits next to SortMenu on list pages. */
import React from "react";
import { ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import { GridView, ViewList } from "@mui/icons-material";
import type { ViewMode } from "../../utils/use-view-mode";

interface Props {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export const ViewToggle: React.FC<Props> = ({ value, onChange }) => (
  <ToggleButtonGroup
    size="small"
    exclusive
    value={value}
    onChange={(_, m: ViewMode | null) => { if (m) onChange(m); }}
    aria-label="View mode"
  >
    <ToggleButton value="cards" aria-label="Cards view">
      <Tooltip title="Cards view"><GridView fontSize="small" /></Tooltip>
    </ToggleButton>
    <ToggleButton value="list" aria-label="List view">
      <Tooltip title="List view"><ViewList fontSize="small" /></Tooltip>
    </ToggleButton>
  </ToggleButtonGroup>
);
