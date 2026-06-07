"""
Strategy template for the BatSim Web Portal (PyBatsim 3.x).

This is a complete, runnable FCFS (First-Come-First-Served) scheduler.
Use it as a starting skeleton: keep the structure, replace the decision
logic with your own algorithm.

HOW TO USE (3 steps):
  1. Rename the file and the class together. The class name must be the
     CamelCase of the file name, e.g. 'my_easy.py' -> class 'My_easy'.
  2. Edit the parts marked with  # === CUSTOMIZE HERE ===
  3. Upload the file on the Strategies page. The validator checks that
     the class inherits BatsimScheduler and that imports are allowed
     (standard library + scientific packages preinstalled in the image).

USEFUL CALLBACKS (add them to the class if you need them):
  onSimulationEnds(self)            -> called once when simulation ends
  onJobsKilled(self, jobs)          -> jobs killed (e.g. walltime reached)
  onRequestedCall(self)             -> timer set via self.bs.wake_me_up_at(t)

KEY API (PyBatsim 3.x, as used by every working strategy here):
  self.bs.nb_resources              -> total number of hosts
  self.bs.execute_job(job)          -> start a job (set job.allocation first)
  ProcSet                           -> resource-id set bookkeeping
  NOTE: track free resources YOURSELF (see self.available below);
        there is no self.bs.resources_free in this PyBatsim version.
"""

from batsim.batsim import BatsimScheduler
from procset import ProcSet


class Strategy_template(BatsimScheduler):
    """Simple FCFS scheduler that allocates the lowest free resource ids."""

    def __init__(self, options):
        super().__init__(options)
        self.queue = []
        self.available = None
        self.nb_completed = 0

    def onSimulationBegins(self):
        """Called when BatSim simulation starts. Initialize your state here."""
        self.available = ProcSet(*range(self.bs.nb_resources))
        # === CUSTOMIZE HERE: add your own bookkeeping (priorities, counters...) ===

    def onJobSubmission(self, job):
        """Called when a new job is submitted. Schedule it if resources available."""
        self.queue.append(job)
        self._schedule_pending()

    def onJobCompletion(self, job):
        """Called when a job finishes. Return its resources to the free pool."""
        self.nb_completed += 1
        if job.allocation is not None:
            self.available = self.available | job.allocation
        # A finished job may free room for waiting jobs: try again.
        self._schedule_pending()

    def _schedule_pending(self):
        """Try to start waiting jobs.

        === CUSTOMIZE HERE: this method IS your scheduling algorithm. ===
        FCFS logic below: walk the queue in arrival order, start a job when
        enough resources are free. Replace the loop to implement backfilling,
        priority ordering, reservations, etc.
        """
        still_waiting = []
        for job in self.queue:
            needed = job.requested_resources
            if needed <= len(self.available):
                # Take the first `needed` free resource ids (ProcSet iterates ascending)
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
            else:
                still_waiting.append(job)
        self.queue = still_waiting
