# Code Standards & Conventions

## Overview

This document defines coding standards, architectural patterns, and best practices for BatSim Web Portal. All contributors should follow these guidelines to maintain code quality, readability, and maintainability.

## Principles

1. **YAGNI** (You Aren't Gonna Need It) — Only implement what is needed
2. **KISS** (Keep It Simple, Stupid) — Favor simplicity over cleverness
3. **DRY** (Don't Repeat Yourself) — Avoid duplication; extract common code
4. **Type Safety** — Use types to catch errors at compile/write time
5. **Clarity** — Write code for humans first; machines second

## Backend Standards (Python)

### File Organization

**Naming Conventions:**
- File names: `snake_case.py`
- Module names: descriptive, lowercase, max 50 chars
- Directory structure: logical grouping by feature/responsibility

**Example Structure:**
```
backend/app/
├── api/
│   ├── __init__.py
│   ├── auth.py
│   ├── experiments.py
│   └── ...
├── services/
│   ├── experiment_bundle_service.py
│   ├── experiment_queue_service.py
│   └── ...
├── models/
│   ├── experiment.py
│   └── ...
```

**File Size Guideline:** Keep Python files under 400 lines; consider splitting at 300+ lines.

### Code Style

**Formatting:**
- 4-space indentation (never tabs)
- Max line length: 100 characters (align with FastAPI standards)
- Use Black formatter for consistency (if available)

**Naming Conventions:**
```python
# Classes: PascalCase
class ExperimentBundleService:
    pass

# Functions/methods: snake_case
def freeze_experiment_config(...):
    pass

# Constants: UPPER_SNAKE_CASE
MAX_CONCURRENT_SIMULATIONS = 2

# Private functions/methods: leading underscore
def _internal_helper():
    pass

# Variables: snake_case
experiment_id = 123
config_data = {}
```

### Type Hints

**Mandatory for:**
- All function parameters
- All function return types
- Class attributes (where applicable)

**Examples:**
```python
def freeze_experiment_config(
    db: Session,
    experiment_id: int,
    scenario_id: int,
    strategy_id: int,
    seed: int | None = None,
    params: dict | None = None,
) -> dict:
    """Freeze experiment config and return immutable snapshot.

    Args:
        db: Database session.
        experiment_id: Experiment ID (for directory naming).
        scenario_id: Scenario ID to validate.
        strategy_id: Strategy ID to validate.
        seed: Random seed (optional).
        params: Additional params (optional).

    Returns:
        Frozen config dict with versions and file paths.

    Raises:
        ValueError: If scenario/strategy not found or files invalid.
    """
```

**Use Modern Syntax:**
```python
# Good: Python 3.10+ union syntax
def process(value: int | str | None) -> dict | list:
    pass

# Also acceptable: typing.Union (for older Python)
from typing import Union
def process(value: Union[int, str, None]) -> Union[dict, list]:
    pass
```

### Docstrings

**Style:** Google/NumPy style docstrings

**For Functions:**
```python
def enqueue_experiment(db: Session, experiment_id: int) -> Experiment:
    """Transition experiment from PENDING to QUEUED status.

    Args:
        db: SQLAlchemy database session.
        experiment_id: ID of experiment to enqueue.

    Returns:
        Updated Experiment object with QUEUED status.

    Raises:
        ValueError: If experiment not found.
        InvalidTransitionError: If current status cannot transition to QUEUED.
    """
```

**For Classes:**
```python
class ExperimentQueueService:
    """Manages experiment state transitions and concurrent execution.

    Handles PENDING→QUEUED→RUNNING state machine with FIFO queue ordering
    and concurrent slot management.
    """
```

**For Modules:**
```
"""Experiment queue service — manages state transitions and concurrency.

State machine:
  PENDING → QUEUED (user clicks Run)
  QUEUED → RUNNING (slot available, worker picks up)
  RUNNING → COMPLETED | FAILED | CANCELLED
"""
```

### Error Handling

**Specific Exceptions:**
```python
# Good: Specific exception type
if not scenario:
    raise ValueError(f"Scenario {scenario_id} not found")

# Avoid: Bare except or generic Exception
try:
    process()
except:  # BAD: Never do this
    pass

# Better: Catch specific exceptions
try:
    process()
except ValueError as e:
    logger.error(f"Invalid input: {e}")
    raise HTTPException(status_code=400, detail=str(e))
except FileNotFoundError:
    logger.error("File not found")
    raise HTTPException(status_code=404, detail="File not found")
```

**FastAPI Error Responses:**
```python
from fastapi import HTTPException

# Use appropriate status codes
if not experiment:
    raise HTTPException(status_code=404, detail="Experiment not found")

if not authorized:
    raise HTTPException(status_code=403, detail="Not enough permissions")

if invalid_data:
    raise HTTPException(status_code=400, detail="Invalid data")
```

### Logging

**Use logging module:**
```python
import logging

logger = logging.getLogger(__name__)

# Log important state changes
logger.info(f"Experiment {experiment_id} enqueued")

# Log warnings for suspicious behavior
logger.warning(f"Invalid path detected: {path}")

# Log errors with context
logger.error(f"Failed to freeze config: {e}", exc_info=True)

# Debug for development
logger.debug(f"Config snapshot: {frozen_config}")
```

### Comments

**When to Comment:**
- Complex business logic (not obvious from code)
- Non-obvious algorithms
- Workarounds for bugs or limitations
- Important invariants or assumptions

**When NOT to Comment:**
- Self-explanatory code (good naming speaks for itself)
- Obvious type conversions
- Simple loops and conditionals

**Example:**
```python
# Good: Explains WHY, not WHAT
# Validate path is within storage root to prevent path traversal attacks
real_src = os.path.realpath(src)
if not real_src.startswith(storage_root + os.sep):
    raise ValueError("path is outside storage directory")

# Bad: Explains WHAT (code already does this)
# Get the real path
real_src = os.path.realpath(src)
```

### SQLAlchemy & Database

**Model Definition:**
```python
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base

class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    status = Column(Enum(ExperimentStatus), default=ExperimentStatus.PENDING)
    frozen_config = Column(Text)  # Immutable JSON snapshot
    seed = Column(Integer)
    params = Column(Text)

    # Relationships
    scenario = relationship("Scenario", back_populates="experiments")
```

**Query Patterns:**
```python
# Use filter() for conditions
exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()

# Use multiple filters for AND conditions
exps = db.query(Experiment).filter(
    Experiment.status == ExperimentStatus.QUEUED,
    Experiment.created_at > cutoff_time
).all()

# Always check for None
if exp is None:
    raise ValueError(f"Experiment {experiment_id} not found")
```

### Pydantic Schemas

**Definition:**
```python
from pydantic import BaseModel, Field

class ExperimentCreate(BaseModel):
    name: str
    description: str | None = None
    scenario_id: int
    strategy_id: int
    seed: int | None = None
    params: dict | None = Field(default=None)
    config: dict | None = None

class ExperimentSchema(BaseModel):
    id: int
    name: str
    status: str  # Or ExperimentStatus enum
    frozen_config: str | None = None
    seed: int | None = None
    params: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True  # For ORM model conversion

class ExperimentWithDetails(ExperimentSchema):
    scenario_name: str | None = None
    strategy_name: str | None = None
    creator_username: str | None = None
```

### API Route Patterns

**Consistent Endpoint Design:**
```python
@router.get("/", response_model=List[ExperimentSchema])
def list_experiments(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all experiments with pagination."""
    return db.query(Experiment).offset(skip).limit(limit).all()

@router.post("/", response_model=ExperimentSchema)
def create_experiment(
    experiment_create: ExperimentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new experiment."""
    # Implementation...

@router.get("/{experiment_id}", response_model=ExperimentSchema)
def get_experiment(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific experiment by ID."""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return exp

@router.delete("/{experiment_id}")
def delete_experiment(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an experiment."""
    # Cleanup logic...
```

## Frontend Standards (TypeScript/React)

### File Organization

**Naming Conventions:**
- Component files: `PascalCase.tsx`
- Utility/service files: `kebab-case.ts`
- Max 250 lines per component; split larger components

**Directory Structure:**
```
frontend/src/
├── pages/
│   ├── ExperimentsPage.tsx
│   ├── WorkloadsPage.tsx
│   └── ...
├── components/
│   ├── Layout.tsx
│   ├── ValidationErrorPanel.tsx
│   └── ...
├── services/
│   └── api.ts
├── store/
│   └── authStore.ts
└── utils/
    └── helpers.ts
```

### TypeScript Configuration

**Required Settings in tsconfig.json:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "target": "ES2020"
  }
}
```

### Type Definitions

**No `any` types without justification:**
```typescript
// Bad: Uses any
function processData(data: any) {
    return data.value;
}

// Good: Proper types
interface DataInput {
    value: string;
    count: number;
}

function processData(data: DataInput): string {
    return data.value;
}
```

**Interfaces for Objects:**
```typescript
interface Experiment {
    id: number;
    name: string;
    status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    frozen_config?: string;
    seed?: number;
    params?: string;
    created_at: string;
}

interface ExperimentCreate {
    name: string;
    scenario_id: number;
    strategy_id: number;
    seed?: number;
    params?: Record<string, unknown>;
}
```

**Enums for Constants:**
```typescript
enum ExperimentStatus {
    PENDING = 'pending',
    QUEUED = 'queued',
    RUNNING = 'running',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELLED = 'cancelled',
}
```

### React Components

**Functional Components with Hooks:**
```typescript
interface ExperimentsPageProps {
    onExperimentCreated?: (experiment: Experiment) => void;
}

export const ExperimentsPage: React.FC<ExperimentsPageProps> = ({
    onExperimentCreated,
}) => {
    const [experiments, setExperiments] = React.useState<Experiment[]>([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        fetchExperiments();
    }, []);

    const fetchExperiments = async () => {
        setLoading(true);
        try {
            const data = await api.get<Experiment[]>('/experiments');
            setExperiments(data);
        } catch (error) {
            console.error('Failed to fetch experiments:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            {experiments.map((exp) => (
                <ExperimentCard key={exp.id} experiment={exp} />
            ))}
        </div>
    );
};
```

**Props Typing:**
```typescript
// Good: Explicit props interface
interface ButtonProps {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    variant?: 'primary' | 'secondary';
}

const Button: React.FC<ButtonProps> = ({
    label,
    onClick,
    disabled = false,
    variant = 'primary',
}) => {
    // Implementation...
};

// Also acceptable: React.PropsWithChildren for children
interface CardProps extends React.PropsWithChildren {
    title: string;
}

const Card: React.FC<CardProps> = ({ title, children }) => {
    return <div>{title}{children}</div>;
};
```

### API Client (api.ts)

**Typed Requests/Responses:**
```typescript
import axios, { AxiosInstance } from 'axios';

class ApiClient {
    private instance: AxiosInstance;

    constructor(baseURL: string) {
        this.instance = axios.create({
            baseURL,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    async get<T>(url: string): Promise<T> {
        const response = await this.instance.get<T>(url);
        return response.data;
    }

    async post<T, D = unknown>(url: string, data?: D): Promise<T> {
        const response = await this.instance.post<T>(url, data);
        return response.data;
    }

    // Put, patch, delete, etc.
}

export const api = new ApiClient('http://localhost:8000/api');
```

### Zustand Store

**Typed Store:**
```typescript
import { create } from 'zustand';

interface User {
    id: number;
    username: string;
    role: 'admin' | 'user';
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null,
    isAuthenticated: false,
    login: async (username: string, password: string) => {
        const response = await api.post<{ token: string; user: User }>('/auth/login', {
            username,
            password,
        });
        set({
            token: response.token,
            user: response.user,
            isAuthenticated: true,
        });
    },
    logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
    },
}));
```

## Shared Standards

### Git Conventions

**Commit Messages:**
```
<type>: <subject>

<body>

<footer>
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring (no behavior change)
- `test:` Tests
- `chore:` Dependencies, build config

**Examples:**
```
feat: implement experiment queue service

- Add PENDING→QUEUED→RUNNING state machine
- Implement concurrency control with MAX_CONCURRENT_SIMULATIONS
- Add FIFO queue ordering

Closes #42

fix: prevent path traversal in bundle service

Validate source paths are within storage root before copying.

Fixes #51
```

**Commit Discipline:**
- One logical change per commit
- No mix of features and refactoring
- Avoid "fix typo" commits; squash before pushing
- Write messages for the reader, not yourself

### Testing

**Backend:**
- Unit tests for services and validators
- Fixtures in `conftest.py`
- Test file naming: `test_*.py` in `tests/` directory
- Pytest framework

**Frontend:**
- Component tests recommended
- Jest + React Testing Library
- Test user interactions, not implementation

### Documentation in Code

**Prefer:**
```python
# This transition is allowed to support retry scenario
ExperimentStatus.FAILED: {ExperimentStatus.QUEUED},
```

**Over:**
```python
# Transition from FAILED to QUEUED
ExperimentStatus.FAILED: {ExperimentStatus.QUEUED},
```

## Performance Guidelines

### Backend

1. **Database Queries:**
   - Index frequently filtered columns
   - Use select() for specific fields
   - Avoid N+1 queries with joins/eager loading

2. **File Operations:**
   - Use context managers (with statements)
   - Stream large files
   - Clean up temporary files

3. **Concurrency:**
   - Use connection pooling
   - Validate row-level locking works with target DB

### Frontend

1. **Rendering:**
   - Memoize expensive computations
   - Use React.memo for pure components
   - Virtual lists for large datasets

2. **API Calls:**
   - Implement request debouncing
   - Cancel in-flight requests on unmount
   - Cache responses appropriately

3. **Bundle Size:**
   - Tree-shake unused code
   - Lazy load pages
   - Monitor bundle size

## Security Guidelines

1. **Input Validation:**
   - Validate all user inputs (Pydantic, TypeScript types)
   - Sanitize filenames
   - Validate file types

2. **Path Operations:**
   - Always use `os.path.realpath()` and validate against root
   - Never trust user-provided paths directly

3. **Secrets:**
   - Never commit `.env` files
   - Use environment variables for secrets
   - Rotate keys regularly

4. **Authentication:**
   - Validate JWT signatures
   - Implement token expiration
   - Use HTTPS in production

## Code Review Checklist

Before submitting code for review, verify:

- [ ] All functions have type hints
- [ ] All public functions have docstrings
- [ ] No `any` types (or justified with comment)
- [ ] Error handling is specific (not bare except)
- [ ] Commit messages follow conventions
- [ ] No hardcoded secrets or credentials
- [ ] Tests pass (if applicable)
- [ ] File size reasonable (under limits)
- [ ] Code follows YAGNI principle

## Tools & Linting

### Backend
- **Formatter:** Black (optional but recommended)
- **Linter:** Pylint or Ruff
- **Type Checker:** mypy

### Frontend
- **Formatter:** Prettier
- **Linter:** ESLint
- **Type Checker:** TypeScript compiler

### CI/CD
- Linting on pull requests
- Tests required before merge
- Type checking on all commits

## Continuous Improvement

This document evolves. Suggestions welcome. Common updates:
- Clarify ambiguous rules
- Add examples for new patterns
- Remove outdated guidelines
- Adjust based on team feedback
