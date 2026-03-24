"""
FCFS (First-Come-First-Served) scheduler template for PyBatsim.

This scheduler assigns resources to jobs in arrival order.
Compatible with PyBatsim 3.x (tanaxer/pybatsim Docker image).

Usage with PyBatsim CLI:
    pybatsim /path/to/this_file.py -s "tcp://*:28000"

Note: The class name must match the CamelCase of the filename
for PyBatsim CLI auto-discovery. E.g., 'strategy_template.py' -> 'Strategy_template'.
"""

from batsim.batsim import BatsimScheduler


class Strategy_template(BatsimScheduler):
    """Simple FCFS scheduler that allocates first-available resources."""

    def onSimulationBegins(self):
        """Called when BatSim simulation starts."""
        self.nb_completed = 0
        self.jobs_waiting = []

    def onJobSubmission(self, job):
        """Called when a new job is submitted. Schedule it if resources available."""
        self.jobs_waiting.append(job)
        self._schedule_pending()

    def onJobCompletion(self, job):
        """Called when a job finishes execution."""
        self.nb_completed += 1

    def _schedule_pending(self):
        """Try to schedule all waiting jobs in FCFS order."""
        still_waiting = []
        for job in self.jobs_waiting:
            free = self.bs.resources_free
            if job.requested_resources <= len(free):
                allocated = free[:job.requested_resources]
                job.schedule(allocated)
            else:
                still_waiting.append(job)
        self.jobs_waiting = still_waiting
