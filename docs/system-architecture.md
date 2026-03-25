# System Architecture

## Overview

BatSim Web Portal is a modern web application for managing and executing BatSim simulations. It follows a client-server architecture with a React/TypeScript frontend and FastAPI backend, using SQLite for data persistence and Docker containers for isolated experiment execution.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React + TypeScript)               │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Pages: Workloads | Platforms | Scenarios | Strategies      │ │
│ │        Experiments | Results | Analytics | Dashboard        │ │
│ └─────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                      (REST API / HTTP)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                  Backend (FastAPI)                              │
│ ┌──────────────────────────────────────────────────────────────┤
│ │ API Routes (Auth, Workloads, Platforms, Experiments, etc.)  │
│ ├──────────────────────────────────────────────────────────────┤
│ │ Services: Bundle, Queue, Orchestrator, Container Manager    │
│ │ File Utils, Validators, Live Log Streaming                  │
│ ├──────────────────────────────────────────────────────────────┤
│ │ Models (SQLAlchemy) & Schemas (Pydantic)                    │
│ ├──────────────────────────────────────────────────────────────┤
│ │ Background Orchestrator Thread (Experiment Lifecycle)        │
│ └──────────────────────────────────────────────────────────────┘
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
┌───────────────▼─────────────┐  ┌────────▼──────────────────────┐
│ SQLite Database + Storage   │  │ Docker Daemon (Container Mgmt) │
│ ├─ Database: experiments.db │  │ ├─ Custom bridge network      │
│ └─ Storage: /storage/...    │  │ ├─ BatSim containers         │
│   ├─ workloads/             │  │ ├─ PyBatsim containers       │
│   ├─ platforms/             │  │ └─ Volume mounts             │
│   ├─ strategies/            │  └────────────────────────────────┘
│   ├─ experiments/           │
│   │  └─ {id}/config.json    │
│   └─ results/               │
└─────────────────────────────┘
```

## Core Components

### 1. Authentication & Authorization

**Location:** `backend/app/api/auth.py`, `backend/app/core/security.py`

- JWT-based authentication with refresh tokens
- Role-based access control (admin, user)
- Password hashing with bcrypt
- Token expiration and validation

**Endpoints:**
- `POST /api/auth/register` — User registration
- `POST /api/auth/login` — User login
- `POST /api/auth/refresh` — Refresh access token

### 2. Experiment Lifecycle (Phase 2)

#### State Machine

```
PENDING ─→ QUEUED ─→ RUNNING ─→ COMPLETED
  ↓         ↓          ↓
  └─→ CANCELLED ←──────┘
      ↓        ↓
      └─→ QUEUED (retry)

FAILED ─→ QUEUED (retry)
PAUSED ─→ QUEUED (resume)
```

#### Experiment Bundle Service

**Location:** `backend/app/services/experiment_bundle_service.py`

**Purpose:** Freeze experiment configuration and copy artifact files on creation.

**Process:**
1. Validates scenario and strategy exist
2. Creates experiment directory: `storage/experiments/{id}/`
3. Copies workload, platform, strategy files to experiment directory
4. Snapshots current artifact versions (workload_version, platform_version, strategy_version)
5. Records seed and params for reproducibility
6. Returns immutable frozen_config JSON stored on experiment record

**Key Fields in frozen_config:**
```json
{
  "experiment_id": 123,
  "created_at": "2026-03-24T10:30:00Z",
  "config": {
    "workload": {"id": 1, "version": 1, "name": "workload_name"},
    "platform": {"id": 2, "version": 1, "name": "platform_name"},
    "strategy": {"id": 3, "version": 1, "name": "strategy_name"},
    "seed": 12345,
    "params": {}
  },
  "frozen_files": {
    "workload_path": "storage/experiments/123/workload.json",
    "platform_path": "storage/experiments/123/platform.xml",
    "strategy_path": "storage/experiments/123/strategy.py"
  }
}
```

#### Experiment Queue Service

**Location:** `backend/app/services/experiment_queue_service.py`

**Purpose:** Manage experiment state transitions and concurrent execution.

**Key Functions:**
- `validate_transition()` — Enforce valid state transitions
- `enqueue_experiment()` — Move experiment from PENDING to QUEUED
- `cancel_experiment()` — Cancel queued or running experiments
- `process_queue()` — Promote QUEUED experiments to RUNNING when slots available
- `get_queue_status()` — Return current queue state

**Concurrency Control:**
- `MAX_CONCURRENT_SIMULATIONS` setting (default: 2)
- FIFO queue using `created_at` ordering
- Row-level locking for safety with PostgreSQL; serialized writes for SQLite

**Valid Transitions:**
```
PENDING → {QUEUED, CANCELLED}
QUEUED → {RUNNING, CANCELLED}
RUNNING → {COMPLETED, FAILED, CANCELLED, PAUSED}
PAUSED → {QUEUED, CANCELLED}
COMPLETED → (terminal)
FAILED → {QUEUED} (allow retry)
CANCELLED → {QUEUED} (allow re-queue)
```

### 3. Experiment Model

**Location:** `backend/app/models/experiment.py`

**Status Enum:**
```python
PENDING, QUEUED, RUNNING, PAUSED, COMPLETED, FAILED, CANCELLED
```

**Key Columns (Phase 2 additions):**
- `frozen_config` (TEXT) — Immutable snapshot of config + file paths
- `seed` (INTEGER) — Random seed for reproducibility
- `params` (TEXT) — Additional simulation parameters (JSON)

**Phase 3 additions:**
- `error_message` (TEXT) — Error details on failure
- `container_network` (STRING) — Custom bridge network name for isolation

**Existing Columns:**
- `status`, `config`, `scenario_id`, `strategy_id`
- Container IDs, timing, progress tracking, logs

### 3a. Docker Container Orchestration (Phase 3)

#### ContainerManager Service

**Location:** `backend/app/services/orchestrator/container_manager.py`

**Purpose:** Manage Docker container lifecycle for experiments.

**Key Responsibilities:**
- Create containers from BatSim and PyBatsim images
- Mount frozen configuration files
- Set environment variables (seed, params, etc.)
- Monitor container health and status
- Collect real-time logs from running containers
- Clean up containers on completion or failure
- Handle timeout and graceful shutdown

**Key Methods:**
- `create_experiment_containers()` — Launch BatSim + PyBatsim pair
- `get_container_status()` — Check running state
- `get_container_logs()` — Stream logs without blocking
- `stop_container()` — Gracefully terminate with timeout
- `cleanup_containers()` — Remove and clean resources
- `cleanup_orphans()` — Detect stale containers on startup

#### OrchestratorService

**Location:** `backend/app/services/orchestrator/orchestrator_service.py`

**Purpose:** Background orchestration of experiment lifecycle.

**Architecture:**
- Runs as background thread in main FastAPI app
- Polls database for QUEUED experiments
- Automatically promotes to RUNNING when slots available
- Monitors running experiments for completion/failure
- Updates database with progress, exit codes, logs
- Enforces state transitions atomically

**State Progression:**
1. PENDING → QUEUED (user initiated)
2. QUEUED → RUNNING (orchestrator, when slots available)
3. RUNNING → COMPLETED (on success)
4. RUNNING → FAILED (on error, timeout, or crash)
5. CANCELLED → (terminal, no further promotion)

**Concurrency Control:**
- `MAX_CONCURRENT_SIMULATIONS` (default: 2)
- FIFO queue by `created_at` timestamp
- Row-level locking for state updates
- Atomic promotions prevent race conditions

**Timeout Handling:**
- Per-experiment timeout from `params.timeout` (default: 3600s)
- Container graceful shutdown with SIGTERM
- Force kill (SIGKILL) if timeout exceeded
- Error message recorded for failure analysis

#### Live Log Streaming

**Endpoint:** `GET /api/experiments/{id}/logs`

**Features:**
- Stream logs from running containers in real-time
- No blocking I/O; uses non-blocking collection
- Aggregates stdout/stderr from BatSim + PyBatsim
- Frontend websocket fallback via polling (Phase 4)
- Logs persisted to storage on experiment completion

#### Network Isolation

**Implementation:**
- Custom bridge network per experiment group
- Container names include experiment UUID
- Prevents network conflicts with other simulations
- Enables inter-container communication (BatSim ↔ PyBatsim)

### 4. API Endpoints

#### Experiments API

**Location:** `backend/app/api/experiments.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/experiments/` | GET | List all experiments |
| `/api/experiments/` | POST | Create experiment (freezes config) |
| `/api/experiments/{id}` | GET | Get experiment details |
| `/api/experiments/{id}` | PUT | Update non-status fields (name, description) |
| `/api/experiments/{id}` | DELETE | Delete experiment + cleanup files |
| `/api/experiments/{id}/start` | POST | Enqueue experiment (PENDING→QUEUED) |
| `/api/experiments/{id}/stop` | POST | Cancel experiment (RUNNING/QUEUED→CANCELLED) |
| `/api/experiments/{id}/status` | GET | Get status, progress, frozen_config, error_message |
| `/api/experiments/{id}/logs` | GET | Stream live logs from running containers (Phase 3) |
| `/api/experiments/queue` | GET | Get queue status (running, queued, slots) |

**Create Experiment Request:**
```json
{
  "name": "exp_001",
  "description": "Test experiment",
  "scenario_id": 1,
  "strategy_id": 1,
  "seed": 42,
  "params": {"timeout": 3600},
  "config": {}
}
```

**Queue Status Response:**
```json
{
  "running": 1,
  "queued": 3,
  "max_concurrent": 2,
  "available_slots": 1
}
```

### 5. Scenarios API

**Location:** `backend/app/api/scenarios.py`

**Enhancement (Phase 2):** Scenarios responses now include workload/platform version numbers:
```json
{
  "id": 1,
  "name": "scenario_name",
  "workload_id": 1,
  "workload_name": "workload_name",
  "workload_version": 1,
  "platform_id": 2,
  "platform_name": "platform_name",
  "platform_version": 1
}
```

### 6. File Management

**Storage Structure:**
```
storage/
├── workloads/
│   └── {id}__{filename}
├── platforms/
│   └── {id}__{filename}
├── strategies/
│   └── {id}__{filename}
├── experiments/
│   ├── {exp_id}/
│   │   ├── workload.{ext}
│   │   ├── platform.{ext}
│   │   └── strategy.{ext}
│   └── ...
└── results/
    └── {exp_id}/
```

**Validators:**
- `workload_validator.py` — JSON schema validation
- `platform_validator.py` — XML schema validation
- `strategy_validator.py` — Python AST validation

### 7. Database Schema (Phase 2 Changes)

**Experiments Table - New Columns:**
```sql
ALTER TABLE experiments ADD COLUMN frozen_config TEXT;
ALTER TABLE experiments ADD COLUMN seed INTEGER;
ALTER TABLE experiments ADD COLUMN params TEXT;
```

**Workloads/Platforms/Strategies - New Columns:**
```sql
ALTER TABLE workloads ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE platforms ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE strategies ADD COLUMN version INTEGER DEFAULT 1;
```

**Migration:** Lightweight SQLite migration in `main.py` runs on startup.

## Data Flow

### Create & Enqueue Experiment

1. User submits form with scenario, strategy, seed, params
2. API creates experiment record (status=PENDING)
3. Bundle service:
   - Snapshots workload/platform/strategy versions
   - Creates experiment directory
   - Copies files (validates path traversal)
   - Returns frozen_config
4. API stores frozen_config and seed/params
5. User clicks "Start" → POST `/experiments/{id}/start`
6. Queue service:
   - Validates PENDING→QUEUED transition
   - Sets status=QUEUED
   - Calls process_queue()
7. process_queue() checks available slots:
   - If slots available: promotes to RUNNING
   - Otherwise: stays QUEUED until slot opens

### Run Experiment (Phase 3 - Container Orchestration)

1. OrchestratorService background thread polls for QUEUED experiments
2. When slot available: promotes experiment to RUNNING
3. ContainerManager creates Docker containers:
   - BatSim container with frozen workload/platform files
   - PyBatsim container with frozen strategy file
   - Custom bridge network for container communication
   - Environment variables: seed, params, timeout
4. Containers execute simulation:
   - PyBatsim connects to BatSim via socket
   - Logs streamed in real-time via container.logs(stream=True)
   - ContainerManager monitors container health
5. On completion or timeout:
   - Collects final logs and exit codes
   - Records error_message if failed
   - Sets status=COMPLETED or FAILED
   - Cleans up containers and network
6. OrchestratorService calls process_queue() → promotes next QUEUED experiment

## Security Considerations

### Path Traversal Protection

Bundle service validates source files are within storage root:
```python
real_src = os.path.realpath(src)
if not real_src.startswith(storage_root + os.sep):
    raise ValueError("path is outside storage directory")
```

### State Machine Enforcement

Cannot bypass queue via direct status updates. Transitions validated at each step.

### Cleanup

On experiment deletion, files removed immediately:
```python
shutil.rmtree(exp_dir, ignore_errors=True)
```

## Performance Notes

- Queue promotion (QUEUED→RUNNING) uses row-level locking (PostgreSQL) or atomic writes (SQLite)
- FIFO ordering by created_at for fair scheduling
- Concurrent slots configurable via `MAX_CONCURRENT_SIMULATIONS`

## Future Phases (Roadmap)

**Phase 3 (Complete ✅):** Container orchestration with Docker SDK
- Automated container lifecycle management
- Real-time log streaming
- Graceful failure handling and cleanup

**Phase 4:** Real-time monitoring
- WebSocket updates for progress (upgrade from HTTP polling)
- System resource tracking
- Live metric aggregation from containers

**Phase 5:** Advanced analytics
- Comparative analysis across experiments
- Trend visualization and reporting
- Custom metric calculations

## Environment Variables

Key settings in `.env`:
```
DATABASE_URL=sqlite:///./experiments.db
STORAGE_PATH=./storage
SIMULATION_DATA_PATH=./storage/experiments
MAX_CONCURRENT_SIMULATIONS=2
BACKEND_CORS_ORIGINS=["http://localhost:5173"]

# Docker orchestration (Phase 3)
DOCKER_HOST=unix:///var/run/docker.sock  # Linux
DOCKER_SOCKET=/var/run/docker.sock
BATSIM_IMAGE=batsim:latest
PYBATSIM_IMAGE=pybatsim:latest
EXPERIMENT_TIMEOUT=3600  # Default 1 hour
```

## Technology Stack

- **Frontend:** React 19, TypeScript, Material-UI, Axios, Zustand
- **Backend:** FastAPI, SQLAlchemy, Pydantic, SQLite/PostgreSQL
- **Security:** JWT, bcrypt
- **Validation:** JSON schema (workloads), XML schema (platforms), Python AST (strategies)
