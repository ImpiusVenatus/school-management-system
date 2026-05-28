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
    roles = relationship("ClubRole", back_populates="club", cascade="all, delete-orphan")


class ClubRole(Base):
    __tablename__ = "club_roles"

    id = Column(String, primary_key=True, index=True)
    club_id = Column(String, ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False)
    academic_year_id = Column(String, nullable=False)
    name = Column(String, nullable=False)  # e.g. President, Vice President, General Secretary
    rank = Column(Integer, default=0)
    is_unique = Column(Boolean, default=False)  # only one member may hold this role per club+year
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    club = relationship("Club", back_populates="roles")


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
    # Legacy: free-text role name (kept for backward-compat with existing rows)
    role = Column(String, default="member")
    # New: validated, configurable officer roles per club+year
    role_id = Column(String, ForeignKey("club_roles.id", ondelete="SET NULL"), nullable=True)
    role_name = Column(String, nullable=True)  # denormalized label snapshot (fallback when role_id is null)
    academic_year_id = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    idx = Column(Integer, default=0)

    club = relationship("Club", back_populates="members")
    student = relationship("Student", backref="club_members")
    role_def = relationship("ClubRole")


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
