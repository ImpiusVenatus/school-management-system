"""Courses API."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Course, CourseAssessmentCriteria
from app.schemas.program_course import CourseCreate, CourseUpdate, CourseResponse, CourseAssessmentCriteriaItem
from app.core.auth import get_current_user
from app.models import User
from app.services.id_gen import new_id

router = APIRouter(prefix="/courses", tags=["courses"])


def _course_to_response(c: Course, db: Session) -> CourseResponse:
    return CourseResponse(
        id=c.id,
        course_name=c.course_name,
        department=c.department,
        description=c.description,
        default_grading_scale_id=c.default_grading_scale_id,
    )


@router.get("", response_model=list[CourseResponse])
def list_courses(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: str | None = None,
    current_user: User = Depends(get_current_user),
):
    q = db.query(Course)
    if search:
        q = q.filter(Course.course_name.ilike(f"%{search}%"))
    rows = q.offset(skip).limit(limit).all()
    return [_course_to_response(r, db) for r in rows]


@router.post("", response_model=CourseResponse)
def create_course(
    body: CourseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(Course).filter(Course.course_name == body.course_name).first():
        raise HTTPException(status_code=400, detail="Course name already exists")
    cid = body.course_name.replace(" ", "-")[:50]
    course = Course(
        id=cid,
        course_name=body.course_name,
        department=body.department,
        description=body.description,
        default_grading_scale_id=body.default_grading_scale_id,
    )
    db.add(course)
    for i, ac in enumerate(body.assessment_criteria):
        db.add(CourseAssessmentCriteria(
            id=new_id("CAC"),
            parent_id=cid,
            assessment_criteria_id=ac.assessment_criteria_id,
            weightage=ac.weightage,
            idx=i,
        ))
    db.commit()
    db.refresh(course)
    return _course_to_response(course, db)


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Course).filter(Course.id == course_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    return _course_to_response(c, db)


@router.patch("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: str,
    body: CourseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Course).filter(Course.id == course_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    data = body.model_dump(exclude_unset=True)
    if "assessment_criteria" in data:
        db.query(CourseAssessmentCriteria).filter(CourseAssessmentCriteria.parent_id == course_id).delete()
        for i, ac in enumerate(data["assessment_criteria"]):
            db.add(CourseAssessmentCriteria(
                id=new_id("CAC"),
                parent_id=course_id,
                assessment_criteria_id=ac.assessment_criteria_id,
                weightage=ac.weightage,
                idx=i,
            ))
        del data["assessment_criteria"]
    for k, v in data.items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return _course_to_response(c, db)


@router.get("/{course_id}/assessment-criteria", response_model=list[dict])
def get_course_assessment_criteria(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return assessment criteria and weightage for course."""
    rows = db.query(CourseAssessmentCriteria).filter(CourseAssessmentCriteria.parent_id == course_id).order_by(CourseAssessmentCriteria.idx).all()
    return [{"assessment_criteria_id": r.assessment_criteria_id, "weightage": r.weightage} for r in rows]
