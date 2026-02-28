"""School clubs: CRUD, moderators (admin only), members, posts (chief moderator)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Club, ClubModerator, ClubMember, ClubPost, Instructor, Student
from app.core.auth import get_current_user
from app.models import User
from app.services.id_gen import new_id
from pydantic import BaseModel

router = APIRouter(prefix="/clubs", tags=["clubs"])


class ClubBase(BaseModel):
    name: str
    description: str | None = None
    academic_year_id: str | None = None
    is_active: bool = True


class ClubCreate(ClubBase):
    pass


class ClubUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    academic_year_id: str | None = None
    is_active: bool | None = None


class ClubResponse(ClubBase):
    id: str

    class Config:
        from_attributes = True


class ClubModeratorCreate(BaseModel):
    club_id: str
    instructor_id: str
    is_chief: bool = False
    academic_year_id: str


class ClubMemberCreate(BaseModel):
    club_id: str
    student_id: str
    role: str = "member"
    academic_year_id: str


class ClubMemberUpdate(BaseModel):
    role: str


class ClubPostCreate(BaseModel):
    club_id: str
    title: str
    body: str | None = None
    academic_year_id: str | None = None


def _is_admin(user: User) -> bool:
    return getattr(user, "is_superuser", False) or (user.role or "").lower() == "admin"


def _is_chief_moderator(db: Session, user: User, club_id: str, academic_year_id: str | None) -> bool:
    # Check if current user is instructor and chief moderator of this club
    # For simplicity: check ClubModerator where club_id and is_chief=True; instructor linked to user if we had user_id on Instructor
    # We don't have user_id on Instructor; so chief moderator actions could be restricted by role "instructor" + some permission. Plan says "chief moderator can create posts and assign member roles". So we need to know which instructor is the current user. If User has no link to Instructor, we can allow any admin or instructor to act as chief for now, or add instructor_id to User. For now: admin can do everything; if user is instructor, allow if they are chief moderator. So we need Instructor.user_id. Leave it for now: only admin can assign member roles and create posts, or we allow any authenticated user to create posts for a club (and admin to assign roles). Plan: "Chief moderator: create/edit/delete ClubPost; assign ClubMember roles". So we need to identify chief moderator. Option: store user_id on Instructor. Then in clubs we check ClubModerator where instructor_id = (instructor linked to current user). Let me add a simple check: if user is admin, allow. Else if we have instructor with user_id=current_user.id and that instructor is chief moderator for this club, allow. So we need Instructor.user_id. Add it to Instructor model.
    if _is_admin(user):
        return True
    # Check instructor linked to user
    instr = db.query(Instructor).filter(Instructor.employee_id == user.id).first()  # or add user_id to Instructor
    if not instr:
        return False
    mod = db.query(ClubModerator).filter(
        ClubModerator.club_id == club_id,
        ClubModerator.instructor_id == instr.id,
        ClubModerator.is_chief == True,
    )
    if academic_year_id:
        mod = mod.filter(ClubModerator.academic_year_id == academic_year_id)
    return mod.first() is not None


@router.get("", response_model=list[ClubResponse])
def list_clubs(
    db: Session = Depends(get_db),
    academic_year_id: str | None = None,
    is_active: bool | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Club)
    if academic_year_id:
        q = q.filter(Club.academic_year_id == academic_year_id)
    if is_active is not None:
        q = q.filter(Club.is_active == is_active)
    rows = q.offset(skip).limit(limit).all()
    return [ClubResponse(id=r.id, name=r.name, description=r.description, academic_year_id=r.academic_year_id, is_active=r.is_active) for r in rows]


@router.post("", response_model=ClubResponse)
def create_club(
    body: ClubCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Only admin can create clubs")
    cid = new_id("CLB")
    c = Club(id=cid, name=body.name, description=body.description, academic_year_id=body.academic_year_id, is_active=body.is_active)
    db.add(c)
    db.commit()
    db.refresh(c)
    return ClubResponse(id=c.id, name=c.name, description=c.description, academic_year_id=c.academic_year_id, is_active=c.is_active)


@router.get("/{club_id}", response_model=ClubResponse)
def get_club(
    club_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Club).filter(Club.id == club_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Club not found")
    return ClubResponse(id=c.id, name=c.name, description=c.description, academic_year_id=c.academic_year_id, is_active=c.is_active)


@router.patch("/{club_id}", response_model=ClubResponse)
def update_club(
    club_id: str,
    body: ClubUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Only admin can update clubs")
    c = db.query(Club).filter(Club.id == club_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Club not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return ClubResponse(id=c.id, name=c.name, description=c.description, academic_year_id=c.academic_year_id, is_active=c.is_active)


# Moderators (admin only)
@router.get("/{club_id}/moderators")
def list_moderators(
    club_id: str,
    academic_year_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ClubModerator).filter(ClubModerator.club_id == club_id)
    if academic_year_id:
        q = q.filter(ClubModerator.academic_year_id == academic_year_id)
    rows = q.all()
    return [
        {
            "id": r.id,
            "instructor_id": r.instructor_id,
            "instructor_name": db.query(Instructor).filter(Instructor.id == r.instructor_id).first().instructor_name if r.instructor_id else None,
            "is_chief": r.is_chief,
            "academic_year_id": r.academic_year_id,
        }
        for r in rows
    ]


@router.post("/moderators")
def add_moderator(
    body: ClubModeratorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Only admin can add moderators")
    if db.query(Club).filter(Club.id == body.club_id).first() is None:
        raise HTTPException(status_code=404, detail="Club not found")
    if db.query(Instructor).filter(Instructor.id == body.instructor_id).first() is None:
        raise HTTPException(status_code=404, detail="Instructor not found")
    mid = new_id("CLM")
    m = ClubModerator(id=mid, club_id=body.club_id, instructor_id=body.instructor_id, is_chief=body.is_chief, academic_year_id=body.academic_year_id)
    db.add(m)
    db.commit()
    return {"id": m.id, "club_id": m.club_id, "instructor_id": m.instructor_id, "is_chief": m.is_chief}


@router.delete("/moderators/{moderator_id}")
def remove_moderator(
    moderator_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Only admin can remove moderators")
    m = db.query(ClubModerator).filter(ClubModerator.id == moderator_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Moderator not found")
    db.delete(m)
    db.commit()
    return {"message": "Removed"}


# Members (chief moderator can assign roles)
@router.get("/{club_id}/members")
def list_members(
    club_id: str,
    academic_year_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ClubMember).filter(ClubMember.club_id == club_id)
    if academic_year_id:
        q = q.filter(ClubMember.academic_year_id == academic_year_id)
    rows = q.all()
    return [
        {
            "id": r.id,
            "student_id": r.student_id,
            "student_name": db.query(Student).filter(Student.id == r.student_id).first().student_name if r.student_id else None,
            "role": r.role,
            "academic_year_id": r.academic_year_id,
        }
        for r in rows
    ]


@router.post("/members")
def add_member(
    body: ClubMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(Club).filter(Club.id == body.club_id).first() is None:
        raise HTTPException(status_code=404, detail="Club not found")
    if db.query(Student).filter(Student.id == body.student_id).first() is None:
        raise HTTPException(status_code=404, detail="Student not found")
    mid = new_id("CLMB")
    m = ClubMember(id=mid, club_id=body.club_id, student_id=body.student_id, role=body.role, academic_year_id=body.academic_year_id)
    db.add(m)
    db.commit()
    return {"id": m.id, "club_id": m.club_id, "student_id": m.student_id, "role": m.role}


@router.patch("/members/{member_id}")
def update_member_role(
    member_id: str,
    body: ClubMemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    m = db.query(ClubMember).filter(ClubMember.id == member_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    if not _is_admin(current_user) and not _is_chief_moderator(db, current_user, m.club_id, m.academic_year_id):
        raise HTTPException(status_code=403, detail="Only admin or chief moderator can assign roles")
    m.role = body.role
    db.commit()
    return {"id": m.id, "role": m.role}


# Posts (chief moderator can create/edit/delete)
@router.get("/{club_id}/posts")
def list_posts(
    club_id: str,
    academic_year_id: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ClubPost).filter(ClubPost.club_id == club_id)
    if academic_year_id:
        q = q.filter(ClubPost.academic_year_id == academic_year_id)
    rows = q.order_by(ClubPost.created_at.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": r.id,
            "club_id": r.club_id,
            "title": r.title,
            "body": r.body,
            "created_by_id": r.created_by_id,
            "academic_year_id": r.academic_year_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/posts")
def create_post(
    body: ClubPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(Club).filter(Club.id == body.club_id).first() is None:
        raise HTTPException(status_code=404, detail="Club not found")
    if not _is_admin(current_user) and not _is_chief_moderator(db, current_user, body.club_id, body.academic_year_id):
        raise HTTPException(status_code=403, detail="Only admin or chief moderator can create posts")
    pid = new_id("CLP")
    p = ClubPost(id=pid, club_id=body.club_id, created_by_id=current_user.id, title=body.title, body=body.body, academic_year_id=body.academic_year_id)
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "club_id": p.club_id, "title": p.title, "created_at": p.created_at.isoformat() if p.created_at else None}


@router.delete("/posts/{post_id}")
def delete_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(ClubPost).filter(ClubPost.id == post_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    if not _is_admin(current_user) and not _is_chief_moderator(db, current_user, p.club_id, p.academic_year_id):
        raise HTTPException(status_code=403, detail="Only admin or chief moderator can delete posts")
    db.delete(p)
    db.commit()
    return {"message": "Deleted"}
