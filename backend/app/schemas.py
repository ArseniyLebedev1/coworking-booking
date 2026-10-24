from datetime import datetime
from uuid import UUID
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=255)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(ORMModel):
    id: UUID
    email: EmailStr
    full_name: str
    is_blocked: bool
    role: str | None = None

class LocationIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    address: str = Field(min_length=1, max_length=255)
    city: str = Field(min_length=1, max_length=100)
    description: str | None = None

class LocationOut(LocationIn, ORMModel):
    id: UUID

class RoomIn(BaseModel):
    location_id: UUID
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    type: Literal["meeting_room", "workspace"]
    capacity: int = Field(gt=0)
    is_active: bool = True
    image_url: str | None = None

class RoomOut(RoomIn, ORMModel):
    id: UUID

class BookingIn(BaseModel):
    room_id: UUID
    start_time: datetime
    end_time: datetime

    @model_validator(mode="after")
    def check_times(self):
        if self.start_time.tzinfo is None or self.end_time.tzinfo is None:
            raise ValueError("Times must include timezone")
        if self.start_time >= self.end_time:
            raise ValueError("end_time must be later than start_time")
        return self

class BookingOut(ORMModel):
    id: UUID
    user_id: UUID
    room_id: UUID
    start_time: datetime
    end_time: datetime
    status: str
