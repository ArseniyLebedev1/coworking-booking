from datetime import datetime, timedelta, timezone
from uuid import UUID
import jwt
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from app.config import get_settings

password_hash = PasswordHash.recommended()
ALGORITHM = "HS256"

def hash_password(password: str) -> str:
    return password_hash.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)

def create_access_token(user_id: UUID) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": str(user_id), "iat": now, "exp": now + timedelta(minutes=30), "type": "access"}, get_settings().jwt_secret_key, algorithm=ALGORITHM)

def decode_access_token(token: str) -> UUID | None:
    try:
        data = jwt.decode(token, get_settings().jwt_secret_key, algorithms=[ALGORITHM], options={"require": ["sub", "iat", "exp"]})
        return UUID(data["sub"]) if data.get("type") == "access" else None
    except (InvalidTokenError, ValueError, TypeError, KeyError):
        return None
