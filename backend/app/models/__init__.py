"""Export Base and all models for Alembic and app."""
from app.database import Base
from app.models.user import User
from app.models.academic import AcademicYear, AcademicTerm
from app.models.program_course import Program, Course, ProgramCourse, CourseAssessmentCriteria
from app.models.student import Student, Guardian, StudentGuardian
from app.models.instructor_room import Instructor, Room
from app.models.instructor_assignment import InstructorAssignment
from app.models.enrollment import ProgramEnrollment, ProgramEnrollmentCourse, CourseEnrollment
from app.models.student_group import StudentGroup, StudentGroupStudent, StudentGroupInstructor
from app.models.course_schedule import CourseSchedule
from app.models.attendance import StudentAttendance, StudentLeaveApplication
from app.models.fee import (
    FeeCategory,
    FeeStructure,
    FeeComponent,
    FeeSchedule,
    FeeScheduleStudentGroup,
    PaymentMethod,
    FeeDiscountRule,
)
from app.models.assessment import (
    AssessmentGroup,
    AssessmentCriteria,
    GradingScale,
    GradingScaleInterval,
    AssessmentPlan,
    AssessmentPlanCriteria,
    AssessmentResult,
    AssessmentResultDetail,
)
from app.models.applicant import StudentApplicant
from app.models.education_settings import EducationSettings
from app.models.file_record import FileRecord
from app.models.club import Club, ClubModerator, ClubMember, ClubPost
from app.models.notice import NoticeCategory, Notice
from app.models.rbac import Role, Permission, RefreshToken, role_permissions, user_roles
from app.models.academic_department import AcademicDepartment
from app.models.k12 import (
    K12Class,
    K12Section,
    K12Subject,
    K12ClassSubject,
    K12StudentEnrollment,
    K12TeacherSubject,
    K12TimetableSlot,
)
from app.models.invoice import Invoice, InvoiceItem, Payment

__all__ = [
    "Base",
    "User",
    "AcademicYear",
    "AcademicTerm",
    "AcademicDepartment",
    "Program",
    "Course",
    "ProgramCourse",
    "CourseAssessmentCriteria",
    "Student",
    "Guardian",
    "StudentGuardian",
    "Instructor",
    "Room",
    "InstructorAssignment",
    "ProgramEnrollment",
    "ProgramEnrollmentCourse",
    "CourseEnrollment",
    "StudentGroup",
    "StudentGroupStudent",
    "StudentGroupInstructor",
    "CourseSchedule",
    "StudentAttendance",
    "StudentLeaveApplication",
    "FeeCategory",
    "FeeStructure",
    "FeeComponent",
    "FeeSchedule",
    "FeeScheduleStudentGroup",
    "PaymentMethod",
    "FeeDiscountRule",
    "AssessmentGroup",
    "AssessmentCriteria",
    "GradingScale",
    "GradingScaleInterval",
    "AssessmentPlan",
    "AssessmentPlanCriteria",
    "AssessmentResult",
    "AssessmentResultDetail",
    "StudentApplicant",
    "EducationSettings",
    "FileRecord",
    "Club",
    "ClubModerator",
    "ClubMember",
    "ClubPost",
    "NoticeCategory",
    "Notice",
    "Role",
    "Permission",
    "RefreshToken",
    "role_permissions",
    "user_roles",
    "K12Class",
    "K12Section",
    "K12Subject",
    "K12ClassSubject",
    "K12StudentEnrollment",
    "K12TeacherSubject",
    "K12TimetableSlot",
    "Invoice",
    "InvoiceItem",
    "Payment",
]
