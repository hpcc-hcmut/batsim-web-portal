/**
 * Sort dropdown options per entity. Common-only (Recently added / Oldest first /
 * Name A↔Z) — entity-specific options deferred for later iteration.
 *
 * Value format: `<sort_by>:<order>` matching backend whitelist.
 */
import type { SortOption } from "../components/common/sort-menu";

export const COMMON_SORTS: SortOption[] = [
  { value: "created_at:desc", label: "Recently added" },
  { value: "created_at:asc", label: "Oldest first" },
  { value: "name:asc", label: "Name A → Z" },
  { value: "name:desc", label: "Name Z → A" },
];

// Result has no `name` field — drop name sorts.
export const RESULT_SORTS: SortOption[] = [
  { value: "created_at:desc", label: "Recently added" },
  { value: "created_at:asc", label: "Oldest first" },
];

export const WORKLOAD_SORTS = COMMON_SORTS;
export const PLATFORM_SORTS = COMMON_SORTS;
export const STRATEGY_SORTS = COMMON_SORTS;
export const SCENARIO_SORTS = COMMON_SORTS;
export const EXPERIMENT_SORTS = COMMON_SORTS;
