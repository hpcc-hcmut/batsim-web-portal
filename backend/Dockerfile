FROM python:3.10-slim

WORKDIR /app

# Install system deps for Docker SDK
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create storage directories
RUN mkdir -p storage/workloads storage/platforms storage/strategies storage/experiments storage/results

EXPOSE 8000

# --reload-exclude prevents file writes under storage/ (workload uploads,
# experiment logs, simulation outputs) from triggering uvicorn restarts
# mid-simulation, which would orphan running pybatsim/batsim containers.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-exclude", "storage/*", "--reload-exclude", "*.db", "--reload-exclude", "*.db-journal"]
