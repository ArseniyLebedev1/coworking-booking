import os
from uuid import uuid4
os.environ.setdefault("JWT_SECRET_KEY", "unit-tests-only-not-production")
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas import BookingIn
from app.security import hash_password, verify_password, create_access_token, decode_access_token

client = TestClient(app)

def test_health():
    assert client.get("/health").json() == {"status": "ok"}

def test_password_hashing():
    hashed = hash_password("password123")
    assert hashed != "password123"
    assert verify_password("password123", hashed)
    assert not verify_password("incorrect", hashed)

def test_jwt_roundtrip():
    user_id = uuid4()
    assert decode_access_token(create_access_token(user_id)) == user_id
    assert decode_access_token("invalid.token.here") is None

def test_booking_invalid_times():
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        BookingIn(room_id=uuid4(), start_time="2027-01-01T12:00:00Z", end_time="2027-01-01T11:00:00Z")

def test_private_route_needs_auth():
    assert client.get("/users/me").status_code == 401
