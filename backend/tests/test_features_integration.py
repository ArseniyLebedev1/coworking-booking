import io
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

os.environ.setdefault("JWT_SECRET_KEY", "integration-tests-only")
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.database import SessionLocal
from app.main import app
from app.models import Role, Room, User
from app.security import hash_password

client = TestClient(app)

def admin_headers():
    email = f"admin-{uuid4().hex}@example.org"
    with SessionLocal.begin() as db:
        role = db.scalar(select(Role).where(Role.name == "admin"))
        user = User(email=email, full_name="Test Admin", password_hash=hash_password("testpassword99"), role_id=role.id)
        db.add(user)
    resp = client.post("/auth/login", json={"email": email, "password": "testpassword99"})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}

def test_catalog_filters_and_pages():
    all_rooms = client.get("/rooms").json()
    assert all_rooms
    target = all_rooms[0]
    res = client.get("/catalog/rooms", params={"q": target["name"], "page_size": 1})
    assert res.status_code == 200, res.text
    assert res.json()["total"] >= 1
    assert len(res.json()["items"]) == 1
    assert res.json()["items"][0]["id"] == target["id"]
    assert client.get("/catalog/rooms?capacity_min=100000").json()["items"] == []
    assert client.get("/amenities").status_code == 200

def test_admin_dashboard_and_upload():
    headers = admin_headers()
    stats = client.get("/admin/stats", headers=headers)
    assert stats.status_code == 200, stats.text
    assert stats.json()["rooms"] >= 3
    room_id = client.get("/rooms").json()[0]["id"]
    bad = client.post(f"/rooms/{room_id}/image", headers=headers,
                      files={"file": ("invalid.png", b"not an image", "image/png")})
    assert bad.status_code == 415
    png = bytes.fromhex("89504e470d0a1a0a") + b"fake-for-test"
    uploaded = client.post(f"/rooms/{room_id}/image", headers=headers,
                           files={"file": ("sample.png", png, "image/png")})
    assert uploaded.status_code == 200, uploaded.text
    url = uploaded.json()["image_url"]
    assert url.startswith("/uploads/")
    assert client.get(url).status_code == 200

def test_profile_edit():
    email = f"member-{uuid4().hex}@example.org"
    reg = client.post("/auth/register", json={"email": email, "password": "safePassword44", "full_name": "New User"})
    assert reg.status_code == 201
    token = client.post("/auth/login", json={"email": email, "password": "safePassword44"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    response = client.patch("/users/me", headers=headers, json={"full_name": "Updated User"})
    assert response.status_code == 200, response.text
    assert response.json()["full_name"] == "Updated User"
    assert client.get("/admin/stats", headers=headers).status_code == 403
