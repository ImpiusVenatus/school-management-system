"""Academic structure facade — routes by school_type."""
from sqlalchemy.orm import Session
from app.models import EducationSettings, StudentGroupStudent, K12StudentEnrollment, K12Section


def get_school_type(db: Session) -> str:
    row = db.query(EducationSettings).first()
    return (row.school_type if row else None) or "program"


def get_section_label_for_student(db: Session, student_id: str) -> str | None:
    school_type = get_school_type(db)
    if school_type == "k12":
        enr = (
            db.query(K12StudentEnrollment)
            .filter(K12StudentEnrollment.student_id == student_id, K12StudentEnrollment.status == "active")
            .order_by(K12StudentEnrollment.enrolled_on.desc())
            .first()
        )
        if not enr:
            return None
        sec = db.query(K12Section).filter(K12Section.id == enr.section_id).first()
        return sec.name if sec else enr.section_id
    link = (
        db.query(StudentGroupStudent)
        .filter(StudentGroupStudent.student_id == student_id, StudentGroupStudent.active == True)
        .first()
    )
    return link.student_name if link else None
