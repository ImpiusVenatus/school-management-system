"""File upload, list, download, delete (local storage; swappable later)."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import FileRecord, User
from app.core.auth import get_current_user
from app.services.storage import get_storage, unique_filename
from app.services.id_gen import new_id

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload")
def upload_file(
    file: UploadFile = File(...),
    category: str = Query("general"),
    related_entity_type: str | None = None,
    related_entity_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a file; optional category and related entity. Returns id, url, filename."""
    storage = get_storage()
    path = f"{category}/{unique_filename(file.filename or 'file')}"
    storage.save(file.file, path)
    full_path = storage.get_path(path)
    size = full_path.stat().st_size if full_path and full_path.is_file() else None
    fid = new_id("FIL")
    rec = FileRecord(
        id=fid,
        file_path=path,
        original_filename=file.filename or "file",
        content_type=file.content_type,
        category=category,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
        uploaded_by_id=current_user.id,
        file_size=size,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return {
        "id": rec.id,
        "url": f"/api/files/serve/{rec.id}",
        "filename": rec.original_filename,
        "category": rec.category,
    }


@router.get("")
def list_files(
    db: Session = Depends(get_db),
    category: str | None = None,
    related_entity_type: str | None = None,
    related_entity_id: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    q = db.query(FileRecord)
    if category:
        q = q.filter(FileRecord.category == category)
    if related_entity_type:
        q = q.filter(FileRecord.related_entity_type == related_entity_type)
    if related_entity_id:
        q = q.filter(FileRecord.related_entity_id == related_entity_id)
    rows = q.order_by(FileRecord.created_at.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": r.id,
            "original_filename": r.original_filename,
            "content_type": r.content_type,
            "category": r.category,
            "related_entity_type": r.related_entity_type,
            "related_entity_id": r.related_entity_id,
            "file_size": r.file_size,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/serve/{file_id}")
def serve_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream file for download (auth required)."""
    rec = db.query(FileRecord).filter(FileRecord.id == file_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")
    storage = get_storage()
    path = storage.get_path(rec.file_path)
    if not path or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(
        path,
        filename=rec.original_filename,
        media_type=rec.content_type or "application/octet-stream",
    )


@router.get("/{file_id}")
def get_file_metadata(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rec = db.query(FileRecord).filter(FileRecord.id == file_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")
    return {
        "id": rec.id,
        "original_filename": rec.original_filename,
        "content_type": rec.content_type,
        "category": rec.category,
        "related_entity_type": rec.related_entity_type,
        "related_entity_id": rec.related_entity_id,
        "file_size": rec.file_size,
        "created_at": rec.created_at.isoformat() if rec.created_at else None,
    }


@router.get("/{file_id}/download")
def download_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download file (same as serve but with auth required)."""
    rec = db.query(FileRecord).filter(FileRecord.id == file_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")
    storage = get_storage()
    path = storage.get_path(rec.file_path)
    if not path or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(
        path,
        filename=rec.original_filename,
        media_type=rec.content_type or "application/octet-stream",
    )


@router.delete("/{file_id}")
def delete_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rec = db.query(FileRecord).filter(FileRecord.id == file_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")
    storage = get_storage()
    storage.delete(rec.file_path)
    db.delete(rec)
    db.commit()
    return {"message": "Deleted"}
