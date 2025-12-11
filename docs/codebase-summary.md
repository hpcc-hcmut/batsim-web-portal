# BatSim Web Portal - Codebase Summary

**Last Updated:** December 2025
**Version:** Phase 8 (Audit & Collaboration Complete)
**Total Files:** 130 | **Total Tokens:** 194,517

## Executive Summary

BatSim Web Portal is a modern full-stack web application for managing batch job simulations. It provides a comprehensive platform for uploading workloads, creating simulation scenarios, running experiments, and analyzing results with role-based access control and real-time monitoring.

## Technology Stack

### Frontend
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite
- **UI Library:** Material-UI (MUI v7)
- **State Management:** Zustand
- **HTTP Client:** Axios
- **Routing:** React Router
- **Analytics:** Chart.js

### Backend
- **Framework:** FastAPI
- **Database:** SQLAlchemy (SQLite/PostgreSQL)
- **Data Validation:** Pydantic
- **Authentication:** JWT
- **Container Management:** Docker SDK
- **Monitoring:** Prometheus + Grafana
- **System Monitoring:** psutil

## Architecture Overview

### Backend Structure

```
backend/
├── app/
│   ├── api/              # API routes (13 routers)
│   ├── models/           # SQLAlchemy ORM models (12 models)
│   ├── schemas/          # Pydantic request/response schemas
│   ├── services/         # Business logic (7 services)
│   ├── core/             # Configuration, database, security
│   ├── main.py           # FastAPI application setup
│   └── seed_demo_data.py # Demo data initialization
├── storage/              # File upload storage
└── requirements.txt      # Python dependencies
```

### Frontend Structure

```
frontend/
├── src/
│   ├── components/       # Reusable UI components (11 main + analytics)
│   ├── pages/           # Page-level components (10 pages)
│   ├── services/        # API integration (api.ts with types)
│   ├── store/           # Zustand state stores (authStore.ts)
│   ├── hooks/           # Custom React hooks (3 hooks)
│   ├── utils/           # Utility functions
│   ├── App.tsx          # Main application component
│   └── main.tsx         # Entry point
├── public/              # Static assets
└── package.json         # Dependencies
```

## Phase 8: Audit & Collaboration Implementation (COMPLETE)

**Status:** Phase 8 successfully completed in December 2025. Comprehensive audit logging (FR14) and threaded collaboration features (FR15) fully implemented and integrated.

### New Backend Files (Phase 8)

#### Models
- **`backend/app/models/audit_log.py`**
  - AuditLog SQLAlchemy model with 3 indexes for query optimization
  - AuditAction enum: CREATE, UPDATE, DELETE, START, STOP, PAUSE, RESUME
  - Fields: id, user_id, action, entity_type, entity_id, entity_name, project_id, changes (JSON), ip_address, user_agent, created_at
  - Supports entity history tracking for workloads, platforms, experiments, scenarios, etc.

- **`backend/app/models/comment.py`**
  - Comment SQLAlchemy model with adjacency list pattern for threading
  - Polymorphic entity support (experiment, scenario, project)
  - Fields: id, entity_type, entity_id, parent_id, thread_level (max 3), content, user_id, is_deleted (soft delete), created_at, updated_at
  - 2 indexes for entity and thread queries

#### Schemas (API DTOs)
- **`backend/app/schemas/audit_log.py`**
  - AuditLogResponse: Full audit log entry with username, IP address, parsed changes
  - AuditLogListResponse: Paginated response with items, total count, next_cursor

- **`backend/app/schemas/comment.py`**
  - CommentCreate: entity_type, entity_id, parent_id (optional), content
  - CommentUpdate: content (for editing)
  - CommentResponse: Full comment with user details, timestamps, reply count
  - CommentThread: Threaded structure with nested replies array

#### Services
- **`backend/app/services/audit_service.py`**
  - `mask_sensitive_data()`: Masks PII fields (password, token, api_key, secret, credit_card)
  - `compute_changes()`: Field-level diff between old and new state
  - `log_audit()`: Synchronous audit logging with context capture
  - `log_audit_async()`: Background task wrapper with error handling

#### API Routes
- **`backend/app/api/audit.py`**
  - GET `/api/audit` - List audit logs with cursor pagination, filters (entity_type, entity_id, user_id, project_id), RBAC
  - GET `/api/audit/entity/{entity_type}/{entity_id}` - Entity audit history

- **`backend/app/api/comments.py`**
  - POST `/api/comments` - Create comment/reply with thread level validation
  - GET `/api/comments` - Flat comment list with filters
  - GET `/api/comments/threaded` - Threaded structure (roots + nested replies)
  - PUT `/api/comments/{id}` - Update comment
  - DELETE `/api/comments/{id}` - Soft delete (preserves threads)

### Modified Backend Files (Phase 8)

- **`backend/app/models/__init__.py`** - Exports AuditLog, AuditAction, Comment
- **`backend/app/schemas/__init__.py`** - Exports audit and comment schemas
- **`backend/app/main.py`** - Registers audit and comments routers

### New Frontend Files (Phase 8)

#### Components
- **`frontend/src/components/ActivityFeed.tsx`**
  - Real-time activity display component
  - Props: entityType (optional), entityId (optional), projectId (optional), limit (default 20)
  - Features: Action icons/colors, relative timestamps (e.g., "5m ago"), loading/error states
  - Integrated with auditAPI for data fetching
  - ACTION_ICONS: create, update, delete, start, stop, pause, resume
  - ACTION_COLORS: Map actions to MUI colors (success, info, warning, error)

- **`frontend/src/components/CommentSection.tsx`**
  - Threaded comments UI component
  - Props: entityType ('experiment' | 'scenario' | 'project'), entityId
  - Features: Create comments, reply to comments, expand/collapse threads, soft delete display
  - Uses commentsAPI for CRUD operations
  - Thread expansion with icon toggles (ExpandMore/ExpandLess)
  - Real-time refresh after operations

### Modified Frontend Files (Phase 8)

- **`frontend/src/services/api.ts`**
  - Added AuditLog, Comment TypeScript types
  - Added auditAPI service: getLogs(params), getEntityHistory(type, id)
  - Added commentsAPI service: create(data), getFlat(type, id), getThreaded(type, id), update(id, data), delete(id)

## Core Models & Database Schema

### User Model (Authentication)
```
users:
  id (PK)
  username (unique)
  email (unique)
  hashed_password
  role (admin | user)
  created_at
```

### Project Management
```
projects:
  id, name, description, created_by, created_at, updated_at

project_members:
  id, project_id (FK), user_id (FK), role, joined_at
  (Composite unique: project_id + user_id)
```

### Simulation Models
```
workloads:
  id, project_id (FK), name, description, file_path, created_by, created_at

platforms:
  id, project_id (FK), name, description, file_path, cores, created_by, created_at

scenarios:
  id, project_id (FK), name, workload_id (FK), platform_id (FK), created_by, created_at

strategies:
  id, project_id (FK), name, description, file_path, created_by, created_at

experiments:
  id, project_id (FK), scenario_id (FK), strategy_id (FK), status, container_id,
  start_time, end_time, created_by, created_at

results:
  id, experiment_id (FK), schedule_data, metrics, storage_path, created_at
```

### Phase 8 Audit & Collaboration Models
```
audit_logs:
  id, user_id (FK), action, entity_type, entity_id, entity_name,
  project_id (FK), changes (JSON), ip_address, user_agent, created_at
  Indexes: (created_at), (user_id, created_at), (entity_type, entity_id)

comments:
  id, entity_type, entity_id, parent_id (FK, self-referencing),
  thread_level (0-2), content, user_id (FK), is_deleted,
  created_at, updated_at
  Indexes: (entity_type, entity_id), (parent_id)
```

## API Endpoints

### Authentication (auth.py)
- POST `/api/auth/register` - User registration
- POST `/api/auth/login` - JWT login
- GET `/api/auth/me` - Current user info
- POST `/api/auth/refresh` - Token refresh

### Projects (projects.py)
- GET, POST `/api/projects`
- GET, PUT, DELETE `/api/projects/{id}`
- GET, POST `/api/projects/{id}/members`

### Workloads (workloads.py)
- GET, POST `/api/workloads` (with file upload)
- GET, DELETE `/api/workloads/{id}`

### Platforms (platforms.py)
- GET, POST `/api/platforms` (with file upload)
- GET, DELETE `/api/platforms/{id}`

### Scenarios (scenarios.py)
- GET, POST `/api/scenarios`
- GET, DELETE `/api/scenarios/{id}`

### Strategies (strategies.py)
- GET, POST `/api/strategies` (with file upload)
- GET, DELETE `/api/strategies/{id}`

### Experiments (experiments.py)
- GET, POST `/api/experiments`
- GET, PUT, DELETE `/api/experiments/{id}`
- POST `/api/experiments/{id}/start`, `/pause`, `/resume`, `/stop`

### Results (results.py)
- GET, POST `/api/results`
- GET `/api/results/{id}`

### Audit Logs (audit.py)
- GET `/api/audit` - List with pagination & RBAC
- GET `/api/audit/entity/{type}/{id}` - Entity history

### Comments (comments.py)
- POST `/api/comments` - Create comment/reply
- GET `/api/comments` - Flat list
- GET `/api/comments/threaded` - Threaded structure
- PUT, DELETE `/api/comments/{id}`

### System (system.py)
- GET `/api/system/status` - Health check
- GET `/api/system/metrics` - CPU, memory, disk

### Grafana Integration (grafana.py)
- GET `/api/grafana/dashboards` - Available dashboards
- Embedded dashboard support

### WebSocket (websocket.py)
- WS `/ws/experiments/{experiment_id}` - Real-time experiment updates

## Security Features

### Authentication & Authorization
- **JWT-based authentication** with refresh tokens
- **Role-based access control (RBAC)**
  - Admin: Full access to all resources
  - User: Access own projects + shared resources
- **Password hashing** with bcrypt
- **CORS configuration** for frontend integration

### Audit & Compliance
- **Comprehensive audit logging** (CREATE, UPDATE, DELETE, START, STOP, PAUSE, RESUME)
- **PII masking** for sensitive fields
- **IP address & User-Agent capture** for security events
- **Entity-level audit history** for compliance tracking

### Data Protection
- **Soft delete comments** to preserve thread integrity
- **Request validation** with Pydantic schemas
- **File upload validation** and storage isolation
- **RBAC audit filtering** (admins see all, users see own + project logs)

## UI Components

### Pages (12 Main Pages)
1. **LoginPage** - Authentication with JWT
2. **DashboardPage** - Overview with analytics gadgets
3. **ProjectsPage** - Project CRUD management
4. **WorkloadsPage** - Workload management with file upload
5. **PlatformsPage** - Platform configuration with file upload
6. **ScenariosPage** - Scenario creation from workloads + platforms
7. **StrategiesPage** - Strategy upload and management
8. **ExperimentsPage** - Experiment creation and control (start/stop/pause/resume)
9. **SimulationPage** - Real-time simulation monitoring
10. **ResultsPage** - Results storage and analysis
11. **AnalyticsPage** - Charts and comparative analysis
12. **MonitoringPage** - System metrics and Grafana dashboards

### Components
- **Layout.tsx** - Main navigation layout with auth state
- **ActivityFeed.tsx** - Audit log display with action icons (NEW - Phase 8)
- **CommentSection.tsx** - Threaded comments UI (NEW - Phase 8)
- **Analytics Components** - Bar/Line/Doughnut charts, Job distribution, Results trends, Strategy comparison
- **Monitoring Components** - Live log viewer, Realtime progress charts, Experiment comparison
- **GrafanaEmbed.tsx** - Embedded dashboard viewer
- **PredictionConfig.tsx** - ML prediction configuration

### Hooks
- **useExperimentStatus.ts** - Experiment status polling/WebSocket
- **useWebSocket.ts** - Generic WebSocket connection management

## File Upload & Storage

### Supported File Types
- **Workloads:** JSON batch job traces
- **Platforms:** XML cluster descriptions
- **Strategies:** Python scheduling algorithm files

### Storage
- Backend: `backend/storage/` directory
- File isolation by project and entity type
- Download endpoints with content-type detection

## Real-Time Features

### WebSocket Integration
- `/ws/experiments/{experiment_id}` endpoint
- Real-time experiment status updates
- Job progress and metrics streaming
- Message queue for broadcast updates

### Activity Feed
- Automatic audit log polling or WebSocket push
- Real-time action icons and colors
- Relative timestamp updates

## Key Services

### Simulation Service (`simulation_service.py`)
- Experiment lifecycle management (create, start, stop, pause, resume)
- Container orchestration via Docker SDK
- Status tracking and metric collection
- Error handling and recovery

### Docker Service (`docker_service.py`)
- BatSim container image management
- PyBatsim scheduler container setup
- Environment variable injection
- Volume mounting for file access

### Audit Service (`audit_service.py`)
- Audit log creation and filtering
- PII masking for sensitive fields
- Field-level change tracking
- RBAC-aware log visibility

### Grafana Service (`grafana_service.py`)
- Dashboard provisioning
- Metric data integration
- Embedded dashboard links

### Prediction Service (`prediction_service.py`)
- ML model integration for scheduling prediction
- Historical data analysis
- Prediction accuracy tracking

### WebSocket Bridge (`ws_bridge.py`)
- Connection management
- Message routing and broadcasting
- Channel-based subscriptions

## Database Indexes

### Performance Optimization
- **audit_logs:** 3 indexes on (created_at), (user_id, created_at), (entity_type, entity_id)
- **comments:** 2 indexes on (entity_type, entity_id), (parent_id)
- **experiments:** Status, project_id, created_at for common queries
- **users:** username, email for login queries

## Monitoring & Observability

### Prometheus Metrics
- API request duration and counts
- Database query performance
- Container resource usage
- Experiment execution metrics

### Grafana Dashboards
1. **Experiment Dashboard** - Experiment status, job distribution, execution timeline
2. **API Metrics Dashboard** - Request rates, latencies, error rates

### Health Checks
- GET `/api/system/status` - Overall system status
- GET `/api/system/metrics` - CPU, memory, disk usage

## Development Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Docker Deployment
```bash
docker-compose up -d
# API: http://localhost:8000
# Frontend: http://localhost:3000
```

## Testing Strategy

### Backend
- Unit tests for services (audit, docker, simulation)
- Integration tests for API endpoints
- Database migration tests
- Container management tests

### Frontend
- Component unit tests with Vitest
- Integration tests with React Testing Library
- E2E tests with Playwright (planned)

## Performance Considerations

1. **Cursor-based pagination** for audit logs (avoids offset limitations)
2. **Database indexes** on frequently queried columns
3. **Frontend lazy loading** for pages and components
4. **Vite build optimization** for minimal bundle size
5. **Zustand state management** for minimal re-renders
6. **Connection pooling** for database queries
7. **Soft delete comments** to avoid data loss in threads

## Known Limitations & Future Work

### Limitations
- Maximum comment thread depth: 3 levels
- Audit log cursor pagination (no total count after first page)
- Single container orchestration (no clustering)

### Planned Features
- Advanced analytics with ML predictions
- Batch scheduling optimization
- Real-time collaboration cursors
- Export to multiple formats (CSV, PDF)
- Email notifications for experiment completion
- API rate limiting and quota management
- Multi-language support

## File Organization

### Key Configuration Files
- **docker-compose.yml** - Service orchestration
- **frontend/tsconfig.json** - TypeScript strict mode
- **frontend/vite.config.ts** - Build optimization
- **backend/app/core/config.py** - Environment configuration
- **monitoring/prometheus/prometheus.yml** - Metrics scraping
- **monitoring/grafana/provisioning/** - Dashboard provisioning

### Sample Data
- **samples/workloads/** - Example job traces
- **samples/platforms/** - Example cluster descriptions
- **samples/strategies/** - Example scheduling algorithms
- **samples/results/** - Example output files

## Recent Updates (Phase 8)

1. Added comprehensive audit logging system with PII masking
2. Implemented threaded comments for collaboration (max 3 levels)
3. Created ActivityFeed and CommentSection components
4. Added RBAC filtering for audit logs
5. Integrated entity-level audit history endpoints
6. Added cursor-based pagination for performance
7. Soft delete support for comment threads
8. Phase 8 marked as complete
