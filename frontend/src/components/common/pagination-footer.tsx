/**
 * Page-button pagination + "Showing X of Y" label + page-size switch.
 *
 * Driven by the X-Total-Count header from the backend list endpoints.
 */
import {
  MenuItem,
  Pagination,
  Select,
  Stack,
  Typography,
} from "@mui/material";

const SIZE_OPTIONS = [10, 20, 50, 100];

interface Props {
  page: number;
  size: number;
  total: number;
  onPageChange: (page: number) => void;
  onSizeChange?: (size: number) => void;
}

export function PaginationFooter({
  page,
  size,
  total,
  onPageChange,
  onSizeChange,
}: Props) {
  const pageCount = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      alignItems="center"
      justifyContent="space-between"
      spacing={1}
      sx={{ mt: 3 }}
    >
      <Typography variant="body2" color="text.secondary">
        {total === 0 ? "No items" : `Showing ${from}–${to} of ${total}`}
      </Typography>
      <Pagination
        count={pageCount}
        page={Math.min(page, pageCount)}
        onChange={(_, p) => onPageChange(p)}
        size="small"
        showFirstButton
        showLastButton
      />
      {onSizeChange && (
        <Select
          size="small"
          value={size}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          sx={{ minWidth: 110 }}
        >
          {SIZE_OPTIONS.map((n) => (
            <MenuItem key={n} value={n}>
              {n} / page
            </MenuItem>
          ))}
        </Select>
      )}
    </Stack>
  );
}
