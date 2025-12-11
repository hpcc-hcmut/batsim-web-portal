# BatSim Web Portal - System Architecture

**Version:** Phase 8 (Audit & Collaboration)
**Last Updated:** December 2025

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  React 19 + TypeScript | MUI | Zustand | React Router      │
│  (Port 3000)                                                 │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ HTTP/WebSocket
                             │ (Axios, ws://)
                             │
┌────────────────────────────▼────────────────────────────────┐
│                       API Layer                              │
│  FastAPI | JWT Auth | CORS | OpenAPI Docs                  │
│  (Port 8000)                                                 │
│                                                              │
│  Routers:                                                    │
│  - auth.py        (Login, Register, JWT)                    │
│  - projects.py    (Project Management)                      │
│  - workloads.py   (Workload Upload/CRUD)                    │
│  - platforms.py   (Platform Upload/CRUD)                    │
│  - scenarios.py   (Scenario Management)                     │
│  - strategies.py  (Strategy Upload/CRUD)                    │
│  - experiments.py (Experiment Control)                      │
│  - results.py     (Results Storage)                         │
│  - audit.py       (Audit Logs - FR14)                       │
│  - comments.py    (Comments & Threads - FR15)               │
│  - websocket.py   (Real-time Updates)                       │
│  - system.py      (Health & Metrics)                        │
│  - grafana.py     (Dashboard Integration)                   │
│  - predictions.py (ML Predictions)                          │
└────────────────────────────┬────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Database   │    │   File Store │    │   Docker     │
│              │    │              │    │              │
│  SQLAlchemy  │    │  backend/    │    │  BatSim      │
│  SQLite/     │    │  storage/    │    │  PyBatsim    │
│  PostgreSQL  │    │              │    │  Containers  │
│              │    │  Workloads   │    │              │
│  12 Models   │    │  Platforms   │    │  Docker SDK  │
│  with        │    │  Strategies  │    │              │
│  Indexes     │    │  Results     │    │              │
│              │    │              │    │              │
│  + Audit &   │    │              │    │              │
│  Comments    │    │              │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
                             │                    │
        ┌────────────────────┼────────────────────┘
        │                    │
        ▼                    ▼
┌──────────────┐    ┌──────────────┐
│ Prometheus   │    │   Grafana    │
│              │    │              │
│  Metrics     │    │  Dashboards  │
│  Collection  │    │  Monitoring  │
│              │    │              │
│  2 Public    │    │  Experiment  │
│  Dashboards  │    │  API Metrics │
└──────────────┘    └──────────────┘
```

## Phase 8: Audit & Collaboration Architecture

### Audit Logging System (FR14)

```
User Action (Create/Update/Delete/etc)
    │
    ▼
API Endpoint Handler
    │
    ▼
Entity Modification (Service Layer)
    │
    ▼
audit_service.log_audit()
    │
    ├─ mask_sensitive_data(changes)  [PII Protection]
    │
    ├─ compute_changes(old, new)     [Field-level diff]
    │
    └─ AuditLog(
         user_id, action, entity_type, entity_id,
         entity_name, project_id, changes (JSON),
         ip_address, user_agent, created_at
       )
    │
    ▼
Database (audit_logs table with 3 indexes)
    │
    ├─ Index 1: (created_at) DESC
    ├─ Index 2: (user_id, created_at)
    └─ Index 3: (entity_type, entity_id)
    │
    ▼
Audit API Endpoints
    │
    ├─ GET /api/audit (with cursor pagination & RBAC)
    │
    └─ GET /api/audit/entity/{type}/{id} (Entity history)
    │
    ▼
Frontend (ActivityFeed Component)
    │
    ├─ Load logs with filters
    ├─ Display with action icons
    ├─ Show relative timestamps
    └─ Support pagination

RBAC Filtering:
- Admin:  See all logs
- User:   See own actions + project logs (if member)
```

### Collaboration System (FR15)

```
Threaded Comments Architecture
────────────────────────────────

Root Comment (thread_level = 0)
    │
    ├─ Reply 1 (thread_level = 1)
    │   └─ Reply 1.1 (thread_level = 2)
    │       └─ Reply 1.1.1 (thread_level = 3)  [MAX DEPTH]
    │
    ├─ Reply 2 (thread_level = 1)
    │   └─ Reply 2.1 (thread_level = 2)
    │
    └─ Reply 3 (thread_level = 1)

Adjacency List Pattern (Self-Referencing FK):
─────────────────────────────────────────────
comments table:
  id | entity_type | entity_id | parent_id | thread_level | content | user_id | is_deleted | created_at | updated_at
  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  1  | experiment  | 42        | NULL      | 0            | "..."   | 5      | false      | ...        | ...
  2  | experiment  | 42        | 1         | 1            | "..."   | 3      | false      | ...        | ...
  3  | experiment  | 42        | 2         | 2            | "..."   | 7      | false      | ...        | ...
  4  | experiment  | 42        | 1         | 1            | "..."   | 6      | true       | ...        | ...

Soft Delete Benefit:
- Preserves thread structure
- Users see "[deleted]" for removed comments
- Maintains reference integrity

API Endpoints:
- POST   /api/comments           (Create comment/reply)
- GET    /api/comments           (Flat list)
- GET    /api/comments/threaded  (Threaded structure)
- PUT    /api/comments/{id}      (Update)
- DELETE /api/comments/{id}      (Soft delete)

Frontend Components:
- CommentSection.tsx
  ├─ Display threaded comments
  ├─ Create new comments
  ├─ Reply to specific comments
  ├─ Expand/collapse threads
  └─ Delete/edit operations
```

## Data Flow

### Experiment Execution Flow

```
1. User creates experiment
   POST /api/experiments
   └─> Backend validates scenario, strategy
   └─> Audit log: CREATE experiment
   └─> Frontend refreshes experiments list

2. User starts experiment
   POST /api/experiments/{id}/start
   └─> Backend verifies permissions
   └─> Docker service creates BatSim container
   └─> WebSocket connection established
   └─> Audit log: START experiment
   └─> Frontend switches to monitoring view

3. Real-time monitoring
   WS /ws/experiments/{id}
   └─> Backend polls container metrics
   └─> Sends job progress updates
   └─> Sends status changes
   └─> Frontend displays in real-time chart

4. Experiment stops (manual or completed)
   └─> Docker container cleanup
   └─> Result data stored in database
   └─> Prometheus metrics collected
   └─> Audit log: STOP experiment
   └─> Frontend shows results

5. Analytics & sharing
   GET /api/results/{id}
   └─> Display charts and metrics
   └─> POST /api/comments (Share insights)
   └─> Activity feed shows all updates
```

### Project Collaboration Flow

```
1. Project owner invites members
   POST /api/projects/{id}/members
   └─> Audit log: UPDATE project
   └─> Member gains access to resources

2. Team creates & uploads resources
   POST /api/workloads (with file)
   └─> Audit log: CREATE workload
   └─> File stored in backend/storage/

3. Shared scenario creation
   POST /api/scenarios
   └─> Audit log: CREATE scenario
   └─> Visible to all project members

4. Experiment execution & discussion
   POST /api/comments (on experiment)
   ├─ Root comment (observation)
   └─ Nested replies (discussion)
   └─ All captured in ActivityFeed

5. Compliance & audit
   GET /api/audit/entity/experiment/{id}
   └─> Full history of changes
   └─ IP addresses tracked
   └─ All user actions logged
```

## Database Schema Details

### Core Tables

#### users
```
users
├─ id (PK)
├─ username (UNIQUE)
├─ email (UNIQUE)
├─ hashed_password
├─ role (admin | user)
├─ created_at
├─ relationships: project_members, comments, audit_logs
```

#### projects
```
projects
├─ id (PK)
├─ name
├─ description
├─ created_by (FK users.id)
├─ created_at
├─ updated_at
├─ relationships: project_members, workloads, platforms, scenarios, strategies, experiments, audit_logs
```

#### project_members
```
project_members
├─ id (PK)
├─ project_id (FK projects.id)
├─ user_id (FK users.id)
├─ role
├─ joined_at
├─ UNIQUE (project_id, user_id)
```

#### Phase 8: Audit & Comments

#### audit_logs (NEW in Phase 8)
```
audit_logs
├─ id (PK)
├─ user_id (FK users.id)
├─ action (CREATE|UPDATE|DELETE|START|STOP|PAUSE|RESUME)
├─ entity_type (workload|platform|experiment|scenario|strategy|project)
├─ entity_id (references entity table)
├─ entity_name (snapshot at action time)
├─ project_id (FK projects.id)
├─ changes (JSON text: {"field": {"old": x, "new": y}})
├─ ip_address (for security audit)
├─ user_agent
├─ created_at
├─ INDEX (created_at DESC)
├─ INDEX (user_id, created_at)
├─ INDEX (entity_type, entity_id)
```

#### comments (NEW in Phase 8)
```
comments
├─ id (PK)
├─ entity_type (experiment|scenario|project)
├─ entity_id (references entity table)
├─ parent_id (FK comments.id, self-referencing, NULL for roots)
├─ thread_level (0-3)
├─ content
├─ user_id (FK users.id)
├─ is_deleted (soft delete)
├─ created_at
├─ updated_at
├─ INDEX (entity_type, entity_id)
├─ INDEX (parent_id)
```

## Security Architecture

### Authentication Layer
```
User Credentials (Login Page)
    │
    ▼
POST /api/auth/login
    │
    ├─ Hash password with bcrypt
    ├─ Compare with stored hash
    │
    ▼
Generate JWT Token
    ├─ Header: {"alg": "HS256"}
    ├─ Payload: {user_id, username, role, exp}
    ├─ Signature: SECRET_KEY
    │
    ▼
Return Token to Frontend
    │
    ▼
Store in LocalStorage / Memory
    │
    ▼
Include in Authorization Header
    Authorization: Bearer <token>
    │
    ▼
Verify on each API request
    ├─ Decode and validate signature
    ├─ Check expiration
    ├─ Extract user_id and role
    │
    ▼
Grant/Deny Access
```

### RBAC (Role-Based Access Control)
```
Resource Access Matrix:
─────────────────────────────────────────────────────────────
Resource          │  Admin  │  User  │  Other User
─────────────────────────────────────────────────────────────
Own project       │  YES    │  YES   │  NO (unless member)
Other project     │  YES    │  NO    │  NO
Audit logs        │  YES*   │  Own   │  NO
Comments          │  YES    │  Own   │  YES (read all)
User management   │  YES    │  NO    │  NO

*Admins: See all logs
 Users: See own actions + project logs if member
```

### PII Masking in Audit Logs
```
Masked Fields: {password, hashed_password, token, api_key, secret, credit_card}

Example:
Before: {"password": {"old": "mypass123", "new": "newpass456"}}
After:  {"password": {"old": "***", "new": "***"}}

Recursive masking for nested objects.
```

## Performance Considerations

### Database Optimization
```
Query Patterns & Indexes:
─────────────────────────────────
1. List audit logs (most recent)
   SELECT * FROM audit_logs ORDER BY created_at DESC
   └─ INDEX: (created_at DESC)

2. User's audit logs
   SELECT * FROM audit_logs WHERE user_id = ? AND created_at < ?
   └─ INDEX: (user_id, created_at)

3. Entity history
   SELECT * FROM audit_logs WHERE entity_type = ? AND entity_id = ?
   └─ INDEX: (entity_type, entity_id)

4. Get comment threads
   SELECT * FROM comments WHERE entity_type = ? AND entity_id = ? AND parent_id IS NULL
   └─ INDEX: (entity_type, entity_id)

5. Get replies to comment
   SELECT * FROM comments WHERE parent_id = ?
   └─ INDEX: (parent_id)
```

### Pagination Strategy
```
Cursor-Based Pagination (Audit Logs):
──────────────────────────────────────
- No OFFSET (avoids scanning skipped rows)
- Uses timestamp cursor: created_at < cursor_dt
- Fetches limit + 1 to detect has_more
- Return next_cursor for subsequent requests

Benefits:
├─ O(1) complexity vs OFFSET O(n)
├─ Works with real-time data (new inserts)
└─ More scalable for large datasets
```

### Caching Strategies
```
Frontend (Zustand):
├─ Auth state (user, token, role)
├─ Experiment status cache
└─ Recent comments cache

Backend:
├─ User lookups (in-memory during request)
└─ Role-based filters (query-time)

Future:
├─ Redis for session management
├─ Dashboard cache (5-minute TTL)
└─ Experiment status cache (WebSocket updates)
```

## Deployment Architecture

### Docker Compose Stack
```
docker-compose up -d
│
├─ frontend (Node.js dev server + Vite)
│  └─ Port 3000 → http://localhost:3000
│
├─ backend (FastAPI + Uvicorn)
│  └─ Port 8000 → http://localhost:8000/docs
│
├─ database (SQLite in volume / PostgreSQL)
│  └─ Persistent storage
│
├─ prometheus (Metrics collection)
│  └─ Port 9090 → http://localhost:9090
│
└─ grafana (Dashboard visualization)
   └─ Port 3001 → http://localhost:3001
      (Dashboards: Experiment, API Metrics)
```

### File Structure in Container
```
backend container:
  /app/
  ├─ app/                    (Application code)
  │  ├─ api/                (Router modules)
  │  ├─ models/             (SQLAlchemy models)
  │  ├─ schemas/            (Pydantic schemas)
  │  ├─ services/           (Business logic)
  │  └─ core/               (Config, DB, Security)
  ├─ storage/               (File uploads)
  │  ├─ workloads/
  │  ├─ platforms/
  │  ├─ strategies/
  │  └─ results/
  └─ main.py                (Application entry)

frontend container:
  /app/
  ├─ src/
  │  ├─ components/         (React components)
  │  ├─ pages/              (Page components)
  │  ├─ services/           (API client)
  │  ├─ store/              (Zustand state)
  │  └─ hooks/              (Custom hooks)
  └─ package.json
```

## Integration Points

### External Services
```
1. BatSim Container (Docker)
   ├─ Input: Workload JSON, Platform XML
   ├─ Process: Job scheduling simulation
   └─ Output: Schedule CSV, Results JSON

2. PyBatsim Container (Docker)
   ├─ Input: Strategy Python file
   ├─ Process: Custom scheduling logic
   └─ Output: Schedule results

3. Prometheus (Metrics)
   ├─ Scrape: /metrics endpoint
   ├─ Store: Time-series data
   └─ Retention: 15 days (default)

4. Grafana (Visualization)
   ├─ Data source: Prometheus
   ├─ Dashboards: Experiment, API Metrics
   └─ Embed: Dashboard links in web portal
```

### WebSocket Protocol
```
Connection: ws://backend:8000/ws/experiments/{experiment_id}

Message Format (JSON):
{
  "type": "status|progress|error|metric",
  "data": {
    "status": "running|completed|failed",
    "progress": 45,
    "jobs_completed": 1250,
    "jobs_total": 2500,
    "cpu": 85.5,
    "memory": 2.3,
    "timestamp": "2025-12-11T10:30:00Z"
  }
}

Events:
├─ connection_open: Subscription successful
├─ status_change: Experiment status changed
├─ progress_update: Job progress changed
├─ metric_update: CPU/memory metrics
└─ error: Container error or failure
```

## Monitoring & Observability

### Key Metrics
```
Prometheus Metrics (Scraped from /metrics):
──────────────────────────────────────────
API Metrics:
├─ http_request_duration_seconds (histogram)
├─ http_requests_total (counter)
└─ http_request_exceptions_total (counter)

Database Metrics:
├─ db_query_duration_seconds
├─ db_connection_pool_size
└─ db_active_connections

Application Metrics:
├─ audit_logs_created_total
├─ comments_created_total
├─ experiments_status (gauge)
└─ experiments_duration_seconds (histogram)

System Metrics:
├─ system_cpu_percent
├─ system_memory_percent
└─ system_disk_percent
```

### Grafana Dashboards (Phase 8)
```
Experiment Dashboard:
├─ Experiment timeline (Gantt-style)
├─ Job distribution (Pie/Bar chart)
├─ Execution status (Running/Completed/Failed)
├─ Resource usage (CPU, Memory)
└─ Recent experiments (List)

API Metrics Dashboard:
├─ Request rate (Requests/sec)
├─ Latency (P50, P95, P99)
├─ Error rate (%)
├─ Top endpoints (by volume)
└─ Response time distribution
```

## Scalability Roadmap

### Short Term (Phase 9)
```
├─ Add Redis for session management
├─ Implement query result caching
├─ Add database connection pooling
└─ Optimize audit log pagination
```

### Medium Term (Phase 10)
```
├─ Horizontal scaling with load balancer
├─ Database replication (Primary-Replica)
├─ Kafka for event streaming
├─ Async task queue (Celery)
└─ Object storage (S3) for files
```

### Long Term (Phase 11+)
```
├─ Microservices architecture
├─ GraphQL API for flexible queries
├─ Real-time collaboration (CRDT)
├─ Multi-region deployment
└─ Advanced ML-based scheduling
```
