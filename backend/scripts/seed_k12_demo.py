"""Seed K12 demo data: classes/sections + students + enrollments.

Run:
  ./venv/Scripts/python.exe scripts/seed_k12_demo.py
"""

from __future__ import annotations

import os
import sys
from datetime import date

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal
from app.models import AcademicYear, EducationSettings, K12Class, K12Section, K12StudentEnrollment, Student
from app.services.id_gen import new_id, student_name as make_student_name


STREAMS = ["Science", "Commerce", "Arts"]


def get_or_create_active_year(db) -> AcademicYear:
    settings = db.query(EducationSettings).first()
    active_id = settings.current_academic_year_id if settings else None
    if active_id:
        row = db.query(AcademicYear).filter(AcademicYear.id == active_id).first()
        if row:
            return row

    # fallback: most recent year
    row = db.query(AcademicYear).order_by(AcademicYear.year_start_date.desc()).first()
    if row:
        return row

    # create a minimal academic year if none exists
    ay = AcademicYear(
        id=new_id("AY"),
        academic_year_name=f"{date.today().year}",
        year_start_date=date(date.today().year, 1, 1),
        year_end_date=date(date.today().year, 12, 31),
        status="active",
    )
    db.add(ay)
    db.commit()
    if not settings:
        settings = EducationSettings(id="Education Settings")
        db.add(settings)
    settings.current_academic_year_id = ay.id
    settings.school_type = "k12"
    db.commit()
    return ay


def get_or_create_class(db, year_id: str, numeric_level: int) -> K12Class:
    name = f"Class {numeric_level}"
    row = db.query(K12Class).filter(K12Class.academic_year_id == year_id, K12Class.name == name).first()
    if row:
        return row
    row = K12Class(id=new_id("CLS"), academic_year_id=year_id, name=name, numeric_level=numeric_level)
    db.add(row)
    db.commit()
    return row


def get_or_create_section(db, class_id: str, name: str) -> K12Section:
    row = db.query(K12Section).filter(K12Section.class_id == class_id, K12Section.name == name).first()
    if row:
        return row
    row = K12Section(id=new_id("SEC"), class_id=class_id, name=name, capacity=40)
    db.add(row)
    db.commit()
    return row


def get_or_create_student(db, idx: int) -> Student:
    email = f"demo.student{idx:03d}@example.com"
    row = db.query(Student).filter(Student.student_email_id == email).first()
    if row:
        return row
    first = f"Demo{idx:03d}"
    last = "Student"
    row = Student(
        id=new_id("STU"),
        first_name=first,
        middle_name=None,
        last_name=last,
        student_name=make_student_name(first, None, last),
        student_email_id=email,
        enabled=True,
        joining_date=date.today(),
    )
    db.add(row)
    db.commit()
    return row


def enroll(db, student_id: str, year_id: str, section_id: str, roll_no: str, stream: str | None) -> None:
    existing = (
        db.query(K12StudentEnrollment)
        .filter(K12StudentEnrollment.student_id == student_id, K12StudentEnrollment.academic_year_id == year_id)
        .first()
    )
    if existing:
        return
    row = K12StudentEnrollment(
        id=new_id("KEN"),
        student_id=student_id,
        academic_year_id=year_id,
        section_id=section_id,
        roll_no=roll_no,
        stream=stream,
        enrolled_on=date.today(),
        status="active",
    )
    db.add(row)
    db.commit()


def main() -> None:
    db = SessionLocal()
    try:
        ay = get_or_create_active_year(db)
        year_id = ay.id

        # Create classes 6–10, sections A/B
        sections_by_level: dict[int, list[K12Section]] = {}
        for level in range(6, 11):
            cls = get_or_create_class(db, year_id, level)
            sec_a = get_or_create_section(db, cls.id, "A")
            sec_b = get_or_create_section(db, cls.id, "B")
            sections_by_level[level] = [sec_a, sec_b]

        # Create 30 demo students and distribute across sections
        student_count = 30
        i = 1
        for level in range(6, 11):
            for sec in sections_by_level[level]:
                for _ in range(3):  # 3 per section -> 30 total
                    if i > student_count:
                        break
                    s = get_or_create_student(db, i)
                    stream = None
                    if level >= 9:
                        stream = STREAMS[(i - 1) % len(STREAMS)]
                    enroll(db, s.id, year_id, sec.id, roll_no=str(i), stream=stream)
                    i += 1

        print(f"Seed complete. Academic year: {ay.academic_year_name} ({year_id})")
        print("Created/ensured classes 6-10 with sections A/B, and enrolled demo students.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

