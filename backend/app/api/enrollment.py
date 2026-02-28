"""Program Enrollment and Course Enrollment API."""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    ProgramEnrollment,
    ProgramEnrollmentCourse,
    CourseEnrollment,
    Student,
    Program,
    Course,
    Instructor,
)
from app.schemas.enrollment import (
    ProgramEnrollmentCreate,
    ProgramEnrollmentUpdate,
    ProgramEnrollmentResponse,
    ProgramEnrollmentCourseItem,
    CourseEnrollmentResponse,
)
from app.core.auth import get_current_user
from app.models import User
from app.services.id_gen import new_id

router = APIRouter(prefix="/enrollments", tags=["enrollments"])


def _enrollment_to_response(e: ProgramEnrollment, db: Session) -> ProgramEnrollmentResponse:
    courses = [
        ProgramEnrollmentCourseItem(course_id=c.course_id, course_name=c.course_name)
        for c in db.query(ProgramEnrollmentCourse).filter(ProgramEnrollmentCourse.parent_id == e.id).order_by(ProgramEnrollmentCourse.idx).all()
    ]
    advisor_name = None
    if e.student_advisor_id:
        inst = db.query(Instructor).filter(Instructor.id == e.student_advisor_id).first()
        advisor_name = inst.instructor_name if inst else None
    return ProgramEnrollmentResponse(
        id=e.id,
        student_id=e.student_id,
        student_name=e.student_name,
        program_id=e.program_id,
        academic_year_id=e.academic_year_id,
        academic_term_id=e.academic_term_id,
        enrollment_date=e.enrollment_date,
        student_category_id=e.student_category_id,
        student_batch_name=e.student_batch_name,
        school_house_id=e.school_house_id,
        boarding_student=e.boarding_student,
        grade_level=e.grade_level,
        section_name=e.section_name,
        student_advisor_id=e.student_advisor_id,
        student_advisor_name=advisor_name,
        courses=courses,
        docstatus=e.docstatus,
    )


@router.get("", response_model=list[ProgramEnrollmentResponse])
def list_enrollments(
    db: Session = Depends(get_db),
    student_id: str | None = None,
    program_id: str | None = None,
    academic_year_id: str | None = None,
    grade_level: str | None = None,
    section_name: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ProgramEnrollment)
    if student_id:
        q = q.filter(ProgramEnrollment.student_id == student_id)
    if program_id:
        q = q.filter(ProgramEnrollment.program_id == program_id)
    if academic_year_id:
        q = q.filter(ProgramEnrollment.academic_year_id == academic_year_id)
    if grade_level:
        q = q.filter(ProgramEnrollment.grade_level == grade_level)
    if section_name:
        q = q.filter(ProgramEnrollment.section_name == section_name)
    rows = q.offset(skip).limit(limit).all()
    return [_enrollment_to_response(r, db) for r in rows]


@router.post("", response_model=ProgramEnrollmentResponse)
def create_enrollment(
    body: ProgramEnrollmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student = db.query(Student).filter(Student.id == body.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    program = db.query(Program).filter(Program.id == body.program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    eid = new_id("ENR")
    enrollment = ProgramEnrollment(
        id=eid,
        student_id=body.student_id,
        student_name=student.student_name,
        program_id=body.program_id,
        academic_year_id=body.academic_year_id,
        academic_term_id=body.academic_term_id,
        enrollment_date=body.enrollment_date,
        student_category_id=body.student_category_id,
        student_batch_name=body.student_batch_name,
        school_house_id=body.school_house_id,
        boarding_student=body.boarding_student,
        grade_level=body.grade_level,
        section_name=body.section_name,
        student_advisor_id=body.student_advisor_id,
    )
    db.add(enrollment)
    for i, c in enumerate(body.courses):
        course = db.query(Course).filter(Course.id == c.course_id).first()
        db.add(ProgramEnrollmentCourse(
            id=new_id("PEC"),
            parent_id=eid,
            course_id=c.course_id,
            course_name=course.course_name if course else c.course_name,
            idx=i,
        ))
        # Create course enrollment
        db.add(CourseEnrollment(
            id=new_id("CE"),
            program_enrollment_id=eid,
            student_id=body.student_id,
            student_name=student.student_name,
            course_id=c.course_id,
            enrollment_date=body.enrollment_date,
            program_id=body.program_id,
        ))
    db.commit()
    db.refresh(enrollment)
    return _enrollment_to_response(enrollment, db)


@router.get("/{enrollment_id}", response_model=ProgramEnrollmentResponse)
def get_enrollment(
    enrollment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    e = db.query(ProgramEnrollment).filter(ProgramEnrollment.id == enrollment_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return _enrollment_to_response(e, db)


@router.get("/{enrollment_id}/course-enrollments", response_model=list[CourseEnrollmentResponse])
def list_course_enrollments(
    enrollment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(CourseEnrollment).filter(CourseEnrollment.program_enrollment_id == enrollment_id).all()
    return [
        CourseEnrollmentResponse(
            id=r.id,
            student_id=r.student_id,
            student_name=r.student_name,
            course_id=r.course_id,
            program_enrollment_id=r.program_enrollment_id,
            enrollment_date=r.enrollment_date,
            program_id=r.program_id,
        )
        for r in rows
    ]
