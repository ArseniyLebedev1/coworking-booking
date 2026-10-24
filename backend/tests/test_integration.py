import os
from uuid import uuid4
from datetime import datetime, timedelta, timezone
os.environ.setdefault("JWT_SECRET_KEY", "integration-tests-only")
from fastapi.testclient import TestClient
from app.database import SessionLocal
from app.main import app

client = TestClient(app)

def test_register_login_and_booking():
    email = f"ci-{uuid4().hex}@example.org"
    response = client.post("/auth/register", json={"email": email, "password": "GoodPassword123!", "full_name": "CI Tester"})
    assert response.status_code == 201, response.text
    response = client.post("/auth/login", json={"email": email, "password": "GoodPassword123!"})
    assert response.status_code == 200, response.text
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    profile = client.get("/users/me", headers=headers)
    assert profile.status_code == 200 and profile.json()["role"] == "employee"
    rooms = client.get("/rooms").json()
    assert rooms
    start = datetime.now(timezone.utc) + timedelta(days=90)
    end = start + timedelta(hours=1)
    data = {"room_id": rooms[0]["id"], "start_time": start.isoformat(), "end_time": end.isoformat()}
    booking = client.post("/bookings", headers=headers, json=data)
    assert booking.status_code == 201, booking.text
    assert client.post("/bookings", headers=headers, json=data).status_code == 409
    own = client.get("/bookings/me", headers=headers)
    assert own.status_code == 200 and any(b["id"] == booking.json()["id"] for b in own.json())
    cancelled = client.post(f"/bookings/{booking.json()['id']}/cancel", headers=headers)
    assert cancelled.status_code == 200 and cancelled.json()["status"] == "cancelled"
    assert client.post("/bookings", headers=headers, json=data).status_code == 201
    assert client.get("/admin/users", headers=headers).status_code == 403
