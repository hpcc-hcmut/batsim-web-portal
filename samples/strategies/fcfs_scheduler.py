#!/usr/bin/env python3
"""
First-Come-First-Serve (FCFS) Scheduler for Batsim
A simple scheduler that processes jobs in the order they arrive.
"""

import pybatsim.batsim.batsim as batsim
import pybatsim.batsim.jobs as jobs
import pybatsim.batsim.profiles as profiles
import pybatsim.batsim.resources as resources


class FCFSScheduler:
    def __init__(self, scheduler: batsim.BatsimScheduler):
        self.scheduler = scheduler
        self.pending_jobs = []
        self.running_jobs = []

    def onSimulationBegins(self):
        """Called when simulation starts"""
        print("FCFS Scheduler: Simulation begins")

    def onJobSubmission(self, job: jobs.Job):
        """Called when a job is submitted"""
        print(f"FCFS Scheduler: Job {job.id} submitted")
        self.pending_jobs.append(job)
        self._try_schedule_jobs()

    def onJobCompletion(self, job: jobs.Job):
        """Called when a job completes"""
        print(f"FCFS Scheduler: Job {job.id} completed")
        if job in self.running_jobs:
            self.running_jobs.remove(job)
        self._try_schedule_jobs()

    def onJobKilled(self, job: jobs.Job):
        """Called when a job is killed"""
        print(f"FCFS Scheduler: Job {job.id} killed")
        if job in self.running_jobs:
            self.running_jobs.remove(job)
        if job in self.pending_jobs:
            self.pending_jobs.remove(job)
        self._try_schedule_jobs()

    def _try_schedule_jobs(self):
        """Try to schedule pending jobs"""
        available_resources = self.scheduler.get_available_resources()

        # Process jobs in FCFS order
        jobs_to_remove = []
        for job in self.pending_jobs:
            if self._can_schedule_job(job, available_resources):
                self._schedule_job(job)
                jobs_to_remove.append(job)
                # Update available resources
                available_resources = self.scheduler.get_available_resources()

        # Remove scheduled jobs from pending list
        for job in jobs_to_remove:
            self.pending_jobs.remove(job)

    def _can_schedule_job(self, job: jobs.Job, available_resources):
        """Check if a job can be scheduled"""
        return len(available_resources) >= job.requested_resources

    def _schedule_job(self, job: jobs.Job):
        """Schedule a job on available resources"""
        available_resources = self.scheduler.get_available_resources()
        selected_resources = available_resources[: job.requested_resources]

        print(
            f"FCFS Scheduler: Scheduling job {job.id} on resources {selected_resources}"
        )
        self.scheduler.execute_job(job, selected_resources)
        self.running_jobs.append(job)


def main():
    """Main entry point for the FCFS scheduler"""
    scheduler = batsim.BatsimScheduler()
    fcfs = FCFSScheduler(scheduler)

    # Register event handlers
    scheduler.onSimulationBegins = fcfs.onSimulationBegins
    scheduler.onJobSubmission = fcfs.onJobSubmission
    scheduler.onJobCompletion = fcfs.onJobCompletion
    scheduler.onJobKilled = fcfs.onJobKilled

    # Start the scheduler
    scheduler.start()


if __name__ == "__main__":
    main()
