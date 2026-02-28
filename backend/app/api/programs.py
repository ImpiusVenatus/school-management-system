"""Programs API."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Program, ProgramCourse, Course
from app.schemas.program_course import ProgramCreate, ProgramUpdate, ProgramResponse, ProgramCourseItem
from app.core.auth import get_current_user
from app.models import User
from app.services.id_gen import new_id

router = APIRouter(prefix="/programs", tags=["programs"])


def _program_to_response(p: Program, db: Session) -> ProgramResponse:
    courses = [
        ProgramCourseItem(course_id=pc.course_id, course_name=pc.course_name, required=pc.required)
        for pc in db.query(ProgramCourse).filter(ProgramCourse.parent_id == p.id).order_by(ProgramCourse.idx).all()
    ]
    return ProgramResponse(
        id=p.id,
        program_name=p.program_name,
        program_abbreviation=p.program_abbreviation,
        department=p.department,
        courses=courses,
    )


@router.get("", response_model=list[ProgramResponse])
def list_programs(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(Program).offset(skip).limit(limit).all()
    return [_program_to_response(r, db) for r in rows]


@router.post("", response_model=ProgramResponse)
def create_program(
    body: ProgramCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(Program).filter(Program.program_name == body.program_name).first():
        raise HTTPException(status_code=400, detail="Program name already exists")
    pid = body.program_name.replace(" ", "-")[:50]  # simple id from name
    program = Program(
        id=pid,
        program_name=body.program_name,
        program_abbreviation=body.program_abbreviation,
        department=body.department,
    )
    db.add(program)
    for i, c in enumerate(body.courses):
        course = db.query(Course).filter(Course.id == c.course_id).first()
        course_name = course.course_name if course else None
        pc = ProgramCourse(
            id=new_id("PC"),
            parent_id=pid,
            course_id=c.course_id,
            course_name=course_name or c.course_name,
            required=c.required,
            idx=i,
        )
        db.add(pc)
    db.commit()
    db.refresh(program)
    return _program_to_response(program, db)


@router.get("/{program_id}", response_model=ProgramResponse)
def get_program(
    program_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(Program).filter(Program.id == program_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Program not found")
    return _program_to_response(p, db)


@router.patch("/{program_id}", response_model=ProgramResponse)
def update_program(
    program_id: str,
    body: ProgramUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(Program).filter(Program.id == program_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Program not found")
    data = body.model_dump(exclude_unset=True)
    if "courses" in data:
        db.query(ProgramCourse).filter(ProgramCourse.parent_id == program_id).delete()
        for i, c in enumerate(data["courses"]):
            course = db.query(Course).filter(Course.id == c.course_id).first()
            course_name = course.course_name if course else None
            db.add(ProgramCourse(
                id=new_id("PC"),
                parent_id=program_id,
                course_id=c.course_id,
                course_name=course_name or c.get("course_name"),
                required=c.get("required", True),
                idx=i,
            ))
        del data["courses"]
    for k, v in data.items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return _program_to_response(p, db)


@router.get("/{program_id}/courses", response_model=list[dict])
def get_program_courses(
    program_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return list of courses in this program (from Program Course table)."""
    rows = db.query(ProgramCourse).filter(ProgramCourse.parent_id == program_id).order_by(ProgramCourse.idx).all()
    return [{"course": r.course_id, "course_name": r.course_name, "required": r.required} for r in rows]
