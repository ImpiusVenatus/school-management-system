"""FileRecord for file management (admission, teacher, student_report, etc.)."""
from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func
from app.database import Base


class FileRecord(Base):
    __tablename__ = "file_records"

    id = Column(String, primary_key=True, index=True)
    file_path = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    content_type = Column(String, nullable=True)
    category = Column(String, nullable=False)  # admission, teacher, student_report, notice, general
    related_entity_type = Column(String, nullable=True)  # student, applicant, instructor, etc.
    related_entity_id = Column(String, nullable=True)
    uploaded_by_id = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
