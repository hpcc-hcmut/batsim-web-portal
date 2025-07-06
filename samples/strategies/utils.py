#!/usr/bin/env python3
"""
Utility functions for Batsim schedulers
Common functions that can be used across different scheduling strategies.
"""

import math
from typing import List, Dict, Any


def calculate_job_priority(job, priority_type="fifo"):
    """
    Calculate job priority based on different criteria

    Args:
        job: The job object
        priority_type: Type of priority calculation ("fifo", "size", "duration")

    Returns:
        Priority value (lower is higher priority)
    """
    if priority_type == "fifo":
        return job.submission_time
    elif priority_type == "size":
        return job.requested_resources
    elif priority_type == "duration":
        return job.requested_time
    else:
        return job.submission_time


def find_best_resources(job, available_resources, strategy="first_fit"):
    """
    Find the best resources for a job based on different strategies

    Args:
        job: The job to schedule
        available_resources: List of available resource IDs
        strategy: Resource selection strategy ("first_fit", "best_fit", "worst_fit")

    Returns:
        List of selected resource IDs
    """
    if len(available_resources) < job.requested_resources:
        return []

    if strategy == "first_fit":
        return available_resources[: job.requested_resources]
    elif strategy == "best_fit":
        # For best fit, we'd need more complex logic based on resource characteristics
        return available_resources[: job.requested_resources]
    elif strategy == "worst_fit":
        # For worst fit, we'd need more complex logic based on resource characteristics
        return available_resources[: job.requested_resources]
    else:
        return available_resources[: job.requested_resources]


def estimate_job_duration(job):
    """
    Estimate job duration based on job characteristics

    Args:
        job: The job object

    Returns:
        Estimated duration in seconds
    """
    # Simple estimation based on requested time
    return job.requested_time


def calculate_resource_utilization(running_jobs, total_resources):
    """
    Calculate current resource utilization

    Args:
        running_jobs: List of currently running jobs
        total_resources: Total number of resources in the system

    Returns:
        Utilization percentage (0.0 to 1.0)
    """
    if total_resources == 0:
        return 0.0

    used_resources = sum(job.requested_resources for job in running_jobs)
    return used_resources / total_resources


def log_scheduling_event(event_type, job_id, resources=None, message=""):
    """
    Log scheduling events for debugging and analysis

    Args:
        event_type: Type of event ("job_submitted", "job_scheduled", "job_completed")
        job_id: ID of the job
        resources: Resources involved in the event
        message: Additional message
    """
    log_entry = {
        "event_type": event_type,
        "job_id": job_id,
        "resources": resources,
        "message": message,
        "timestamp": None,  # Would be set by the scheduler
    }
    print(f"SCHEDULER_LOG: {log_entry}")


class JobQueue:
    """
    A priority queue for managing pending jobs
    """

    def __init__(self, priority_type="fifo"):
        self.jobs = []
        self.priority_type = priority_type

    def add_job(self, job):
        """Add a job to the queue"""
        self.jobs.append(job)
        self._sort_jobs()

    def get_next_job(self):
        """Get the next job from the queue"""
        if self.jobs:
            return self.jobs.pop(0)
        return None

    def peek_next_job(self):
        """Peek at the next job without removing it"""
        if self.jobs:
            return self.jobs[0]
        return None

    def remove_job(self, job):
        """Remove a specific job from the queue"""
        if job in self.jobs:
            self.jobs.remove(job)

    def _sort_jobs(self):
        """Sort jobs based on priority"""
        self.jobs.sort(key=lambda j: calculate_job_priority(j, self.priority_type))

    def __len__(self):
        return len(self.jobs)

    def __iter__(self):
        return iter(self.jobs)
