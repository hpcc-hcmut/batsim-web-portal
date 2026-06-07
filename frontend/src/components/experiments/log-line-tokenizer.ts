/**
 * Pure tokenizer for simulation log lines. Splits one line into colored
 * segments so the viewer can tint timestamps / levels / events / job ids.
 *
 * Grounded in REAL log shapes (storage/experiments/78/batsim.stderr.log):
 *   [0.000000] [batsim/INFO] Workload 'w0' corresponds to ...
 *   [master_host:server:(2) 139.000000] [server/INFO] Job w0!39 has COMPLETED. ...
 *   [...] [network/INFO] Sending '{"type":"SIMULATION_BEGINS",...}'
 */

export interface LogSegment {
  text: string;
  color?: string;
  fontWeight?: number;
}

const COLOR_DIM = "#6b7280";       // timestamps, brackets, DEBUG
const COLOR_EVENT = "#a78bfa";     // BatSim protocol event names
const COLOR_JOBID = "#34d399";     // job ids like w0!39

const COLOR_LEVEL: Record<string, string> = {
  INFO: "#60a5fa",
  DEBUG: COLOR_DIM,
  WARNING: "#fbbf24",
  ERROR: "#f87171",
  CRITICAL: "#f87171",
};

// Leading context bracket: [sim_time] or [host:actor:(n) sim_time]
const RE_LEADING = /^\[[^\]]*\]/;
// SimGrid category/level bracket: [batsim/INFO], [network/WARNING]...
const RE_CATLEVEL = /\[([a-zA-Z_]+)\/(INFO|DEBUG|WARNING|ERROR|CRITICAL)\]/g;
// Protocol events + job states (longer alternatives FIRST so they win the match)
const RE_EVENT = new RegExp(
  "\\b(COMPLETED_SUCCESSFULLY|COMPLETED_WALLTIME_REACHED|COMPLETED_FAILED|COMPLETED_KILLED|" +
  "SIMULATION_BEGINS|SIMULATION_ENDS|JOB_SUBMITTED|JOB_COMPLETED|JOB_KILLED|" +
  "EXECUTE_JOB|REJECT_JOB|REGISTER_JOB|CALL_ME_LATER|REQUESTED_CALL|" +
  "SUBMITTED|COMPLETED|REJECTED)\\b",
  "g",
);
// BatSim job id: workload!job (e.g. w0!39, w0!job_12)
const RE_JOBID = /\bw\d+![\w.-]+/g;

interface RawMatch {
  start: number;
  end: number;
  segs: LogSegment[];
}

/**
 * Tokenize a line into segments. Returns null when nothing matched
 * (caller renders the plain line — zero overhead for non-matching text).
 */
export function tokenizeLine(line: string): LogSegment[] | null {
  const matches: RawMatch[] = [];

  const lead = RE_LEADING.exec(line);
  if (lead) {
    matches.push({
      start: 0,
      end: lead[0].length,
      segs: [{ text: lead[0], color: COLOR_DIM }],
    });
  }

  for (const m of line.matchAll(RE_CATLEVEL)) {
    matches.push({
      start: m.index!,
      end: m.index! + m[0].length,
      segs: [
        { text: `[${m[1]}/`, color: COLOR_DIM },
        { text: m[2], color: COLOR_LEVEL[m[2]], fontWeight: 600 },
        { text: "]", color: COLOR_DIM },
      ],
    });
  }

  for (const m of line.matchAll(RE_EVENT)) {
    matches.push({
      start: m.index!,
      end: m.index! + m[0].length,
      segs: [{ text: m[0], color: COLOR_EVENT, fontWeight: 600 }],
    });
  }

  for (const m of line.matchAll(RE_JOBID)) {
    matches.push({
      start: m.index!,
      end: m.index! + m[0].length,
      segs: [{ text: m[0], color: COLOR_JOBID }],
    });
  }

  if (matches.length === 0) return null;

  // Earliest-first; on tie the longer match wins. Overlaps are dropped.
  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  const out: LogSegment[] = [];
  let pos = 0;
  for (const m of matches) {
    if (m.start < pos) continue;
    if (m.start > pos) out.push({ text: line.slice(pos, m.start) });
    out.push(...m.segs);
    pos = m.end;
  }
  if (pos < line.length) out.push({ text: line.slice(pos) });
  return out;
}
