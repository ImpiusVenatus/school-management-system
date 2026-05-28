"""School clubs: CRUD, moderators, members, posts, and configurable officer roles.

Admin-managed for now (no teacher/student self-service).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Club, ClubModerator, ClubMember, ClubPost, ClubRole, Instructor, Student
from app.core.auth import require_permission
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


class ClubRoleCreate(BaseModel):
    academic_year_id: str
    name: str
    rank: int = 0
    is_unique: bool = False


class ClubRoleUpdate(BaseModel):
    name: str | None = None
    rank: int | None = None
    is_unique: bool | None = None


class ClubRoleResponse(BaseModel):
    id: str
    club_id: str
    academic_year_id: str
    name: str
    rank: int
    is_unique: bool


class ClubMemberCreate(BaseModel):
    club_id: str
    student_id: str
    role_id: str | None = None
    role_name: str | None = "member"
    academic_year_id: str


class ClubMemberUpdate(BaseModel):
    role_id: str | None = None
    role_name: str | None = None


class ClubPostCreate(BaseModel):
    club_id: str
    title: str
    body: str | None = None
    academic_year_id: str | None = None


def _is_admin(user: User) -> bool:
    return getattr(user, "is_superuser", False) or (user.role or "").lower() == "admin"


def _effective_member_role_name(m: ClubMember) -> str:
    return (getattr(m, "role_name", None) or getattr(m, "role", None) or "member") or "member"


def _ensure_role_belongs_to_club_year(db: Session, club_id: str, academic_year_id: str, role_id: str) -> ClubRole:
    r = (
        db.query(ClubRole)
        .filter(
            ClubRole.id == role_id,
            ClubRole.club_id == club_id,
            ClubRole.academic_year_id == academic_year_id,
        )
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Role not found for this club/year")
    return r


def _enforce_unique_role_assignment(db: Session, club_id: str, academic_year_id: str, role: ClubRole, member_id: str) -> None:
    if not role.is_unique:
        return
    existing = (
        db.query(ClubMember)
        .filter(
            ClubMember.club_id == club_id,
            ClubMember.academic_year_id == academic_year_id,
            ClubMember.role_id == role.id,
            ClubMember.id != member_id,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail=f'Role "{role.name}" is unique and already assigned')


@router.get("", response_model=list[ClubResponse])
def list_clubs(
    db: Session = Depends(get_db),
    academic_year_id: str | None = None,
    is_active: bool | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(require_permission("clubs.read")),
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
    current_user: User = Depends(require_permission("clubs.manage")),
):
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
    current_user: User = Depends(require_permission("clubs.read")),
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
    current_user: User = Depends(require_permission("clubs.manage")),
):
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
    current_user: User = Depends(require_permission("clubs.read")),
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
    current_user: User = Depends(require_permission("clubs.manage")),
):
    if db.query(Club).filter(Club.id == body.club_id).first() is None:
        raise HTTPException(status_code=404, detail="Club not found")
    if db.query(Instructor).filter(Instructor.id == body.instructor_id).first() is None:
        raise HTTPException(status_code=404, detail="Instructor not found")
    existing = (
        db.query(ClubModerator)
        .filter(
            ClubModerator.club_id == body.club_id,
            ClubModerator.instructor_id == body.instructor_id,
            ClubModerator.academic_year_id == body.academic_year_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Instructor is already a moderator for this club/year")
    if body.is_chief:
        (
            db.query(ClubModerator)
            .filter(
                ClubModerator.club_id == body.club_id,
                ClubModerator.academic_year_id == body.academic_year_id,
                ClubModerator.is_chief == True,
            )
            .update({"is_chief": False})
        )
    mid = new_id("CLM")
    m = ClubModerator(id=mid, club_id=body.club_id, instructor_id=body.instructor_id, is_chief=body.is_chief, academic_year_id=body.academic_year_id)
    db.add(m)
    db.commit()
    return {"id": m.id, "club_id": m.club_id, "instructor_id": m.instructor_id, "is_chief": m.is_chief}


@router.delete("/moderators/{moderator_id}")
def remove_moderator(
    moderator_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clubs.manage")),
):
    m = db.query(ClubModerator).filter(ClubModerator.id == moderator_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Moderator not found")
    db.delete(m)
    db.commit()
    return {"message": "Removed"}


# Members (admin-managed)
@router.get("/{club_id}/members")
def list_members(
    club_id: str,
    academic_year_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clubs.read")),
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
            "role_id": getattr(r, "role_id", None),
            "role_name": _effective_member_role_name(r),
            "academic_year_id": r.academic_year_id,
        }
        for r in rows
    ]


@router.post("/members")
def add_member(
    body: ClubMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clubs.manage")),
):
    if db.query(Club).filter(Club.id == body.club_id).first() is None:
        raise HTTPException(status_code=404, detail="Club not found")
    if db.query(Student).filter(Student.id == body.student_id).first() is None:
        raise HTTPException(status_code=404, detail="Student not found")
    mid = new_id("CLMB")
    role_id = body.role_id
    role_name = (body.role_name or "member").strip() if body.role_name is not None else "member"
    if role_id:
        role_def = _ensure_role_belongs_to_club_year(db, body.club_id, body.academic_year_id, role_id)
        role_name = role_def.name
    m = ClubMember(
        id=mid,
        club_id=body.club_id,
        student_id=body.student_id,
        role=role_name,
        role_id=role_id,
        role_name=role_name,
        academic_year_id=body.academic_year_id,
    )
    db.add(m)
    db.commit()
    return {"id": m.id, "club_id": m.club_id, "student_id": m.student_id, "role_id": getattr(m, "role_id", None), "role_name": _effective_member_role_name(m)}


@router.patch("/members/{member_id}")
def update_member_role(
    member_id: str,
    body: ClubMemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clubs.manage")),
):
    m = db.query(ClubMember).filter(ClubMember.id == member_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    next_role_id = body.role_id
    next_role_name = (body.role_name or "member").strip() if body.role_name is not None else "member"
    if next_role_id:
        role_def = _ensure_role_belongs_to_club_year(db, m.club_id, m.academic_year_id, next_role_id)
        _enforce_unique_role_assignment(db, m.club_id, m.academic_year_id, role_def, m.id)
        next_role_name = role_def.name
    m.role_id = next_role_id
    m.role_name = next_role_name
    m.role = next_role_name
    db.commit()
    return {"id": m.id, "role_id": getattr(m, "role_id", None), "role_name": _effective_member_role_name(m)}


# Roles / Officers (admin-only)
@router.get("/{club_id}/roles", response_model=list[ClubRoleResponse])
def list_roles(
    club_id: str,
    academic_year_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clubs.manage")),
):
    rows = (
        db.query(ClubRole)
        .filter(ClubRole.club_id == club_id, ClubRole.academic_year_id == academic_year_id)
        .order_by(ClubRole.rank.asc(), ClubRole.name.asc())
        .all()
    )
    return [
        ClubRoleResponse(
            id=r.id,
            club_id=r.club_id,
            academic_year_id=r.academic_year_id,
            name=r.name,
            rank=r.rank,
            is_unique=r.is_unique,
        )
        for r in rows
    ]


@router.post("/{club_id}/roles", response_model=ClubRoleResponse)
def create_role(
    club_id: str,
    body: ClubRoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clubs.manage")),
):
    if db.query(Club).filter(Club.id == club_id).first() is None:
        raise HTTPException(status_code=404, detail="Club not found")
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Role name is required")
    existing = (
        db.query(ClubRole)
        .filter(ClubRole.club_id == club_id, ClubRole.academic_year_id == body.academic_year_id, ClubRole.name == name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Role already exists")
    rid = new_id("CLR")
    r = ClubRole(
        id=rid,
        club_id=club_id,
        academic_year_id=body.academic_year_id,
        name=name,
        rank=body.rank,
        is_unique=body.is_unique,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return ClubRoleResponse(id=r.id, club_id=r.club_id, academic_year_id=r.academic_year_id, name=r.name, rank=r.rank, is_unique=r.is_unique)


@router.patch("/roles/{role_id}", response_model=ClubRoleResponse)
def update_role(
    role_id: str,
    body: ClubRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clubs.manage")),
):
    r = db.query(ClubRole).filter(ClubRole.id == role_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Role not found")
    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Role name cannot be empty")
        dupe = (
            db.query(ClubRole)
            .filter(
                ClubRole.club_id == r.club_id,
                ClubRole.academic_year_id == r.academic_year_id,
                ClubRole.name == name,
                ClubRole.id != r.id,
            )
            .first()
        )
        if dupe:
            raise HTTPException(status_code=409, detail="Role already exists")
        r.name = name
    if body.rank is not None:
        r.rank = body.rank
    if body.is_unique is not None:
        if body.is_unique:
            cnt = (
                db.query(ClubMember)
                .filter(
                    ClubMember.club_id == r.club_id,
                    ClubMember.academic_year_id == r.academic_year_id,
                    ClubMember.role_id == r.id,
                )
                .count()
            )
            if cnt > 1:
                raise HTTPException(status_code=409, detail="Cannot mark unique: multiple members already assigned")
        r.is_unique = body.is_unique
    db.commit()
    db.refresh(r)
    return ClubRoleResponse(id=r.id, club_id=r.club_id, academic_year_id=r.academic_year_id, name=r.name, rank=r.rank, is_unique=r.is_unique)


@router.delete("/roles/{role_id}")
def delete_role(
    role_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clubs.manage")),
):
    r = db.query(ClubRole).filter(ClubRole.id == role_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Role not found")
    assigned = (
        db.query(ClubMember)
        .filter(
            ClubMember.club_id == r.club_id,
            ClubMember.academic_year_id == r.academic_year_id,
            ClubMember.role_id == r.id,
        )
        .first()
    )
    if assigned is not None:
        raise HTTPException(status_code=409, detail="Role is assigned to members; unassign before deleting")
    db.delete(r)
    db.commit()
    return {"message": "Deleted"}


# Posts (admin-managed)
@router.get("/{club_id}/posts")
def list_posts(
    club_id: str,
    academic_year_id: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clubs.read")),
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
    current_user: User = Depends(require_permission("clubs.manage")),
):
    if db.query(Club).filter(Club.id == body.club_id).first() is None:
        raise HTTPException(status_code=404, detail="Club not found")
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
    current_user: User = Depends(require_permission("clubs.manage")),
):
    p = db.query(ClubPost).filter(ClubPost.id == post_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(p)
    db.commit()
    return {"message": "Deleted"}
