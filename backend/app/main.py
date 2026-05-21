"""School Management System - FastAPI backend (reference: Frappe Education)."""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError, OperationalError

from app.config import get_settings
from app.database import engine, Base, SessionLocal
from app.api.rbac import _ensure_rbac_initialized
from app.api import auth, students, programs, courses, enrollment, academic, academic_departments
from app.api import student_groups, course_schedule, attendance, leave, fees, assessment
from app.api import instructors, rooms, guardians, applicants, files, setup, clubs, notices
from app.api import settings as settings_api
from app.api import k12, invoices, rbac

config = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        _ensure_rbac_initialized(db)
    finally:
        db.close()
    yield


app = FastAPI(title=config.APP_NAME, version="1.0.0", lifespan=lifespan)


@app.exception_handler(OperationalError)
@app.exception_handler(DBAPIError)
async def database_connection_handler(_request: Request, exc: Exception):
    """Return 503 when Neon/Postgres drops an idle SSL connection so the client can retry."""
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Database connection was interrupted. Please retry your request.",
        },
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API prefix /api
api_prefix = "/api"
app.include_router(auth.router, prefix=api_prefix)
app.include_router(students.router, prefix=api_prefix)
app.include_router(programs.router, prefix=api_prefix)
app.include_router(courses.router, prefix=api_prefix)
app.include_router(enrollment.router, prefix=api_prefix)
app.include_router(academic.router, prefix=api_prefix)
app.include_router(academic_departments.router, prefix=f"{api_prefix}/academic")
app.include_router(student_groups.router, prefix=api_prefix)
app.include_router(course_schedule.router, prefix=api_prefix)
app.include_router(attendance.router, prefix=api_prefix)
app.include_router(leave.router, prefix=api_prefix)
app.include_router(fees.router, prefix=api_prefix)
app.include_router(assessment.router, prefix=api_prefix)
app.include_router(instructors.router, prefix=api_prefix)
app.include_router(rooms.router, prefix=api_prefix)
app.include_router(guardians.router, prefix=api_prefix)
app.include_router(applicants.router, prefix=api_prefix)
app.include_router(files.router, prefix=api_prefix)
app.include_router(settings_api.router, prefix=api_prefix)
app.include_router(setup.router, prefix=api_prefix)
app.include_router(clubs.router, prefix=api_prefix)
app.include_router(notices.router, prefix=api_prefix)
app.include_router(k12.router, prefix=api_prefix)
app.include_router(invoices.router, prefix=api_prefix)
app.include_router(rbac.router, prefix=api_prefix)


@app.get("/")
def root():
    return {"app": config.APP_NAME, "docs": "/docs", "api": api_prefix}


@app.get("/health")
def health():
    return {"status": "ok"}


def init_db():
    """Create tables for local dev only. Production must use: alembic upgrade head."""
    if config.ENVIRONMENT == "production":
        raise RuntimeError("init_db() is disabled in production. Run: alembic upgrade head")
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=config.DEBUG)
