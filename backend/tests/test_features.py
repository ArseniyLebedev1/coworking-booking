import io
import os
from uuid import uuid4

os.environ.setdefault("JWT_SECRET_KEY", "unit-tests-only-not-production")
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.features import MAX_UPLOAD_SIZE, ProfileUpdate, RoomPage
from app.main import app

client = TestClient(app)

def test_catalog_validates_pagination_without_database():
    response = client.get("/catalog/rooms?page=0")
    assert response.status_code == 422
    response = client.get("/catalog/rooms?page_size=1000")
    assert response.status_code == 422
    response = client.get("/catalog/rooms?room_type=unrecognized")
    assert response.status_code == 422

def test_upload_protected():
    response = client.post(
        f"/rooms/{uuid4()}/image",
        files={"file": ("photo.png", io.BytesIO(b"invalid"), "image/png")},
    )
    assert response.status_code in (401, 403)

def test_admin_stats_protected():
    assert client.get("/admin/stats").status_code == 401

def test_profile_validation():
    try:
        ProfileUpdate(full_name="x")
        assert False, "Too short name must fail"
    except ValidationError:
        pass

def test_page_contract():
    page = RoomPage(items=[], page=1, page_size=9, total=0, pages=0)
    assert page.model_dump()["items"] == []
    assert MAX_UPLOAD_SIZE == 5 * 1024 * 1024
