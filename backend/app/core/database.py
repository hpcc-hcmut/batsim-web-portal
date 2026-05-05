from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=(
        {"check_same_thread": False, "timeout": 30}
        if "sqlite" in settings.DATABASE_URL
        else {}
    ),
)


@event.listens_for(engine, "connect")
def _enable_sqlite_fk(dbapi_conn, _):
    """Enable FK enforcement on every new SQLite connection."""
    if "sqlite" in settings.DATABASE_URL:
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
