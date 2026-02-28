"""Guardians API + get_student_guardians."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Guardian, StudentGuardian
from app.schemas.student import GuardianCreate, GuardianResponse
from app.core.auth import get_current_user
from app.models import User
from app.services.id_gen import new_id

router = APIRouter(prefix="/guardians", tags=["guardians"])


@router.get("", response_model=list[GuardianResponse])
def list_guardians(
    db: Session = Depends(get_db),
    search: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Guardian)
    if search:
        q = q.filter(Guardian.guardian_name.ilike(f"%{search}%") | Guardian.email_address.ilike(f"%{search}%"))
    rows = q.offset(skip).limit(limit).all()
    return [GuardianResponse(id=r.id, guardian_name=r.guardian_name, email_address=r.email_address, mobile_number=r.mobile_number, alternate_number=r.alternate_number, relation=None) for r in rows]


@router.get("/student/{student_id}", response_model=list[dict])
def get_student_guardians(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return list of guardian ids for a student (like frappe get_student_guardians)."""
    rows = db.query(StudentGuardian).filter(StudentGuardian.parent_id == student_id).all()
    return [{"guardian": r.guardian_id} for r in rows]


@router.post("", response_model=GuardianResponse)
def create_guardian(
    body: GuardianCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gid = new_id("GRD")
    row = Guardian(
        id=gid,
        guardian_name=body.guardian_name,
        email_address=body.email_address,
        mobile_number=body.mobile_number,
        alternate_number=body.alternate_number,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return GuardianResponse(id=row.id, guardian_name=row.guardian_name, email_address=row.email_address, mobile_number=row.mobile_number, alternate_number=row.alternate_number, relation=body.relation)


@router.get("/{guardian_id}", response_model=GuardianResponse)
def get_guardian(
    guardian_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(Guardian).filter(Guardian.id == guardian_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Guardian not found")
    return GuardianResponse(id=r.id, guardian_name=r.guardian_name, email_address=r.email_address, mobile_number=r.mobile_number, alternate_number=r.alternate_number, relation=None)
