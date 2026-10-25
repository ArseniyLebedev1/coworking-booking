"""Day 6-7: searchable catalog, profile editing, uploads and admin reporting."""
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4
import os

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, select, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import Amenity, Booking, Location, Room, RoomAmenity, User
from app.schemas import RoomOut, UserOut

router = APIRouter()
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/uploads"))
ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_UPLOAD_SIZE = 5 * 1024 * 1024


class RoomPage(BaseModel):
    items: list[RoomOut]
    page: int
    page_size: int
    total: int
    pages: int


class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)


class AdminStats(BaseModel):
    users: int
    locations: int
    rooms: int
    confirmed_bookings: int
    cancelled_bookings: int


class AmenityOut(BaseModel):
    id: UUID
    name: str
    description: str | None

@router.get("/amenities", response_model=list[AmenityOut], tags=["Amenities"])
def get_amenities(db: Session = Depends(get_db)):
    return db.scalars(select(Amenity).order_by(Amenity.name)).all()


@router.get("/catalog/rooms", response_model=RoomPage, tags=["Catalog"])
def search_rooms(
    q: str | None = Query(None, max_length=100),
    city: str | None = Query(None, max_length=100),
    room_type: str | None = Query(None, pattern="^(meeting_room|workspace)$"),
    capacity_min: int | None = Query(None, ge=1),
    amenity_id: list[UUID] | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(9, ge=1, le=50),
    db: Session = Depends(get_db),
):
    statement = select(Room).join(Location, Room.location_id == Location.id).where(Room.is_active.is_(True))
    if q and q.strip():
        term = f"%{q.strip()}%"
        statement = statement.where(or_(
            Room.name.ilike(term),
            Room.description.ilike(term),
            Location.name.ilike(term),
        ))
    if city and city.strip():
        statement = statement.where(Location.city.ilike(city.strip()))
    if room_type:
        statement = statement.where(Room.type == room_type)
    if capacity_min is not None:
        statement = statement.where(Room.capacity >= capacity_min)
    for selected_id in set(amenity_id or []):
        statement = statement.where(
            select(RoomAmenity.room_id).where(
                RoomAmenity.room_id == Room.id,
                RoomAmenity.amenity_id == selected_id,
            ).exists()
        )
    total = db.scalar(select(func.count()).select_from(statement.order_by(None).subquery())) or 0
    results = db.scalars(
        statement.order_by(Room.name, Room.id).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return RoomPage(
        items=results, page=page, page_size=page_size,
        total=total, pages=(total + page_size - 1) // page_size,
    )


@router.patch("/users/me", response_model=UserOut, tags=["Users"])
def change_profile(
    data: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user.full_name = data.full_name.strip()
    db.commit()
    db.refresh(user)
    return UserOut(
        id=user.id, email=user.email, full_name=user.full_name,
        is_blocked=user.is_blocked, role=user.role.name,
    )


@router.get("/admin/stats", response_model=AdminStats, tags=["Admin"])
def dashboard(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    def count(table):
        return db.scalar(select(func.count()).select_from(table)) or 0
    return AdminStats(
        users=count(User),
        locations=count(Location),
        rooms=count(Room),
        confirmed_bookings=db.scalar(
            select(func.count()).select_from(Booking).where(Booking.status == "confirmed")
        ) or 0,
        cancelled_bookings=db.scalar(
            select(func.count()).select_from(Booking).where(Booking.status == "cancelled")
        ) or 0,
    )


@router.get("/rooms/{room_id}/amenities", response_model=list[AmenityOut], tags=["Amenities"])
def room_amenities(room_id: UUID, db: Session = Depends(get_db)):
    if db.get(Room, room_id) is None:
        raise HTTPException(404, "Room not found")
    return db.scalars(
        select(Amenity).join(RoomAmenity).where(RoomAmenity.room_id == room_id).order_by(Amenity.name)
    ).all()


@router.post("/rooms/{room_id}/image", response_model=RoomOut, tags=["Uploads"])
async def upload_room_image(
    room_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(404, "Room not found")
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, "Only JPEG, PNG and WebP images are allowed")
    try:
        content = await file.read(MAX_UPLOAD_SIZE + 1)
    finally:
        await file.close()
    if not content or len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(413, "Image must be 1 byte to 5 MB")
    kind = file.content_type
    valid = (
        (kind == "image/jpeg" and content.startswith(bytes.fromhex("ffd8ff"))) or
        (kind == "image/png" and content.startswith(bytes.fromhex("89504e470d0a1a0a"))) or
        (kind == "image/webp" and content[:4] == b"RIFF" and content[8:12] == b"WEBP")
    )
    if not valid:
        raise HTTPException(415, "Invalid image file signature")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{ALLOWED_TYPES[kind]}"
    dest = UPLOAD_DIR / filename
    try:
        dest.write_bytes(content)
    except OSError:
        raise HTTPException(500, "Could not save image")
    old_image = room.image_url
    try:
        room.image_url = f"/uploads/{filename}"
        db.commit()
        db.refresh(room)
    except Exception:
        db.rollback()
        dest.unlink(missing_ok=True)
        raise
    if old_image and old_image.startswith("/uploads/"):
        old_path = UPLOAD_DIR / old_image.rsplit("/", 1)[-1]
        old_path.unlink(missing_ok=True)
    return room
