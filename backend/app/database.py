"""Database session and engine (PostgreSQL/Neon)."""
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import get_settings

settings = get_settings()

# Neon closes idle SSL connections after a few minutes. Recycle before that and
# verify connections on checkout; warm each new session before use.
_engine_kwargs: dict = {
    "pool_pre_ping": True,
    "pool_recycle": 280,
    "pool_size": 5,
    "max_overflow": 10,
    "echo": settings.DEBUG,
}

if settings.DATABASE_URL.startswith("postgresql"):
    _engine_kwargs["connect_args"] = {
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    }

engine = create_engine(settings.DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _connection_is_stale(exc: BaseException) -> bool:
    msg = f"{exc} {getattr(exc, '__cause__', '')}".lower()
    return any(
        phrase in msg
        for phrase in (
            "ssl connection has been closed",
            "connection has been closed",
            "server closed the connection",
            "connection reset",
            "broken pipe",
            "terminating connection",
            "could not connect",
            "connection refused",
        )
    )


def _warm_connection(db) -> None:
    db.execute(text("SELECT 1"))


def get_db():
    """Dependency for FastAPI: yield a DB session, reconnecting if the pool handed out a dead connection."""
    db = SessionLocal()
    try:
        try:
            _warm_connection(db)
        except (OperationalError, DBAPIError) as exc:
            if not _connection_is_stale(exc):
                raise
            db.rollback()
            db.close()
            db = SessionLocal()
            _warm_connection(db)
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
