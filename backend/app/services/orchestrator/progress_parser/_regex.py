"""Compiled regex patterns and line parser for batsim_stdout events.

Patterns derived from real batsim_stdout in experiments/14/batsim.log.
All three patterns match lines from the [server/INFO] log namespace,
which is present in every BatSim run since v3+.

Task 7.5 — Live Progress Tracking
"""

import re
from ._state import ProgressState

# ---------------------------------------------------------------------------
# Compiled patterns (anchored to full line for precision)
# ---------------------------------------------------------------------------

RE_SUBMITTED = re.compile(
    r'^\[master_host:server:\(\d+\)\s+(?P<sim_time>\d+\.\d+)\]\s+'
    r'\[server/INFO\]\s+Job\s+\S+\s+SUBMITTED\.\s+(?P<count>\d+)\s+jobs\s+submitted\s+so\s+far\s*$'
)

RE_COMPLETED = re.compile(
    r'^\[master_host:server:\(\d+\)\s+(?P<sim_time>\d+\.\d+)\]\s+'
    r'\[server/INFO\]\s+Job\s+\S+\s+has\s+COMPLETED\.\s+(?P<count>\d+)\s+jobs\s+completed\s+so\s+far\s*$'
)

RE_SIM_END = re.compile(
    r'^\[master_host:server:\(\d+\)\s+(?P<sim_time>\d+\.\d+)\]\s+'
    r'\[server/INFO\]\s+The\s+simulation\s+seems\s+finished\.'
)

# TODO (v2): parse KILLED/WALLTIME_REACHED from network JSON line
# RE_KILLED = re.compile(r'\[network/INFO\] Sending .*"type":"JOB_COMPLETED".*"job_state":"COMPLETED_(KILLED|WALLTIME_REACHED|FAILED)"')


def parse_line(line: str, state: ProgressState) -> bool:
    """Match one log line against known patterns; mutate state. Returns True on match.

    Uses count guards (cnt > state.X) so replaying identical lines is idempotent.
    """
    m = RE_SUBMITTED.match(line)
    if m:
        cnt = int(m.group("count"))
        if cnt > state.submitted:
            state.submitted = cnt
            state.last_sim_time = max(state.last_sim_time, float(m.group("sim_time")))
            state.dirty = True
            return True

    m = RE_COMPLETED.match(line)
    if m:
        cnt = int(m.group("count"))
        if cnt > state.completed:
            state.completed = cnt
            state.last_sim_time = max(state.last_sim_time, float(m.group("sim_time")))
            state.dirty = True
            state.maybe_record_history()
            return True

    m = RE_SIM_END.match(line)
    if m:
        state.last_sim_time = max(state.last_sim_time, float(m.group("sim_time")))
        state.dirty = True
        return True

    return False
