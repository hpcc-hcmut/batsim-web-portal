"""
Filler scheduler for PyBatsim CLI.

PyBatsim CLI discovery: file 'filler.py' -> looks for class 'Filler'.
Uses the low-level BatsimScheduler API with ProcSet for resource allocation.
Assigns jobs to first-available resources in submission order (FCFS filler).
"""

from batsim.batsim import BatsimScheduler
from procset import ProcSet


class Filler(BatsimScheduler):
    """Simple filler/FCFS scheduler using low-level PyBatsim API."""

    def __init__(self, options):
        super().__init__(options)
        self.waiting_jobs = []
        self.available = None

    def onSimulationBegins(self):
        self.available = ProcSet(*range(self.bs.nb_resources))
        print(f"[Filler] Simulation begins — {self.bs.nb_resources} resources")

    def onJobSubmission(self, job):
        self.waiting_jobs.append(job)
        self._schedule()

    def onJobCompletion(self, job):
        # Free resources — job.allocation is a ProcSet set by execute_job
        if job.allocation is not None:
            self.available = self.available | job.allocation
        self._schedule()

    def _schedule(self):
        """Assign waiting jobs to available resources (FCFS order)."""
        remaining = []
        for job in self.waiting_jobs:
            needed = job.requested_resources
            if needed <= len(self.available):
                # Take first N available resources
                allocated = ProcSet()
                count = 0
                for r in self.available:
                    allocated = allocated | ProcSet(r)
                    count += 1
                    if count >= needed:
                        break
                # Remove allocated from available
                self.available = self.available - allocated
                # Set allocation and execute
                job.allocation = allocated
                self.bs.execute_job(job)
                print(f"[Filler] Job {job.id} -> resources {allocated}")
            else:
                remaining.append(job)
        self.waiting_jobs = remaining

    def onSimulationEnds(self):
        print(f"[Filler] Simulation ended — {len(self.waiting_jobs)} pending")
