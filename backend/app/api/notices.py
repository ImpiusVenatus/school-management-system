"""Notices and notice categories API."""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Notice, NoticeCategory, User
from app.core.auth import require_permission
from app.services.id_gen import new_id
from pydantic import BaseModel

router = APIRouter(prefix="/notices", tags=["notices"])


class NoticeCategoryBase(BaseModel):
    name: str
    slug: str | None = None


class NoticeCategoryCreate(NoticeCategoryBase):
    pass


class NoticeCategoryResponse(NoticeCategoryBase):
    id: str
    idx: int = 0

    class Config:
        from_attributes = True


class NoticeBase(BaseModel):
    category_id: str
    title: str
    body: str | None = None
    pinned: bool = False
    valid_from: date | None = None
    valid_until: date | None = None


class NoticeCreate(NoticeBase):
    pass


class NoticeUpdate(BaseModel):
    category_id: str | None = None
    title: str | None = None
    body: str | None = None
    pinned: bool | None = None
    valid_from: date | None = None
    valid_until: date | None = None


class NoticeResponse(NoticeBase):
    id: str
    created_by_id: str | None = None
    created_at: str | None = None

    class Config:
        from_attributes = True


def _is_admin(user: User) -> bool:
    return getattr(user, "is_superuser", False) or (user.role or "").lower() == "admin"


# Categories (admin)
@router.get("/categories", response_model=list[NoticeCategoryResponse])
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("notices.read")),
):
    rows = db.query(NoticeCategory).order_by(NoticeCategory.idx, NoticeCategory.name).all()
    return [NoticeCategoryResponse(id=r.id, name=r.name, slug=r.slug, idx=r.idx or 0) for r in rows]


@router.post("/categories", response_model=NoticeCategoryResponse)
def create_category(
    body: NoticeCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("notices.publish")),
):
    cid = body.name.replace(" ", "-")[:30] or new_id("NC")
    c = NoticeCategory(id=cid, name=body.name, slug=body.slug)
    db.add(c)
    db.commit()
    db.refresh(c)
    return NoticeCategoryResponse(id=c.id, name=c.name, slug=c.slug, idx=c.idx or 0)


@router.patch("/categories/{category_id}", response_model=NoticeCategoryResponse)
def update_category(
    category_id: str,
    body: NoticeCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("notices.publish")),
):
    c = db.query(NoticeCategory).filter(NoticeCategory.id == category_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")
    c.name = body.name
    c.slug = body.slug
    db.commit()
    db.refresh(c)
    return NoticeCategoryResponse(id=c.id, name=c.name, slug=c.slug, idx=c.idx or 0)


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("notices.publish")),
):
    c = db.query(NoticeCategory).filter(NoticeCategory.id == category_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(c)
    db.commit()
    return {"message": "Deleted"}


# Notices
@router.get("", response_model=list[NoticeResponse])
def list_notices(
    db: Session = Depends(get_db),
    category_id: str | None = None,
    pinned: bool | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(require_permission("notices.read")),
):
    q = db.query(Notice)
    if category_id:
        q = q.filter(Notice.category_id == category_id)
    if pinned is not None:
        q = q.filter(Notice.pinned == pinned)
    rows = q.order_by(Notice.pinned.desc(), Notice.created_at.desc()).offset(skip).limit(limit).all()
    return [
        NoticeResponse(
            id=r.id,
            category_id=r.category_id,
            title=r.title,
            body=r.body,
            pinned=r.pinned,
            valid_from=r.valid_from,
            valid_until=r.valid_until,
            created_by_id=r.created_by_id,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]


@router.post("", response_model=NoticeResponse)
def create_notice(
    body: NoticeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("notices.publish")),
):
    if db.query(NoticeCategory).filter(NoticeCategory.id == body.category_id).first() is None:
        raise HTTPException(status_code=404, detail="Category not found")
    nid = new_id("NTC")
    n = Notice(
        id=nid,
        category_id=body.category_id,
        title=body.title,
        body=body.body,
        pinned=body.pinned,
        valid_from=body.valid_from,
        valid_until=body.valid_until,
        created_by_id=current_user.id,
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return NoticeResponse(
        id=n.id,
        category_id=n.category_id,
        title=n.title,
        body=n.body,
        pinned=n.pinned,
        valid_from=n.valid_from,
        valid_until=n.valid_until,
        created_by_id=n.created_by_id,
        created_at=n.created_at.isoformat() if n.created_at else None,
    )


@router.get("/{notice_id}", response_model=NoticeResponse)
def get_notice(
    notice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("notices.read")),
):
    r = db.query(Notice).filter(Notice.id == notice_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Notice not found")
    return NoticeResponse(
        id=r.id,
        category_id=r.category_id,
        title=r.title,
        body=r.body,
        pinned=r.pinned,
        valid_from=r.valid_from,
        valid_until=r.valid_until,
        created_by_id=r.created_by_id,
        created_at=r.created_at.isoformat() if r.created_at else None,
    )


@router.patch("/{notice_id}", response_model=NoticeResponse)
def update_notice(
    notice_id: str,
    body: NoticeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("notices.publish")),
):
    r = db.query(Notice).filter(Notice.id == notice_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Notice not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return NoticeResponse(
        id=r.id,
        category_id=r.category_id,
        title=r.title,
        body=r.body,
        pinned=r.pinned,
        valid_from=r.valid_from,
        valid_until=r.valid_until,
        created_by_id=r.created_by_id,
        created_at=r.created_at.isoformat() if r.created_at else None,
    )


@router.delete("/{notice_id}")
def delete_notice(
    notice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("notices.publish")),
):
    r = db.query(Notice).filter(Notice.id == notice_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Notice not found")
    db.delete(r)
    db.commit()
    return {"message": "Deleted"}
