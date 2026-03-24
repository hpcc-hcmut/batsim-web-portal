# Codebase Summary

## Project Overview

BatSim Web Portal is a web application for managing and executing BatSim simulations. It provides a modern interface for uploading workloads, platforms, and scheduling strategies, creating scenarios, launching experiments, and analyzing results.

**Repository:** BatSim Web Portal (batsim-web-portal)
**Last Scanned:** March 24, 2026
**Repomix Output:** `repomix-output.xml`

## Repository Statistics

| Metric | Value |
|--------|-------|
| Total Files | 96 |
| Total Tokens | ~93,486 |
| Total Characters | ~420,508 |
| Security Issues Detected | 1 (`.env.example` excluded) |

## Directory Structure

```
batsim-web-portal/
├── backend/                    # FastAPI server
│   ├── app/
│   │   ├── api/               # Route handlers
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── schemas/           # Pydantic validation schemas
│   │   ├── services/          # Business logic
│   │   ├── core/              # Database, config, security
│   │   └── templates/         # File templates
│   ├── tests/                 # Unit tests
│   ├── Dockerfile             # Docker image definition
│   └── requirements.txt        # Python dependencies
├── frontend/                  # React + TypeScript application
│   ├── src/
│   │   ├── pages/             # Page components
│   │   ├── components/        # Reusable components
│   │   ├── services/          # API client
│   │   ├── store/             # Zustand state management
│   │   └── utils/             # Helper functions
│   ├── index.html             # Entry point
│   ├── package.json           # Node dependencies
│   └── Dockerfile             # Docker image definition
├── docker-compose.yml         # Multi-container orchestration
├── docs/                      # Documentation
├── samples/                   # Example workloads, platforms, strategies
├── monitoring/                # Grafana & Prometheus configs
└── README.md                  # Main documentation
```

## Backend Architecture

### Core Technologies
- **Framework:** FastAPI with automatic API documentation (Swagger/ReDoc)
- **Database:** SQLAlchemy ORM with SQLite (dev) / PostgreSQL support
- **Validation:** Pydantic for request/response schemas
- **Security:** JWT authentication with bcrypt password hashing
- **File Handling:** Multipart uploads, file validation, secure storage

### Database Models

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| User | Authentication & authorization | username, email, role (admin/user), is_active |
| Workload | Job traces | name, file_path, file_size, file_type, version |
| Platform | Infrastructure descriptions | name, file_path, file_size, file_type, version |
| Strategy | Scheduling strategies | name, file_path, file_size, file_type, version |
| Scenario | Experiment template | workload_id, platform_id |
| Experiment | Simulation execution | scenario_id, strategy_id, status, frozen_config, seed, params |
| Result | Simulation results | experiment_id, metrics, makespan, utilization |

### API Routes

| Module | Endpoints | Count |
|--------|-----------|-------|
| auth.py | register, login, refresh | 3 |
| workloads.py | CRUD, upload, validate, download | 6 |
| platforms.py | CRUD, upload, validate, download | 6 |
| strategies.py | CRUD, upload, validate, download | 6 |
| scenarios.py | CRUD with enriched versions | 5 |
| experiments.py | CRUD, start, stop, queue, status | 9 |
| results.py | CRUD, analytics queries | 5 |
| system.py | Health check, info | 2 |
| templates.py | Download templates | 1 |

**Total API Endpoints:** ~43

### Services (Phase 2)

| Service | Purpose |
|---------|---------|
| `experiment_bundle_service.py` | Freezes config and copies artifact files on experiment creation |
| `experiment_queue_service.py` | State machine for experiment lifecycle (PENDING→QUEUED→RUNNING) |
| `file_utils.py` | File operations utilities |
| `validators/workload_validator.py` | JSON schema validation for workloads |
| `validators/platform_validator.py` | XML schema validation for platforms |
| `validators/strategy_validator.py` | Python AST validation for strategies |

### Key Features

#### Authentication (Complete)
- User registration and login
- JWT token generation and refresh
- Role-based access control
- Password hashing with bcrypt

#### Workload Management (Complete)
- Upload JSON workload files
- Validate JSON schema
- Version tracking
- Download templates

#### Platform Management (Complete)
- Upload XML platform files
- Validate XML schema
- Version tracking
- Download templates

#### Strategy Management (Complete)
- Upload Python strategy files
- Validate Python syntax via AST
- Version tracking
- Download templates

#### Scenario Management (Complete)
- Create scenarios combining workloads and platforms
- Version display in API responses
- List and retrieve scenarios

#### Experiment Lifecycle (Phase 2 - Complete)
- Create experiments with frozen config
- Enqueue experiments (PENDING→QUEUED)
- Manage state transitions (QUEUED→RUNNING)
- Cancel experiments
- Track status and progress
- Queue management with concurrency control

#### Results Management (Complete)
- Store simulation results
- Query and retrieve results
- Metrics storage (JSON)

## Frontend Architecture

### Technology Stack
- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite
- **UI Library:** Material-UI (MUI)
- **State Management:** Zustand
- **Routing:** React Router
- **HTTP Client:** Axios
- **Charts:** Chart.js (for analytics)

### Pages

| Page | Purpose | Status |
|------|---------|--------|
| LoginPage | User authentication | ✅ Complete |
| DashboardPage | Overview and quick links | ✅ Complete |
| WorkloadsPage | Upload, list, manage workloads | ✅ Complete |
| PlatformsPage | Upload, list, manage platforms | ✅ Complete |
| StrategiesPage | Upload, list, manage strategies | ✅ Complete |
| ScenariosPage | Create scenarios, view versions | ✅ Complete |
| ExperimentsPage | Create, start, stop, monitor experiments | ✅ Phase 2 Complete |
| ResultsPage | View and analyze results | ✅ Complete |
| AnalyticsPage | Comparative analysis | 🚧 Planned |

### Components

| Component | Purpose |
|-----------|---------|
| Layout | Main application container with navigation |
| ValidationErrorPanel | Display validation errors from backend |
| DashboardAnalyticsGadget | Mini charts for dashboard |

### Services

**api.ts:** Typed API client with Axios
- Authentication endpoints
- CRUD operations for all entities
- File upload/download helpers
- Error handling

### Store

**authStore.ts:** Zustand store for auth state
- User info and token management
- Login/logout actions
- Token refresh on app load

### Key Features

#### Type Safety
- Full TypeScript strict mode
- API types generated from backend schemas
- Component props properly typed
- Zustand state typed

#### User Experience
- Material-UI responsive design
- Real-time form validation
- Error notifications
- File upload progress
- Loading states
- QUEUED badge for experiments (Phase 2)
- Frozen config display in experiment details

## Phase 2 Additions (Scenario Builder & Experiment Lifecycle)

### Backend Changes

**New Models:**
- `frozen_config` column on Experiment table (TEXT)
- `seed` column on Experiment table (INTEGER)
- `params` column on Experiment table (TEXT)
- `version` column on Workload, Platform, Strategy tables (INTEGER)

**New Services:**
- `experiment_bundle_service.py` — Config freezing and file copying
- `experiment_queue_service.py` — State machine and concurrency management

**Updated APIs:**
- Experiments API: new endpoints for queue status and state transitions
- Scenarios API: enriched responses with version numbers

**Migration:**
- Lightweight SQLite ALTER TABLE migrations in `main.py`

### Frontend Changes

**Updated Types:**
- Experiment schema includes QUEUED status, seed, params, frozen_config

**Updated Pages:**
- ExperimentsPage: QUEUED badge, seed input in create dialog
- ExperimentsPage: frozen config display in detail view
- ScenariosPage: workload/platform version display

## Testing

**Test Coverage:**
- Unit tests for validators (workload, platform, strategy)
- Validation result model tests
- Test fixtures in `conftest.py`

**Test Files:**
```
backend/tests/
├── conftest.py
├── test_workload_validator.py
├── test_platform_validator.py
├── test_strategy_validator.py
└── test_validation_result.py
```

## Deployment

### Docker
- `backend/Dockerfile` — FastAPI + Python runtime
- `frontend/Dockerfile` — Node build + nginx serving
- `docker-compose.yml` — Multi-container orchestration

### Configuration
- `.env.example` — Environment variable template
- `.dockerignore` — Exclude build artifacts from images

### Monitoring (Optional)
- Grafana provisioning in `monitoring/grafana/`
- Prometheus config in `monitoring/prometheus/`

## Sample Data

**Samples directory:**
```
samples/
├── workloads/
│   └── HCMUT-SuperNodeXP-2017.json
├── platforms/
│   └── cluster288-HCMUT-SuperNodeXP.xml
└── strategies/
    ├── backfill_scheduler.py
    ├── fcfs_scheduler.py
    ├── filler.py
    └── utils.py
```

## Development Workflow

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Documentation
- API: http://localhost:8000/docs (Swagger UI)
- ReDoc: http://localhost:8000/redoc

## Dependencies

### Backend (Python)
- fastapi, uvicorn
- sqlalchemy, pydantic
- bcrypt, python-jose
- python-multipart
- psutil (monitoring)
- jsonschema (validation)

### Frontend (Node)
- react, react-dom
- react-router-dom
- @mui/material, @mui/icons-material
- axios, zustand
- vite, typescript
- eslint (code quality)

## Naming Conventions

### Backend
- **Files:** `snake_case.py`
- **Classes:** `PascalCase`
- **Functions:** `snake_case()`
- **Constants:** `UPPER_SNAKE_CASE`

### Frontend
- **Files:** `PascalCase.tsx` for components, `snake-case.ts` for utilities
- **Components:** `PascalCase`
- **Functions:** `camelCase()`
- **Constants:** `UPPER_SNAKE_CASE`

## Security Measures

1. **Path Traversal Protection:** Validate file paths within storage root
2. **State Machine Enforcement:** Cannot bypass queue via direct updates
3. **Cleanup on Delete:** Remove files immediately from disk
4. **Input Validation:** Pydantic schemas and file validators
5. **Authentication:** JWT with role-based access control
6. **CORS:** Configured for frontend domain only

## Performance Considerations

- Concurrent experiment slots configurable
- FIFO queue ordering for fair scheduling
- Row-level locking support for PostgreSQL
- Serialized writes for SQLite
- File validation on upload (no execution)

## Known Limitations

- Phase 3 (container orchestration) not yet implemented
- WebSocket real-time monitoring planned for Phase 4
- Advanced analytics dashboard planned for Phase 5
- Single-machine deployment (no clustering)

## Next Steps

1. **Phase 3:** Container orchestration with Docker SDK
2. **Phase 4:** Real-time monitoring and WebSocket updates
3. **Phase 5:** Advanced analytics and comparative analysis
4. **Phase 6:** Performance optimization and scaling
