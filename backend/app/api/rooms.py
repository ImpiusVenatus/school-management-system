"""Rooms API."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Room
from app.core.auth import get_current_user
from app.models import User
from pydantic import BaseModel
from app.services.id_gen import new_id

router = APIRouter(prefix="/rooms", tags=["rooms"])


class RoomBase(BaseModel):
    room_name: str
    room_number: str | None = None
    seating_capacity: str | None = None


class RoomCreate(RoomBase):
    pass


class RoomResponse(RoomBase):
    id: str

    class Config:
        from_attributes = True


@router.get("", response_model=list[RoomResponse])
def list_rooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Room).all()


@router.post("", response_model=RoomResponse)
def create_room(
    body: RoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rid = new_id("ROM")
    row = Room(id=rid, room_name=body.room_name, room_number=body.room_number, seating_capacity=body.seating_capacity)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{room_id}", response_model=RoomResponse)
def get_room(
    room_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(Room).filter(Room.id == room_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Room not found")
    return r
