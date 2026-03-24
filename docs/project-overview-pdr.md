# Project Overview & Product Development Requirements (PDR)

## Executive Summary

BatSim Web Portal is a comprehensive web application for managing and executing BatSim job scheduling simulations. It provides researchers and practitioners with an intuitive platform to upload workloads and platform descriptions, define scheduling strategies, create simulation scenarios, execute experiments, and analyze results. The project is in Phase 2 completion with core simulation lifecycle implemented.

**Project Status:** Phase 2 (Scenario Builder & Experiment Lifecycle) ✅ Complete
**Current Version:** 1.0.0-phase2
**Target Users:** Researchers, system administrators, students
**Deployment:** Docker-based (development and production ready)

## Vision & Goals

### Vision
Enable researchers to efficiently conduct BatSim simulations through a user-friendly web interface, supporting reproducibility, scalability, and collaborative analysis of job scheduling algorithms.

### Primary Goals
1. Simplify simulation setup and execution workflow
2. Provide reproducible simulation environments via config freezing
3. Support concurrent experiment execution with queue management
4. Enable result storage and comparative analysis
5. Maintain security and data integrity

## Functional Requirements

### Phase 1: Core CRUD Operations (Completed)
- User authentication with role-based access control
- Upload and manage workload files
- Upload and manage platform descriptions
- Upload and manage scheduling strategies
- Create and manage simulation scenarios
- CRUD operations for all entities
- Basic results storage

### Phase 2: Scenario Builder & Experiment Lifecycle (Completed)

#### Scenario Builder
- **Requirement 2.1:** Create scenarios by combining workloads and platforms
- **Requirement 2.2:** Display workload and platform version numbers in scenarios
- **Requirement 2.3:** Support scenario listing, retrieval, and deletion

#### Experiment Configuration
- **Requirement 2.4:** Create experiments with frozen configuration snapshots
- **Requirement 2.5:** Support seed parameters for reproducible simulations
- **Requirement 2.6:** Support additional simulation parameters (params)
- **Requirement 2.7:** Immutable frozen_config prevents config drift

#### Experiment Lifecycle Management
- **Requirement 2.8:** Implement state machine (PENDING→QUEUED→RUNNING→COMPLETED)
- **Requirement 2.9:** Enqueue experiments from pending state
- **Requirement 2.10:** Cancel queued or running experiments
- **Requirement 2.11:** Manage concurrent execution with configurable slots
- **Requirement 2.12:** FIFO queue ordering for fair scheduling
- **Requirement 2.13:** Automatic promotion of queued experiments

#### File Management
- **Requirement 2.14:** Copy artifact files to experiment directory on creation
- **Requirement 2.15:** Validate path traversal attacks
- **Requirement 2.16:** Clean up files on experiment deletion

#### API & Display
- **Requirement 2.17:** Queue status endpoint returning running/queued/available counts
- **Requirement 2.18:** Experiment status endpoint with frozen_config display
- **Requirement 2.19:** QUEUED badge on frontend experiment list
- **Requirement 2.20:** Seed and frozen config inputs in experiment create dialog

### Phase 3: Container Orchestration (Planned)
- Docker SDK integration for BatSim and PyBatsim containers
- Container lifecycle management (create, start, stop, cleanup)
- Log collection from containers
- Status monitoring and progress tracking
- Error handling and automatic cleanup

### Phase 4: Real-time Monitoring (Planned)
- WebSocket updates for experiment progress
- System resource tracking (CPU, RAM, disk)
- Live log streaming
- Real-time progress visualization

### Phase 5: Advanced Analytics (Planned)
- Comparative analysis across multiple experiments
- Metrics visualization and charts
- Trend analysis
- Export capabilities

## Non-Functional Requirements

### Security
- **SEC-1:** JWT-based authentication with configurable token expiration
- **SEC-2:** Bcrypt password hashing with appropriate cost factor
- **SEC-3:** Role-based access control (admin vs user)
- **SEC-4:** Path traversal validation for file operations
- **SEC-5:** CORS configured for specific frontend origin
- **SEC-6:** SQL injection prevention via parameterized queries
- **SEC-7:** Immediate cleanup of deleted experiment files

### Performance
- **PERF-1:** Support concurrent simulations (configurable, default 2)
- **PERF-2:** Queue processing in O(n log n) time or better
- **PERF-3:** File validation without blocking main server
- **PERF-4:** Response times under 1s for standard operations
- **PERF-5:** Database indexes on frequently queried fields

### Reliability
- **REL-1:** Automatic migrations for database schema changes
- **REL-2:** Graceful error handling with informative messages
- **REL-3:** Data persistence across restarts
- **REL-4:** Atomic state transitions (all-or-nothing updates)

### Maintainability
- **MAINT-1:** Modular service architecture
- **MAINT-2:** Comprehensive inline documentation
- **MAINT-3:** Type safety (TypeScript frontend, type hints backend)
- **MAINT-4:** Consistent naming conventions

### Scalability
- **SCALE-1:** Support PostgreSQL for multi-user deployments
- **SCALE-2:** SQLite for single-user development
- **SCALE-3:** Horizontal scaling potential (future phase)

## Technical Architecture

### Technology Decisions

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Frontend Framework | React 19 + TypeScript | Type safety, performance, ecosystem |
| Frontend Build | Vite | Fast builds, modern tooling |
| Frontend UI | Material-UI | Professional appearance, accessibility |
| Backend Framework | FastAPI | High performance, auto-documentation, modern Python |
| Database ORM | SQLAlchemy | Flexibility, multiple DB support |
| State Management | Zustand | Lightweight, simple API |
| HTTP Client | Axios | Mature, reliable, type support |
| Auth | JWT + bcrypt | Stateless, secure, standard |

### Data Model

**Core Entities:**
- User (authentication, roles)
- Workload (job trace files with versions)
- Platform (infrastructure description with versions)
- Strategy (scheduling algorithm with versions)
- Scenario (workload + platform combination)
- Experiment (simulation execution with frozen config)
- Result (simulation outputs and metrics)

**Key Addition (Phase 2):** Frozen configuration snapshots on experiments enable reproducibility and prevent config drift.

## Acceptance Criteria

### Phase 2 Completion Criteria

#### Experiment Creation
- [x] Create experiment with scenario, strategy, seed, params
- [x] Automatic frozen_config generation on creation
- [x] Files copied to experiment directory
- [x] Version numbers captured in frozen_config
- [x] Experiment starts in PENDING status

#### State Transitions
- [x] PENDING→QUEUED transition via /start endpoint
- [x] QUEUED→RUNNING promotion when slots available
- [x] RUNNING→COMPLETED/FAILED/CANCELLED transitions
- [x] QUEUED→CANCELLED transition via /stop endpoint
- [x] Invalid transitions raise InvalidTransitionError

#### Queue Management
- [x] /queue endpoint returns running/queued/slots
- [x] MAX_CONCURRENT_SIMULATIONS enforced
- [x] FIFO ordering by created_at
- [x] process_queue() promotes eligible experiments

#### API Compliance
- [x] Queue status endpoint functional
- [x] Status endpoint includes frozen_config
- [x] Experiment list includes QUEUED badge support
- [x] Create dialog supports seed input
- [x] Detail view displays frozen_config

#### File Management
- [x] Artifact files copied to storage/experiments/{id}/
- [x] Path traversal validation implemented
- [x] Files cleaned up on deletion
- [x] File copy errors handled gracefully

#### Database
- [x] Migration creates frozen_config, seed, params columns
- [x] Migration creates version columns on artifacts
- [x] Existing data unaffected by migration
- [x] Both SQLite and PostgreSQL supported

#### Frontend
- [x] ExperimentsPage shows QUEUED status
- [x] Create dialog accepts seed input
- [x] Experiment detail view displays frozen_config
- [x] ScenariosPage shows workload/platform versions

### Success Metrics
- All functional requirements implemented and tested
- No security vulnerabilities in path validation
- State machine enforces valid transitions
- Queue processes correctly under concurrent load
- Frontend reflects all new fields and statuses

## Implementation Guidelines

### Code Organization

**Backend:**
```
app/
├── api/              # HTTP route handlers
├── models/           # SQLAlchemy ORM models
├── schemas/          # Pydantic validation schemas
├── services/         # Business logic (experiment_bundle_service, experiment_queue_service)
├── core/             # Database, config, security
└── utils/            # Helper functions
```

**Frontend:**
```
src/
├── pages/            # Page components
├── components/       # Reusable UI components
├── services/         # API client (api.ts)
├── store/            # Zustand state (authStore.ts)
└── utils/            # Utilities
```

### Development Standards

**Python (Backend):**
- Type hints on all function signatures
- Docstrings for public functions and classes
- No bare except clauses; handle specific exceptions
- Use context managers for resource cleanup
- Validate user input via Pydantic schemas

**TypeScript (Frontend):**
- Strict mode enabled
- No `any` types without justification
- Component props properly typed
- Custom hooks with return type annotations
- API response types match backend schemas

### Testing Requirements
- Unit tests for validators (workload, platform, strategy)
- Service tests for experiment bundle and queue
- Integration tests for API endpoints
- Frontend component tests recommended

## Constraints & Dependencies

### Constraints
- Single-machine deployment (no clustering in Phase 2)
- SQLite in development, PostgreSQL for production
- Concurrent simulations limited by MAX_CONCURRENT_SIMULATIONS
- File storage requires filesystem access

### External Dependencies
- Docker (for containers - Phase 3)
- BatSim simulation engine (external)
- PyBatsim bridge (external)

### Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES2020+ JavaScript support required

## Risk Assessment

### High Priority Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Path traversal in file ops | High | Validate all paths against storage root |
| State machine race conditions | High | Use row-level locking; test concurrency |
| Config drift in long-running sims | Medium | Frozen config prevents modifications |
| Database migration failures | High | Test migrations; provide rollback path |

### Medium Priority Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Large file uploads timeout | Medium | Implement chunked uploads (Phase 3) |
| Queue becoming too large | Low | Process queue regularly; monitor size |
| Token expiration during operation | Medium | Refresh tokens; handle 401 gracefully |

## Success Criteria & Validation

### Functional Validation
- All API endpoints tested with Swagger UI
- Frontend forms validate correctly
- Queue status updates in real-time
- Frozen config immutable after creation

### Integration Validation
- Create → Enqueue → Status works end-to-end
- File cleanup verified on deletion
- Database migrations run without errors
- CORS allows frontend communication

### Security Validation
- Path traversal attempts rejected
- State transitions enforced
- JWT tokens validated
- Role-based access working

## Rollout Plan

### Phase 2 Rollout
1. Deploy database migrations
2. Enable new API endpoints
3. Update frontend with new fields/badges
4. Demo to stakeholders
5. Gather feedback for Phase 3

### Phase 3 Preparation
- Design container orchestration layer
- Plan worker/scheduler architecture
- Document container lifecycle

## Maintenance & Support

### Documentation
- System architecture (this document provides baseline)
- API documentation (Swagger/ReDoc)
- Code comments for complex logic
- Developer onboarding guide

### Monitoring (Phase 4)
- Queue size and processing time
- Experiment success/failure rates
- API response times
- File storage usage

### Updates & Patches
- Dependency updates monthly (unless security critical)
- Database schema migrations included in releases
- Backward compatibility maintained

## Stakeholders

- **Product Owner:** Project lead
- **Development Team:** Backend and frontend engineers
- **QA:** Testers validating functionality
- **Users:** Researchers using the portal
- **DevOps:** Infrastructure and deployment

## Sign-Off

**Phase 2 PDR Status:** ✅ Complete and Accepted

This PDR serves as the authoritative specification for Phase 2. All functional requirements have been implemented and verified. Phase 3 and subsequent phases will build upon this foundation with additional features as outlined in the roadmap.
