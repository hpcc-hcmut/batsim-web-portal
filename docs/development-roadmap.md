# Development Roadmap

## Project Timeline & Phases

BatSim Web Portal is being developed in iterative phases, each adding significant functionality. This roadmap tracks progress, upcoming work, and long-term vision.

**Current Date:** March 25, 2026
**Current Phase:** Phase 3 (Complete ✅)
**Next Phase:** Phase 4 (Planned Q3 2026)

## Phase Overview

```
Phase 1: Core CRUD          ✅ Complete (Jan-Feb 2026)
Phase 2: Scenario Builder   ✅ Complete (Mar 2026)
Phase 3: Container Orch.    ✅ Complete (Mar 23-25 2026)
Phase 4: Real-time Monitor  📋 Planned (Q3 2026)
Phase 5: Advanced Analytics 📋 Planned (Q4 2026)
Phase 6: Optimization       📋 Future
```

---

## Phase 1: Core CRUD Operations

**Status:** ✅ Complete
**Duration:** January - February 2026
**Completion Date:** February 28, 2026

### Completed Features

#### Authentication & Authorization
- User registration and login
- JWT token management
- Role-based access control (admin, user)
- Password hashing with bcrypt

#### Entity Management
- **Workloads:** Upload, list, retrieve, delete, download
- **Platforms:** Upload, list, retrieve, delete, download
- **Strategies:** Upload, list, retrieve, delete, download
- **Scenarios:** Create (combine workloads + platforms), list, retrieve, delete

#### File Management
- Multipart file upload to backend
- File type validation (JSON, XML, Python)
- File storage in organized directories
- File download with proper headers

#### Validation
- JSON schema validation for workloads
- XML schema validation for platforms
- Python syntax validation for strategies
- User input validation via Pydantic schemas

#### Frontend UI
- Material-UI responsive design
- Authentication pages (login, register)
- CRUD pages for all entities
- File upload forms
- List and detail views
- Navigation and routing

#### Database
- SQLAlchemy models for all entities
- SQLite for development
- PostgreSQL support for production
- Proper relationships and foreign keys

### Key Metrics
- 8 entities fully modeled
- 40+ API endpoints
- 100% CRUD coverage
- Type-safe frontend and backend

---

## Phase 2: Scenario Builder & Experiment Lifecycle

**Status:** ✅ Complete
**Duration:** March 1 - March 24, 2026
**Completion Date:** March 24, 2026

### Completed Features

#### Scenario Enhancement
- Version tracking on workloads, platforms, strategies
- Scenarios API returns workload/platform version numbers
- Frontend displays versions in scenario list

#### Experiment Configuration
- Create experiments with seed parameters
- Support additional simulation parameters (params)
- Frozen configuration snapshots on creation
- Immutable config prevents drift

#### Experiment Lifecycle
- State machine: PENDING → QUEUED → RUNNING → COMPLETED/FAILED/CANCELLED
- Enqueue endpoint (PENDING → QUEUED)
- Stop/cancel endpoint (QUEUED/RUNNING → CANCELLED)
- Queue status endpoint
- Experiment status endpoint with frozen config

#### Queue Management
- Concurrent execution control (MAX_CONCURRENT_SIMULATIONS)
- FIFO queue ordering by created_at
- Automatic promotion of queued experiments when slots available
- Race condition prevention with row-level locking

#### File Management
- Artifact files copied to experiment directory on creation
- Path traversal validation
- Cleanup on experiment deletion
- Immutable file references in frozen_config

#### Services Implementation
- `experiment_bundle_service.py` — Config freezing and file copying
- `experiment_queue_service.py` — State machine and queue management

#### Database Migration
- Lightweight SQLite ALTER TABLE migrations
- New columns: frozen_config, seed, params on experiments
- New columns: version on workloads, platforms, strategies
- Zero downtime migration

#### Frontend Updates
- ExperimentsPage shows QUEUED status badge
- Create experiment dialog accepts seed input
- Experiment detail view displays frozen_config
- ScenariosPage displays workload/platform versions

### Key Metrics
- 7 new API endpoints
- 2 new services
- 4 new database columns
- 100% state transition validation
- Phase 2 PDR requirements: 20/20 complete

### Security Improvements
- Path traversal validation in bundle service
- State machine enforcement prevents bypass
- Atomic transactions for state changes
- File cleanup on deletion

---

## Phase 3: Container Orchestration

**Status:** ✅ Complete
**Duration:** March 23-25, 2026
**Completion Date:** March 25, 2026

### Completed Features

#### Docker Integration ✅
- Docker SDK for Python (v7.1.0)
- Container lifecycle management via ContainerManager class
- Environment variable passing to containers
- Volume mounting for experiment files
- Custom bridge network for container communication

#### Orchestrator Service ✅
- Background thread orchestrator for running experiments
- Automatic QUEUED→RUNNING promotion
- Concurrent experiment execution with configurable slots
- Container health monitoring and health checks
- Graceful shutdown with container cleanup

#### Experiment Queue Management ✅
- State machine enforced: PENDING→QUEUED→RUNNING→COMPLETED/FAILED
- Automatic progression through queue
- FIFO ordering by creation time
- Race condition prevention with atomic operations
- Timeout handling (configurable per experiment)

#### Config Freezing & Isolation ✅
- Immutable file copies in storage/experiments/{id}/
- Prevents artifact version conflicts
- Enables reproducible simulations
- Each experiment isolated in own directory

#### Live Log Streaming ✅
- Real-time log collection from running containers
- Container log aggregation via `/api/experiments/{id}/logs`
- Log streaming without blocking
- Live logs tab in ExperimentsPage frontend component

#### Container Cleanup ✅
- Orphan container detection on startup
- Automatic cleanup of stale containers
- Proper resource cleanup on experiment deletion
- Graceful container termination with timeout

#### Sample Strategies ✅
- `filler.py` — PyBatsim strategy using low-level API
- `fcfs_scheduler.py` — First-come-first-serve scheduler
- Both rewritten for compatibility with PyBatsim container

#### Frontend Modularization ✅
- ExperimentsPage: Refactored into modular components
- `experiment-create-dialog.tsx` — Create/enqueue dialog
- `experiment-detail-dialog.tsx` — View and cancel dialog
- Live logs tab with real-time updates
- Detail view shows frozen config snapshot

### Security Improvements
- Path traversal validation on destination directories
- Ownership checks on lifecycle endpoints
- Race condition guard on state transitions
- Timeout handling prevents hanging containers
- Network isolation via custom bridge network

### Key Metrics
- 3 new services (ContainerManager, OrchestratorService)
- 9 API endpoints (create, start, stop, status, logs, queue, etc.)
- 2 frontend components (dialogs)
- 100% state transition validation
- Phase 3 PDR requirements: 22/22 complete

### Infrastructure
- Docker daemon integration for production/staging
- Multi-container orchestration via docker-compose
- Custom bridge network for experiment isolation
- Volume management for frozen configs and results

### Testing Validation
- Container lifecycle tests: creation, monitoring, cleanup
- Log streaming accuracy tests
- Failure scenario handling (container crashes, timeouts)
- State machine transition validation
- Concurrent experiment execution tests

### Dependencies Met
- Docker SDK for Python ✅
- BatSim and PyBatsim container images ✅
- Container registry configured ✅

---

## Phase 4: Real-time Monitoring

**Status:** 📋 Planned
**Estimated Start:** June 2026
**Estimated Duration:** 6-8 weeks
**Target Completion:** July 2026

### Planned Features

#### WebSocket Integration
- Real-time progress updates
- Live log streaming
- Status change notifications
- Experiment completion alerts

#### Progress Tracking
- Percentage-based progress from simulation logs
- Jobs completed/total jobs
- Estimated time remaining
- Real-time charts

#### System Monitoring
- CPU usage tracking
- RAM usage tracking
- Disk I/O monitoring
- Network I/O monitoring

#### Live Logging
- Stream BatSim logs in real-time
- Stream PyBatsim logs in real-time
- Log filtering and search
- Tail-like viewing experience

#### Alerts & Notifications
- Experiment completion notifications
- Failure alerts
- Resource usage warnings
- Queue status updates

#### Dashboard Enhancement
- Real-time queue visualization
- Running experiments overview
- Resource utilization graphs
- Historical performance metrics

### Key Requirements
- Low-latency updates (< 1s latency)
- Scalable to multiple concurrent experiments
- Browser compatibility (modern WebSockets)
- Graceful fallback if WebSocket unavailable

### Success Criteria
- [ ] Progress updates in < 1 second
- [ ] Live logs visible without page refresh
- [ ] Resource metrics collected and displayed
- [ ] Notifications received reliably
- [ ] No memory leaks from long-running connections

---

## Phase 5: Advanced Analytics

**Status:** 📋 Planned
**Estimated Start:** August 2026
**Estimated Duration:** 8 weeks
**Target Completion:** September 2026

### Planned Features

#### Comparative Analysis
- Compare metrics across multiple experiments
- Side-by-side result comparison
- Performance regression detection
- Strategy comparison

#### Visualization
- Makespan distribution charts
- Job completion timeline
- Resource utilization curves
- Scheduling quality metrics

#### Data Export
- Export results to CSV
- Export charts as images
- Report generation
- Bulk download

#### Trend Analysis
- Historical performance tracking
- Platform efficiency trends
- Strategy performance over time
- Workload impact analysis

#### Advanced Queries
- Filter results by multiple criteria
- Custom metric calculations
- Aggregated statistics
- Correlation analysis

#### Reporting
- Pre-built reports (weekly, monthly)
- Custom report templates
- Email report delivery
- Result archiving

### Key Requirements
- Handle large result datasets
- Fast query performance
- Intuitive visualization
- Mobile-friendly charts

### Success Criteria
- [ ] Compare 5+ experiments simultaneously
- [ ] Charts render in < 2 seconds
- [ ] Export to CSV/PDF working
- [ ] Custom filters functional
- [ ] Reports generated on schedule

---

## Phase 6: Performance & Scaling

**Status:** 📋 Future
**Estimated Start:** October 2026
**Duration:** Ongoing

### Planned Features

#### Horizontal Scaling
- Multiple backend instances
- Load balancing
- Shared database (PostgreSQL required)
- Distributed queue

#### Performance Optimization
- Database query optimization
- Caching strategies
- API response compression
- Frontend bundle size reduction

#### High Availability
- Database replication
- Backup and recovery
- Health checks and auto-recovery
- Graceful shutdown

#### Advanced Queue Features
- Priority-based scheduling
- Resource-aware scheduling
- Job batching
- Preemption support

#### Monitoring & Operations
- Prometheus metrics
- Grafana dashboards
- Alerting system
- Operational runbooks

---

## Dependencies & Blockers

### Current Blockers
- None (Phase 2 complete)

### Phase 3 Blockers
- BatSim and PyBatsim container images availability
- Docker daemon configuration on deployment host

### Phase 4 Blockers
- WebSocket library maturity (socket.io or native WebSocket)
- Browser compatibility requirements

### Phase 5 Blockers
- Large dataset handling requirements
- Charting library selection

---

## Risk Assessment

### High Priority Risks

| Risk | Phase | Mitigation |
|------|-------|-----------|
| Container lifecycle issues | 3 | Thorough testing, error handling |
| WebSocket connection drops | 4 | Reconnection logic, fallback polling |
| Query performance on large datasets | 5 | Database indexing, pagination |

### Medium Priority Risks

| Risk | Phase | Mitigation |
|------|-------|-----------|
| Docker resource contention | 3 | Resource limits, monitoring |
| Real-time lag with many experiments | 4 | Efficient message protocol |
| Memory usage with streaming | 4 | Connection pooling, cleanup |

---

## Resource Planning

### Phase 3 (Container Orchestration)
- **Backend Engineer:** 1.5 FTE
- **QA Engineer:** 0.5 FTE
- **Estimated Effort:** 240 person-hours

### Phase 4 (Real-time Monitoring)
- **Backend Engineer:** 1 FTE
- **Frontend Engineer:** 1 FTE
- **DevOps Engineer:** 0.3 FTE
- **Estimated Effort:** 260 person-hours

### Phase 5 (Advanced Analytics)
- **Frontend Engineer:** 1.5 FTE
- **Data Engineer:** 0.5 FTE
- **Estimated Effort:** 280 person-hours

---

## Testing & QA Strategy

### Phase 2 (Current)
- Unit tests for services
- Integration tests for API
- Manual UI testing

### Phase 3
- Container lifecycle tests
- Log aggregation tests
- Failure scenario tests
- Load testing with multiple containers

### Phase 4
- WebSocket connection tests
- Concurrent update tests
- Real-time accuracy validation
- Latency benchmarking

### Phase 5
- Analytics accuracy tests
- Large dataset tests
- Report generation tests
- Export format validation

---

## Documentation Plan

### Phase 2 (Current) ✅
- [x] System architecture document
- [x] Codebase summary
- [x] Code standards
- [x] Project overview & PDR
- [x] Development roadmap (this document)
- [ ] API documentation (auto-generated)

### Phase 3
- [ ] Container orchestration guide
- [ ] Docker setup instructions
- [ ] Troubleshooting guide

### Phase 4
- [ ] WebSocket protocol specification
- [ ] Real-time monitoring user guide
- [ ] Performance tuning guide

### Phase 5
- [ ] Analytics user guide
- [ ] Custom query documentation
- [ ] Report templates

---

## Version History

### v1.0.0-phase2 (March 24, 2026)
- Scenario builder complete
- Experiment lifecycle state machine
- Queue management with concurrency control
- Frozen configuration snapshots
- Version tracking on artifacts

### v0.1.0-phase1 (February 28, 2026)
- Initial release
- Core CRUD operations
- Authentication & authorization
- File upload and validation

---

## Success Metrics

### Phase 2 Metrics ✅
- Experiments successfully created with frozen configs: 100%
- State transitions validated: 100%
- Queue management functional: 100%
- Path traversal protection: Confirmed

### Phase 3 Targets
- Container creation success rate: > 95%
- Average experiment execution time: < 5 minutes
- Log capture success rate: > 99%

### Phase 4 Targets
- Real-time update latency: < 1 second
- WebSocket connection uptime: > 99.9%
- Live log streaming quality: smooth (no stuttering)

### Phase 5 Targets
- Analytics query response time: < 2 seconds
- Report generation success rate: > 98%
- User satisfaction: > 4.5/5.0

---

## Contact & Questions

For questions about the roadmap:
- **Product Owner:** [Contact info]
- **Engineering Lead:** [Contact info]
- **QA Lead:** [Contact info]

---

## Changelog

| Date | Phase | Change |
|------|-------|--------|
| 2026-03-25 | 3 | Phase 3 completion marked |
| 2026-03-23 | 3 | Phase 3 started |
| 2026-03-24 | 2 | Phase 2 completion marked |
| 2026-03-01 | 2 | Phase 2 started |
| 2026-02-28 | 1 | Phase 1 completed |
| 2026-01-15 | 1 | Phase 1 started |

---

**Last Updated:** March 25, 2026
**Next Review:** After Phase 4 completion
