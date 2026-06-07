/**
 * Join two timelines' jobs by job_id for the per-job A-vs-B scatter.
 * Frozen inputs guarantee both runs executed the SAME job set, which is what
 * makes this comparison valid in the first place.
 */
import { TimelineJob } from "../../services/api";

export type ScatterMetric = "waiting_time" | "slowdown" | "turnaround_time";

export const SCATTER_METRIC_LABELS: Record<ScatterMetric, string> = {
  waiting_time: "Waiting time (s)",
  slowdown: "Slowdown",
  turnaround_time: "Turnaround time (s)",
};

export interface JoinedPoint {
  jobId: string;
  a: number;
  b: number;
  requestedResources: number;
}

export interface JoinResult {
  points: JoinedPoint[];
  /** jobs present in only one run or missing the metric (failed jobs etc.) */
  skipped: number;
  bBetter: number;
  aBetter: number;
  equal: number;
}

export function joinJobsByMetric(
  jobsA: TimelineJob[],
  jobsB: TimelineJob[],
  metric: ScatterMetric,
): JoinResult {
  const byIdB = new Map(jobsB.map((j) => [j.job_id, j]));
  const points: JoinedPoint[] = [];
  let skipped = 0;
  let bBetter = 0;
  let aBetter = 0;
  let equal = 0;

  for (const ja of jobsA) {
    const jb = byIdB.get(ja.job_id);
    const va = ja[metric];
    const vb = jb?.[metric];
    if (jb == null || va == null || vb == null) {
      skipped += 1;
      continue;
    }
    points.push({ jobId: ja.job_id, a: va, b: vb, requestedResources: ja.requested_resources });
    // Lower is better for all three supported metrics
    if (vb < va) bBetter += 1;
    else if (vb > va) aBetter += 1;
    else equal += 1;
  }
  // Jobs only present in B (shouldn't happen with frozen workloads, but count honestly)
  const idsA = new Set(jobsA.map((j) => j.job_id));
  skipped += jobsB.filter((j) => !idsA.has(j.job_id)).length;

  return { points, skipped, bBetter, aBetter, equal };
}
