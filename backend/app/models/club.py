"""School clubs: Club, ClubModerator, ClubMember, ClubPost (year-scoped)."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Club(Base):
    __tablename__ = "clubs"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    academic_year_id = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    moderators = relationship("ClubModerator", back_populates="club", cascade="all, delete-orphan")
    members = relationship("ClubMember", back_populates="club", cascade="all, delete-orphan")
    posts = relationship("ClubPost", back_populates="club", cascade="all, delete-orphan")


class ClubModerator(Base):
    __tablename__ = "club_moderators"

    id = Column(String, primary_key=True, index=True)
    club_id = Column(String, ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False)
    instructor_id = Column(String, ForeignKey("instructors.id", ondelete="CASCADE"), nullable=False)
    is_chief = Column(Boolean, default=False)
    academic_year_id = Column(String, nullable=False)
    idx = Column(Integer, default=0)

    club = relationship("Club", back_populates="moderators")
    instructor = relationship("Instructor", backref="club_moderators")


class ClubMember(Base):
    __tablename__ = "club_members"

    id = Column(String, primary_key=True, index=True)
    club_id = Column(String, ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, default="member")  # member, president, vice_president, general_secretary, etc.
    academic_year_id = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    idx = Column(Integer, default=0)

    club = relationship("Club", back_populates="members")
    student = relationship("Student", backref="club_members")


class ClubPost(Base):
    __tablename__ = "club_posts"

    id = Column(String, primary_key=True, index=True)
    club_id = Column(String, ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False)
    created_by_id = Column(String, nullable=True)  # user or instructor id
    title = Column(String, nullable=False)
    body = Column(Text, nullable=True)
    academic_year_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    club = relationship("Club", back_populates="posts")
