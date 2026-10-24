from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import User
from app.security import decode_access_token

bearer = HTTPBearer(auto_error=False)

def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    user_id = decode_access_token(credentials.credentials) if credentials and credentials.scheme.lower() == "bearer" else None
    if not user_id:
        raise HTTPException(401, "Invalid or missing access token", headers={"WWW-Authenticate": "Bearer"})
    user = db.scalar(select(User).options(joinedload(User.role)).where(User.id == user_id))
    if not user or user.is_blocked:
        raise HTTPException(401, "User not found or blocked")
    return user

def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role.name != "admin":
        raise HTTPException(403, "Administrator access required")
    return user
