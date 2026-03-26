from batsim.batsim import BatsimScheduler


class FcfsScheduler(BatsimScheduler):
    def onJobSubmission(self, job):
        self.bs.execute(job.id, job.requested_resources)


if __name__ == "__main__":
    pass
