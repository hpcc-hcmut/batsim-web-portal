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

# --reload-dir app: whitelist only the Python source tree. By default uvicorn
# watches the working dir recursively, which includes storage/ and batsim.db.
# Writes to those during a simulation run would trigger reloads that orphan
# running pybatsim/batsim containers and mark in-flight experiments FAILED.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/app/app"]
