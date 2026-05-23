/**
 * URL-driven sort + pagination state for entity list pages.
 *
 * State lives in the URL query string so refresh, deep-link and browser back
 * all preserve the user's current view. Non-default values are stripped so the
 * default URL stays clean.
 */
import { useSearchParams } from "react-router-dom";

export interface ListQueryState {
  sort: string;
  order: "asc" | "desc";
  page: number;
  size: number;
}

const DEFAULTS: ListQueryState = {
  sort: "created_at",
  order: "desc",
  page: 1,
  size: 20,
};

export function useListQueryParams(overrides: Partial<ListQueryState> = {}) {
  const [params, setParams] = useSearchParams();
  const d = { ...DEFAULTS, ...overrides };

  const sort = params.get("sort") ?? d.sort;
  const orderRaw = params.get("order");
  const order: "asc" | "desc" = orderRaw === "asc" ? "asc" : d.order;
  const page = Math.max(1, Number(params.get("page") ?? d.page));
  const size = Math.max(1, Number(params.get("size") ?? d.size));
  const skip = (page - 1) * size;

  const update = (patch: Partial<ListQueryState>) => {
    const next = new URLSearchParams(params);
    const merged = { sort, order, page, size, ...patch };
    for (const k of ["sort", "order", "page", "size"] as const) {
      const v = merged[k];
      if (v == null || v === d[k]) {
        next.delete(k);
      } else {
        next.set(k, String(v));
      }
    }
    setParams(next);
  };

  return { sort, order, page, size, skip, update };
}
