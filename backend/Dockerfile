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

# uvicorn quirk: --reload-dir is silently ignored when the given path is
# inside CWD (see uvicorn/supervisors/watchfilesreload.py:30 - "if Path.cwd()
# not in directory.parents"). So we cannot whitelist /app/app while CWD=/app.
# Instead use --reload-exclude pointing at the storage directory: uvicorn's
# FileFilter checks Path.is_dir() on each exclude value, and matching paths
# go into exclude_dirs which is checked via "exclude_dir in path.parents".
# This correctly suppresses reloads for any *.py file under storage/.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-exclude", "/app/storage"]
