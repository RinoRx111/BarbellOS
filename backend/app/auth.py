import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings

reusable_oauth2 = HTTPBearer(auto_error=False)

def hash_pin(pin: str) -> str:
    """
    Hash a PIN or password using bcrypt.
    """
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pin.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_pin(pin: str, pin_hash: str) -> bool:
    """
    Verify a PIN or password against its hash.
    """
    try:
        return bcrypt.checkpw(pin.encode("utf-8"), pin_hash.encode("utf-8"))
    except Exception:
        return False

def create_access_token(name: str) -> str:
    payload = {"sub": name}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

def get_current_session(credentials: HTTPAuthorizationCredentials = Depends(reusable_oauth2)):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

