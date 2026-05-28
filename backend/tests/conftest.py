from __future__ import annotations

import sys
from pathlib import Path
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


@pytest.fixture(scope="session")
def test_engine():
    # One shared in-memory DB for the test session.
    # (If you later add parallel test runs, switch to a per-test tempfile DB.)
    return create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


@pytest.fixture(scope="session")
def TestingSessionLocal(test_engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def create_tables(test_engine):
    from app.database import Base  # uses declarative_base()
    from app import models  # noqa: F401 - ensure models are imported/registered

    Base.metadata.create_all(bind=test_engine)
    yield


@pytest.fixture()
def db(TestingSessionLocal):
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(test_engine, TestingSessionLocal):
    import app.main as main_mod
    from app.database import get_db
    import app.middleware.audit as audit_mw
    import app.core.auth as auth_dep

    # Patch app.main lifespan DB session to use the test database.
    main_mod.engine = test_engine
    main_mod.SessionLocal = TestingSessionLocal
    app = main_mod.app

    # Disable current-user caching for tests (avoids stale RBAC after role changes).
    auth_dep._USER_CACHE_TTL_SEC = 0.0
    auth_dep._user_cache.clear()

    def _override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db

    # Audit middleware uses its own SessionLocal (imported at module import time).
    audit_mw.SessionLocal = TestingSessionLocal

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


def _create_user(db, *, email: str, password: str, is_superuser: bool = False):
    from app.models import User
    from app.core.security import get_password_hash

    user = User(
        id=str(uuid.uuid4()),
        email=email,
        hashed_password=get_password_hash(password),
        full_name=email.split("@")[0],
        is_active=True,
        is_superuser=is_superuser,
        role="admin" if is_superuser else "user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def superuser(db):
    return _create_user(
        db,
        email=f"admin-{uuid.uuid4()}@example.com",
        password="adminpass",
        is_superuser=True,
    )


@pytest.fixture()
def normal_user(db):
    return _create_user(
        db,
        email=f"user-{uuid.uuid4()}@example.com",
        password="userpass",
        is_superuser=False,
    )

