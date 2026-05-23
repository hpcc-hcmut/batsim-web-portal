/**
 * Compact sort dropdown for list pages.
 *
 * Options are encoded as `<sort_by>:<order>` (e.g. "created_at:desc"); the
 * parent owns the URL state via useListQueryParams.
 */
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { Sort as SortIcon } from "@mui/icons-material";

export interface SortOption {
  value: string;
  label: string;
}

interface Props {
  options: SortOption[];
  value: string;
  onChange: (sort: string, order: "asc" | "desc") => void;
}

export function SortMenu({ options, value, onChange }: Props) {
  return (
    <FormControl size="small" sx={{ minWidth: 220 }}>
      <InputLabel id="sort-menu-label">Sort by</InputLabel>
      <Select
        labelId="sort-menu-label"
        value={value}
        label="Sort by"
        onChange={(e) => {
          const v = e.target.value as string;
          const [sort, order] = v.split(":");
          onChange(sort, (order as "asc" | "desc") || "desc");
        }}
        startAdornment={<SortIcon fontSize="small" sx={{ mr: 1, opacity: 0.7 }} />}
      >
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
