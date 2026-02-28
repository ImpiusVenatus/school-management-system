"""Student Applicant API + enroll_student (create Student + ProgramEnrollment from applicant)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import StudentApplicant, Student, ProgramEnrollment, ProgramEnrollmentCourse, CourseEnrollment
from app.models import Program, Course, ProgramCourse
from app.schemas.applicant import StudentApplicantCreate, StudentApplicantUpdate, StudentApplicantResponse
from app.core.auth import get_current_user
from app.models import User
from app.services.id_gen import new_id, student_name as make_student_name

router = APIRouter(prefix="/applicants", tags=["applicants"])


@router.get("", response_model=list[StudentApplicantResponse])
def list_applicants(
    db: Session = Depends(get_db),
    program_id: str | None = None,
    application_status: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    q = db.query(StudentApplicant)
    if program_id:
        q = q.filter(StudentApplicant.program_id == program_id)
    if application_status:
        q = q.filter(StudentApplicant.application_status == application_status)
    rows = q.offset(skip).limit(limit).all()
    return [
        StudentApplicantResponse(
            id=r.id,
            first_name=r.first_name,
            middle_name=r.middle_name,
            last_name=r.last_name,
            title=r.title,
            program_id=r.program_id,
            academic_year_id=r.academic_year_id,
            academic_term_id=r.academic_term_id,
            student_category_id=r.student_category_id,
            student_email_id=r.student_email_id,
            student_mobile_number=r.student_mobile_number,
            date_of_birth=r.date_of_birth,
            gender=r.gender,
            blood_group=r.blood_group,
            nationality=r.nationality,
            address_line_1=r.address_line_1,
            address_line_2=r.address_line_2,
            city=r.city,
            state=r.state,
            pincode=r.pincode,
            country=r.country,
            application_date=r.application_date,
            application_status=r.application_status,
        )
        for r in rows
    ]


@router.post("", response_model=StudentApplicantResponse)
def create_applicant(
    body: StudentApplicantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    aid = new_id("APP")
    title = make_student_name(body.first_name, body.middle_name, body.last_name) or body.first_name
    from datetime import date
    row = StudentApplicant(
        id=aid,
        first_name=body.first_name,
        middle_name=body.middle_name,
        last_name=body.last_name,
        title=title,
        program_id=body.program_id,
        academic_year_id=body.academic_year_id,
        academic_term_id=body.academic_term_id,
        student_category_id=body.student_category_id,
        student_email_id=body.student_email_id,
        student_mobile_number=body.student_mobile_number,
        date_of_birth=body.date_of_birth,
        gender=body.gender,
        blood_group=body.blood_group,
        nationality=body.nationality,
        address_line_1=body.address_line_1,
        address_line_2=body.address_line_2,
        city=body.city,
        state=body.state,
        pincode=body.pincode,
        country=body.country,
        application_date=date.today(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return StudentApplicantResponse(
        id=row.id,
        first_name=row.first_name,
        middle_name=row.middle_name,
        last_name=row.last_name,
        title=row.title,
        program_id=row.program_id,
        academic_year_id=row.academic_year_id,
        academic_term_id=row.academic_term_id,
        student_category_id=row.student_category_id,
        student_email_id=row.student_email_id,
        student_mobile_number=row.student_mobile_number,
        date_of_birth=row.date_of_birth,
        gender=row.gender,
        blood_group=row.blood_group,
        nationality=row.nationality,
        address_line_1=row.address_line_1,
        address_line_2=row.address_line_2,
        city=row.city,
        state=row.state,
        pincode=row.pincode,
        country=row.country,
        application_date=row.application_date,
        application_status=row.application_status,
    )


@router.post("/enroll/{applicant_id}")
def enroll_student(
    applicant_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create Student and Program Enrollment from Applicant (like frappe enroll_student)."""
    app = db.query(StudentApplicant).filter(StudentApplicant.id == applicant_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Applicant not found")
    if app.application_status != "Approved":
        raise HTTPException(status_code=400, detail="Applicant must be Approved to enroll")
    if db.query(Student).filter(Student.student_email_id == app.student_email_id).first():
        raise HTTPException(status_code=400, detail="Student with this email already exists")
    from datetime import date
    sid = new_id("STU")
    name = make_student_name(app.first_name, app.middle_name, app.last_name) or app.first_name
    student = Student(
        id=sid,
        first_name=app.first_name,
        middle_name=app.middle_name,
        last_name=app.last_name,
        student_name=name,
        student_email_id=app.student_email_id or f"student-{sid}@school.local",
        student_mobile_number=app.student_mobile_number,
        date_of_birth=app.date_of_birth,
        blood_group=app.blood_group,
        gender=app.gender,
        nationality=app.nationality,
        joining_date=date.today(),
        student_applicant_id=applicant_id,
        address_line_1=app.address_line_1,
        address_line_2=app.address_line_2,
        city=app.city,
        state=app.state,
        pincode=app.pincode,
        country=app.country,
    )
    db.add(student)
    program = db.query(Program).filter(Program.id == app.program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    program_courses = db.query(ProgramCourse).filter(ProgramCourse.parent_id == app.program_id).order_by(ProgramCourse.idx).all()
    eid = new_id("ENR")
    enrollment = ProgramEnrollment(
        id=eid,
        student_id=sid,
        student_name=student.student_name,
        program_id=app.program_id,
        academic_year_id=app.academic_year_id,
        academic_term_id=app.academic_term_id,
        enrollment_date=date.today(),
        student_category_id=app.student_category_id,
    )
    db.add(enrollment)
    for i, pc in enumerate(program_courses):
        db.add(ProgramEnrollmentCourse(id=new_id("PEC"), parent_id=eid, course_id=pc.course_id, course_name=pc.course_name, idx=i))
        db.add(CourseEnrollment(id=new_id("CE"), program_enrollment_id=eid, student_id=sid, student_name=student.student_name, course_id=pc.course_id, enrollment_date=date.today(), program_id=app.program_id))
    app.application_status = "Admitted"
    db.commit()
    return {"student_id": sid, "program_enrollment_id": eid, "message": "Student enrolled successfully"}
