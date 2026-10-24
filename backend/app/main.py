from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import Booking, Location, Role, Room, User
from app.schemas import BookingIn, BookingOut, LocationIn, LocationOut, LoginIn, RegisterIn, RoomIn, RoomOut, TokenOut, UserOut
from app.security import create_access_token, hash_password, verify_password

app = FastAPI(title="Coworking Booking API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}

def user_out(user: User) -> UserOut:
    return UserOut(id=user.id, email=user.email, full_name=user.full_name, is_blocked=user.is_blocked, role=user.role.name if user.role else None)

@app.post("/auth/register", response_model=UserOut, status_code=201, tags=["Auth"])
def register(data: RegisterIn, db: Session = Depends(get_db)):
    email = str(data.email).lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(409, "Email already registered")
    role = db.scalar(select(Role).where(Role.name == "employee"))
    if role is None:
        raise HTTPException(503, "Roles not seeded")
    user = User(email=email, password_hash=hash_password(data.password), full_name=data.full_name, role_id=role.id)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Email already registered")
    db.refresh(user)
    user.role = role
    return user_out(user)

@app.post("/auth/login", response_model=TokenOut, tags=["Auth"])
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == str(data.email).lower()))
    if not user or user.is_blocked or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    return TokenOut(access_token=create_access_token(user.id))

@app.get("/users/me", response_model=UserOut, tags=["Users"])
def me(user: User = Depends(get_current_user)):
    return user_out(user)

@app.get("/locations", response_model=list[LocationOut], tags=["Locations"])
def list_locations(db: Session = Depends(get_db)):
    return db.scalars(select(Location).order_by(Location.name)).all()

@app.get("/locations/{location_id}", response_model=LocationOut, tags=["Locations"])
def get_location(location_id: UUID, db: Session = Depends(get_db)):
    location = db.get(Location, location_id)
    if not location:
        raise HTTPException(404, "Location not found")
    return location

@app.post("/locations", response_model=LocationOut, status_code=201, tags=["Locations"])
def create_location(data: LocationIn, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    location = Location(**data.model_dump())
    db.add(location)
    db.commit()
    db.refresh(location)
    return location

@app.put("/locations/{location_id}", response_model=LocationOut, tags=["Locations"])
def update_location(location_id: UUID, data: LocationIn, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    location = db.get(Location, location_id)
    if not location:
        raise HTTPException(404, "Location not found")
    for key, value in data.model_dump().items():
        setattr(location, key, value)
    db.commit()
    db.refresh(location)
    return location

@app.delete("/locations/{location_id}", status_code=204, tags=["Locations"])
def delete_location(location_id: UUID, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    location = db.get(Location, location_id)
    if not location:
        raise HTTPException(404, "Location not found")
    if db.scalar(select(Room.id).where(Room.location_id == location_id).limit(1)):
        raise HTTPException(409, "Location contains rooms")
    db.delete(location)
    db.commit()

@app.get("/rooms", response_model=list[RoomOut], tags=["Rooms"])
def list_rooms(db: Session = Depends(get_db)):
    return db.scalars(select(Room).order_by(Room.name)).all()

@app.get("/rooms/{room_id}", response_model=RoomOut, tags=["Rooms"])
def get_room(room_id: UUID, db: Session = Depends(get_db)):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    return room

@app.post("/rooms", response_model=RoomOut, status_code=201, tags=["Rooms"])
def create_room(data: RoomIn, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if not db.get(Location, data.location_id):
        raise HTTPException(404, "Location not found")
    room = Room(**data.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return room

@app.put("/rooms/{room_id}", response_model=RoomOut, tags=["Rooms"])
def update_room(room_id: UUID, data: RoomIn, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    if not db.get(Location, data.location_id):
        raise HTTPException(404, "Location not found")
    for key, value in data.model_dump().items():
        setattr(room, key, value)
    db.commit()
    db.refresh(room)
    return room

@app.delete("/rooms/{room_id}", status_code=204, tags=["Rooms"])
def delete_room(room_id: UUID, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    if db.scalar(select(Booking.id).where(Booking.room_id == room_id).limit(1)):
        raise HTTPException(409, "Room has bookings: deactivate instead")
    db.delete(room)
    db.commit()

@app.post("/bookings", response_model=BookingOut, status_code=201, tags=["Bookings"])
def create_booking(data: BookingIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if data.start_time.astimezone(timezone.utc) <= datetime.now(timezone.utc):
        raise HTTPException(422, "Start time must be in the future")
    room = db.get(Room, data.room_id)
    if not room or not room.is_active:
        raise HTTPException(404, "Active room not found")
    clash = db.scalar(select(Booking.id).where(Booking.room_id == data.room_id, Booking.status == "confirmed", Booking.start_time < data.end_time, Booking.end_time > data.start_time).limit(1))
    if clash:
        raise HTTPException(409, "Time slot already booked")
    booking = Booking(user_id=user.id, **data.model_dump())
    db.add(booking)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Time slot already booked")
    db.refresh(booking)
    return booking

@app.get("/bookings/me", response_model=list[BookingOut], tags=["Bookings"])
def my_bookings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(select(Booking).where(Booking.user_id == user.id).order_by(Booking.start_time.desc())).all()

@app.get("/bookings", response_model=list[BookingOut], tags=["Bookings"])
def all_bookings(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.scalars(select(Booking).order_by(Booking.start_time.desc())).all()

@app.post("/bookings/{booking_id}/cancel", response_model=BookingOut, tags=["Bookings"])
def cancel_booking(booking_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking.user_id != user.id and user.role.name != "admin":
        raise HTTPException(403, "Not your booking")
    booking.status = "cancelled"
    db.commit()
    db.refresh(booking)
    return booking

@app.get("/admin/users", response_model=list[UserOut], tags=["Admin"])
def admin_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return [user_out(u) for u in db.scalars(select(User).order_by(User.created_at.desc())).all()]

@app.patch("/admin/users/{user_id}/block", response_model=UserOut, tags=["Admin"])
def admin_block(user_id: UUID, blocked: bool = True, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id and blocked:
        raise HTTPException(400, "Cannot block your own account")
    user.is_blocked = blocked
    db.commit()
    db.refresh(user)
    return user_out(user)
