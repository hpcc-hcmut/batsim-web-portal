#!/bin/bash
# BatSim Docker Verification Script
# Run from batsim-web-portal/ directory
# Prerequisite: Docker Desktop running

set -e

echo "=== BatSim Docker Verification ==="
echo ""

# Step 1: Pull images
echo "[1/6] Pulling Docker images..."
docker pull oarteam/batsim:latest || echo "WARN: oarteam/batsim:latest not found, trying alternatives..."
docker pull oarteam/pybatsim:latest || echo "WARN: oarteam/pybatsim:latest not found"

# Check if images exist
if ! docker image inspect oarteam/batsim:latest &>/dev/null; then
    echo "ERROR: BatSim image not available. Try:"
    echo "  docker pull oarteam/batsim:4.0.0"
    echo "  docker pull ghcr.io/oar-team/batsim"
    exit 1
fi

# Step 2: Create network
echo "[2/6] Creating Docker network..."
docker network create batsim-verify 2>/dev/null || true

# Step 3: Create output directory
echo "[3/6] Creating output directory..."
mkdir -p ./output-verify

# Step 4: Check PyBatsim version
echo "[4/6] Checking PyBatsim version..."
docker run --rm oarteam/pybatsim:latest pip show pybatsim 2>/dev/null || echo "WARN: Could not check pybatsim version"

# Step 5: Run BatSim (background)
echo "[5/6] Starting BatSim..."
docker run --rm --name batsim-verify \
    --network batsim-verify \
    -v "$(pwd)/samples/workloads:/input/workloads:ro" \
    -v "$(pwd)/samples/platforms:/input/platforms:ro" \
    -v "$(pwd)/output-verify:/output" \
    oarteam/batsim:latest \
    batsim \
    -p /input/platforms/cluster288-HCMUT-SuperNodeXP.xml \
    -w /input/workloads/HCMUT-SuperNodeXP-2017.json \
    -e /output/out \
    --socket-endpoint "tcp://*:28000" &

BATSIM_PID=$!
sleep 3

# Step 6: Run PyBatsim
echo "[6/6] Starting PyBatsim with FCFS scheduler..."
docker run --rm --name pybatsim-verify \
    --network batsim-verify \
    -v "$(pwd)/samples/strategies:/input/strategies:ro" \
    oarteam/pybatsim:latest \
    pybatsim /input/strategies/fcfs_scheduler.py \
    --socket-endpoint "tcp://batsim-verify:28000" &

PYBATSIM_PID=$!

# Wait for completion (timeout 120s)
echo ""
echo "Waiting for simulation to complete (timeout: 120s)..."
timeout 120 wait $BATSIM_PID 2>/dev/null || true
timeout 10 wait $PYBATSIM_PID 2>/dev/null || true

# Check results
echo ""
echo "=== Results ==="
if [ -f "./output-verify/out_jobs.csv" ]; then
    echo "SUCCESS: out_jobs.csv found!"
    echo "First 5 lines:"
    head -5 ./output-verify/out_jobs.csv
    echo ""
    TOTAL_JOBS=$(wc -l < ./output-verify/out_jobs.csv)
    echo "Total lines: $TOTAL_JOBS"
else
    echo "FAIL: out_jobs.csv NOT found"
fi

if [ -f "./output-verify/out_schedule.csv" ]; then
    echo "SUCCESS: out_schedule.csv found!"
else
    echo "FAIL: out_schedule.csv NOT found"
fi

# Cleanup
echo ""
echo "=== Cleanup ==="
docker stop batsim-verify 2>/dev/null || true
docker stop pybatsim-verify 2>/dev/null || true
docker network rm batsim-verify 2>/dev/null || true

echo ""
echo "Output kept in ./output-verify/ for inspection."
echo "Run 'rm -rf ./output-verify/' to clean up."
echo ""
echo "=== Verification Complete ==="
