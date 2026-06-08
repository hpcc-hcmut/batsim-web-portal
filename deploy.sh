#!/usr/bin/env bash
# One-shot VM deploy: bring the whole stack up from a fresh clone.
# Usage: ./deploy.sh   (run from anywhere; it cd's to the repo root itself)
set -euo pipefail

cd "$(dirname "$0")"                                   # M2: always run from repo root

# B1: a fresh clone has no backend/.env — seed it from the VM template.
if [ ! -f backend/.env ]; then
  cp backend/.env.vm.example backend/.env
  echo "Created backend/.env from .env.vm.example — EDIT IT before going live."
fi
if grep -q CHANGE_ME backend/.env; then
  echo "WARN: backend/.env still has CHANGE_ME placeholders (SECRET_KEY, etc.). Edit then re-run."
fi

# B3: build the extended PyBatsim image (numpy/scipy/pandas for ML strategies).
docker build -t batsim-portal/pybatsim-extended:1.0 docker/pybatsim-extended/

docker compose up -d --build

# Wait for the backend healthcheck endpoint (bounded ~2 min).
echo "Waiting for backend..."
for _ in $(seq 1 60); do
  if curl -sf http://localhost:8000/health >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done
[ "${ok:-}" = 1 ] || { echo "ERROR: backend not healthy after ~2 min — check 'docker compose logs backend'"; exit 1; }

# Seed lab + demo accounts (idempotent: re-runs SKIP existing users).
python3 scripts/seed-vm-users.py --base http://localhost:8000 || true

echo "OK — portal at http://<VM_IP>:5173 (Grafana http://<VM_IP>:3000)"
echo "Next: load sample data with scripts/setup-demo-data.py if needed."
