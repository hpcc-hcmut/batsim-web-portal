"""
First-Come-First-Serve (FCFS) Scheduler for PyBatsim.

PyBatsim CLI discovery: file 'fcfs_scheduler.py' -> looks for class 'FcfsScheduler'.
Processes jobs strictly in arrival order — if the head-of-line job cannot fit,
no subsequent jobs are scheduled (strict FCFS, no backfilling).
"""

from batsim.batsim import BatsimScheduler
from procset import ProcSet


class FcfsScheduler(BatsimScheduler):
    """Strict FCFS scheduler — no backfilling."""

    def __init__(self, options):
        super().__init__(options)
        self.queue = []
        self.available = None

    def onSimulationBegins(self):
        self.available = ProcSet(*range(self.bs.nb_resources))
        print(f"[FCFS] Simulation begins — {self.bs.nb_resources} resources")

    def onJobSubmission(self, job):
        self.queue.append(job)
        self._schedule()

    def onJobCompletion(self, job):
        if job.allocation is not None:
            self.available = self.available | job.allocation
        self._schedule()

    def _schedule(self):
        """Strict FCFS: only schedule head-of-queue if resources available."""
        while self.queue:
            job = self.queue[0]
            needed = job.requested_resources
            if needed > len(self.available):
                break  # Head blocked → stop (strict FCFS, no backfill)
            # Allocate first N available resources
            allocated = ProcSet()
            count = 0
            for r in self.available:
                allocated = allocated | ProcSet(r)
                count += 1
                if count >= needed:
                    break
            self.available = self.available - allocated
            job.allocation = allocated
            self.bs.execute_job(job)
            self.queue.pop(0)
            print(f"[FCFS] Job {job.id} -> resources {allocated}")

    def onSimulationEnds(self):
        print(f"[FCFS] Simulation ended — {len(self.queue)} pending")
