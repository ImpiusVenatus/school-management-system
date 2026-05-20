"""School Management System - FastAPI backend (reference: Frappe Education)."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine, Base
from app.api import auth, students, programs, courses, enrollment, academic
from app.api import student_groups, course_schedule, attendance, leave, fees, assessment
from app.api import instructors, rooms, guardians, applicants, files, setup, clubs, notices
from app.api import settings as settings_api
from app.api import k12, invoices, rbac

config = get_settings()
app = FastAPI(title=config.APP_NAME, version="1.0.0")

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
