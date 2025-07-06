#!/usr/bin/env python3
"""
Backfill Scheduler for Batsim
A scheduler that uses backfilling to improve resource utilization.
"""

import pybatsim.batsim.batsim as batsim
import pybatsim.batsim.jobs as jobs
import pybatsim.batsim.profiles as profiles
import pybatsim.batsim.resources as resources


class BackfillScheduler:
    def __init__(self, scheduler: batsim.BatsimScheduler):
        self.scheduler = scheduler
        self.pending_jobs = []
        self.running_jobs = []
        self.reserved_jobs = []  # Jobs that have reserved resources

    def onSimulationBegins(self):
        """Called when simulation starts"""
        print("Backfill Scheduler: Simulation begins")

    def onJobSubmission(self, job: jobs.Job):
        """Called when a job is submitted"""
        print(f"Backfill Scheduler: Job {job.id} submitted")
        self.pending_jobs.append(job)
        self._try_schedule_jobs()

    def onJobCompletion(self, job: jobs.Job):
        """Called when a job completes"""
        print(f"Backfill Scheduler: Job {job.id} completed")
        if job in self.running_jobs:
            self.running_jobs.remove(job)
        if job in self.reserved_jobs:
            self.reserved_jobs.remove(job)
        self._try_schedule_jobs()

    def onJobKilled(self, job: jobs.Job):
        """Called when a job is killed"""
        print(f"Backfill Scheduler: Job {job.id} killed")
        if job in self.running_jobs:
            self.running_jobs.remove(job)
        if job in self.reserved_jobs:
            self.reserved_jobs.remove(job)
        if job in self.pending_jobs:
            self.pending_jobs.remove(job)
        self._try_schedule_jobs()

    def _try_schedule_jobs(self):
        """Try to schedule pending jobs using backfilling"""
        available_resources = self.scheduler.get_available_resources()

        # First, try to schedule jobs that can fit immediately
        jobs_to_remove = []
        for job in self.pending_jobs:
            if self._can_schedule_job(job, available_resources):
                self._schedule_job(job)
                jobs_to_remove.append(job)
                available_resources = self.scheduler.get_available_resources()

        # Remove scheduled jobs from pending list
        for job in jobs_to_remove:
            self.pending_jobs.remove(job)

        # Try backfilling for remaining jobs
        self._try_backfill()

    def _try_backfill(self):
        """Attempt to backfill smaller jobs"""
        if not self.pending_jobs:
            return

        # Sort pending jobs by size (smallest first for backfilling)
        sorted_jobs = sorted(self.pending_jobs, key=lambda j: j.requested_resources)

        for job in sorted_jobs:
            if self._can_backfill_job(job):
                self._schedule_job(job)
                self.pending_jobs.remove(job)
                break

    def _can_schedule_job(self, job: jobs.Job, available_resources):
        """Check if a job can be scheduled immediately"""
        return len(available_resources) >= job.requested_resources

    def _can_backfill_job(self, job: jobs.Job):
        """Check if a job can be backfilled"""
        # Simple backfilling: check if job can fit in available resources
        available_resources = self.scheduler.get_available_resources()
        return len(available_resources) >= job.requested_resources

    def _schedule_job(self, job: jobs.Job):
        """Schedule a job on available resources"""
        available_resources = self.scheduler.get_available_resources()
        selected_resources = available_resources[: job.requested_resources]

        print(
            f"Backfill Scheduler: Scheduling job {job.id} on resources {selected_resources}"
        )
        self.scheduler.execute_job(job, selected_resources)
        self.running_jobs.append(job)


def main():
    """Main entry point for the Backfill scheduler"""
    scheduler = batsim.BatsimScheduler()
    backfill = BackfillScheduler(scheduler)

    # Register event handlers
    scheduler.onSimulationBegins = backfill.onSimulationBegins
    scheduler.onJobSubmission = backfill.onJobSubmission
    scheduler.onJobCompletion = backfill.onJobCompletion
    scheduler.onJobKilled = backfill.onJobKilled

    # Start the scheduler
    scheduler.start()


if __name__ == "__main__":
    main()
