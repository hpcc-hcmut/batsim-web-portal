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

USEFUL STATE (available on self.bs):
  self.bs.resources_free            -> list of free resource ids
  self.bs.nb_resources              -> total number of resources
  self.bs.time()                    -> current simulation time
"""

from batsim.batsim import BatsimScheduler


class Strategy_template(BatsimScheduler):
    """FCFS skeleton: allocate first available resources, in arrival order."""

    def onSimulationBegins(self):
        """Called once when BatSim starts. Initialize your state here."""
        self.nb_completed = 0
        self.jobs_waiting = []
        # === CUSTOMIZE HERE: add your own bookkeeping (queues, counters...) ===

    def onJobSubmission(self, job):
        """Called when a new job arrives. Decide to schedule now or queue it."""
        self.jobs_waiting.append(job)
        self._schedule_pending()

    def onJobCompletion(self, job):
        """Called when a job finishes. Free resources are updated automatically."""
        self.nb_completed += 1
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
        for job in self.jobs_waiting:
            free = self.bs.resources_free
            if job.requested_resources <= len(free):
                allocated = free[: job.requested_resources]
                job.schedule(allocated)
            else:
                still_waiting.append(job)
        self.jobs_waiting = still_waiting
