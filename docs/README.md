# BatSim Web Portal - Documentation

Welcome to the BatSim Web Portal documentation. This directory contains comprehensive technical and project documentation for developers, architects, and stakeholders.

## Quick Navigation

### For Getting Started
- **New to the project?** Start with [Codebase Summary](./codebase-summary.md)
- **Want to contribute?** Read [Code Standards](./code-standards.md)
- **Need architecture overview?** See [System Architecture](./system-architecture.md)

### For Project Planning
- **Understanding scope?** Check [Project Overview & PDR](./project-overview-pdr.md)
- **What's coming next?** Review [Development Roadmap](./development-roadmap.md)
- **Status report?** See [Documentation Update Summary](./DOCUMENTATION_UPDATE_SUMMARY.md)

## Documentation Files

| File | Purpose | Audience |
|------|---------|----------|
| [system-architecture.md](./system-architecture.md) | Complete system design, state machine, services, API structure | Architects, senior developers |
| [codebase-summary.md](./codebase-summary.md) | Code organization, models, services, dependencies, metrics | All developers, new team members |
| [project-overview-pdr.md](./project-overview-pdr.md) | Requirements, acceptance criteria, technical decisions, roadmap | Product managers, architects |
| [code-standards.md](./code-standards.md) | Coding conventions, patterns, best practices, style guide | All developers, code reviewers |
| [development-roadmap.md](./development-roadmap.md) | Phase timeline, features by phase, resource planning | Product managers, team leads |
| [DOCUMENTATION_UPDATE_SUMMARY.md](./DOCUMENTATION_UPDATE_SUMMARY.md) | What was documented, verification, maintenance plan | Documentation reviewers |

## Project Status

**Current Phase:** Phase 2 - Scenario Builder & Experiment Lifecycle ✅ Complete
**Last Updated:** March 24, 2026
**Next Phase:** Phase 3 - Container Orchestration (Q2 2026)

## Key Features Documented

### Phase 2 (Complete ✅)
- Scenario builder with version tracking
- Experiment lifecycle state machine
- Queue management with concurrency control
- Frozen configuration snapshots
- File management and security
- Database migrations
- Frontend enhancements (QUEUED badge, frozen config display)

### Planned Phases
- **Phase 3:** Container orchestration with Docker SDK
- **Phase 4:** Real-time monitoring via WebSocket
- **Phase 5:** Advanced analytics and comparative analysis
- **Phase 6:** Performance optimization and scaling

## How to Use This Documentation

### As a Developer
1. Review [Code Standards](./code-standards.md) for style and patterns
2. Check [Codebase Summary](./codebase-summary.md) for file locations
3. Reference [System Architecture](./system-architecture.md) for module interactions
4. Commit code following [Code Standards](./code-standards.md)

### As an Architect
1. Start with [System Architecture](./system-architecture.md) for overview
2. Review [Project Overview & PDR](./project-overview-pdr.md) for requirements
3. Check [Codebase Summary](./codebase-summary.md) for implementation details
4. Plan using [Development Roadmap](./development-roadmap.md)

### As a Project Manager
1. Read [Project Overview & PDR](./project-overview-pdr.md) for scope and requirements
2. Review [Development Roadmap](./development-roadmap.md) for timeline and planning
3. Check [DOCUMENTATION_UPDATE_SUMMARY.md](./DOCUMENTATION_UPDATE_SUMMARY.md) for completion status

### As a Team Lead
1. Use [Development Roadmap](./development-roadmap.md) for resource planning
2. Reference [Code Standards](./code-standards.md) for quality gates
3. Check [System Architecture](./system-architecture.md) for design review
4. Monitor via [Codebase Summary](./codebase-summary.md)

## Technology Stack

**Frontend:**
- React 19 + TypeScript
- Material-UI (MUI)
- Zustand (state management)
- Axios (HTTP client)
- Vite (build tool)

**Backend:**
- FastAPI (Python web framework)
- SQLAlchemy (ORM)
- Pydantic (validation)
- SQLite / PostgreSQL (database)
- JWT (authentication)

## API Documentation

- **Swagger UI:** Available at `http://localhost:8000/docs`
- **ReDoc:** Available at `http://localhost:8000/redoc`
- **OpenAPI Spec:** Generated automatically by FastAPI

For API details, start with [System Architecture](./system-architecture.md) API sections.

## Development Setup

See project [README.md](../README.md) for setup instructions.

### Quick Start
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Code Quality

- **Type Safety:** TypeScript (frontend) and type hints (backend) required
- **Testing:** Unit tests for services, component tests recommended
- **Linting:** ESLint (frontend), Pylint (backend)
- **Formatting:** Prettier (frontend), Black (backend optional)

See [Code Standards](./code-standards.md) for details.

## Security

Security considerations are documented in:
- [System Architecture](./system-architecture.md) — Security section
- [Code Standards](./code-standards.md) — Security guidelines section
- [Project Overview & PDR](./project-overview-pdr.md) — Security requirements

Key principles:
- Path traversal validation
- State machine enforcement
- JWT authentication
- Input validation via Pydantic
- CORS configuration

## Performance

Performance guidelines in [Code Standards](./code-standards.md):
- Database optimization
- API response times (< 1s target)
- Concurrent execution limits
- Caching strategies

## Testing

Testing strategies documented in [Development Roadmap](./development-roadmap.md):
- Unit tests for services
- Integration tests for APIs
- Component tests for frontend
- Load and performance testing

## Deployment

- **Development:** Docker Compose with SQLite
- **Production:** Docker with PostgreSQL
- **Monitoring:** Prometheus and Grafana (optional)

See project [docker-compose.yml](../docker-compose.yml) and Dockerfiles.

## Troubleshooting

Common issues and solutions:
- Check log output from backend/frontend
- Verify database migrations with `main.py` migration logs
- See Phase 3+ documentation for container orchestration issues

## Version History

| Version | Date | Status | Phase |
|---------|------|--------|-------|
| 1.0.0-phase2 | 2026-03-24 | ✅ Complete | Phase 2 |
| 0.1.0-phase1 | 2026-02-28 | ✅ Complete | Phase 1 |

## Contributing

When contributing, ensure:
1. Code follows [Code Standards](./code-standards.md)
2. Changes documented in appropriate files
3. Tests pass
4. PR includes documentation updates (if applicable)

## Maintenance

Documents are maintained alongside code:
- Update during code changes
- Verify accuracy during code review
- Major updates in separate commits
- Keep synchronized with implementation

**Next major review:** After Phase 3 completion

## Getting Help

- **Code questions:** Reference [Code Standards](./code-standards.md)
- **Architecture questions:** Check [System Architecture](./system-architecture.md)
- **Feature scope:** See [Project Overview & PDR](./project-overview-pdr.md)
- **Timeline:** Review [Development Roadmap](./development-roadmap.md)
- **New to team:** Start with [Codebase Summary](./codebase-summary.md)

## Related Resources

- **Source Code:** `../backend/` and `../frontend/`
- **Configuration:** `../.env.example`
- **Docker Setup:** `../docker-compose.yml`
- **Issue Tracker:** [GitHub Issues]
- **CI/CD:** [GitHub Actions]

---

**Last Updated:** March 24, 2026
**Maintained By:** Engineering Team
**Status:** ✅ Current & Maintained

For documentation updates, see [DOCUMENTATION_UPDATE_SUMMARY.md](./DOCUMENTATION_UPDATE_SUMMARY.md).
