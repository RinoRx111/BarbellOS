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

import base64
import time
import httpx

CLERK_JWKS_CACHE = {
    "keys": None,
    "last_fetched": None
}

def resolve_clerk_jwks_url(publishable_key: str) -> str:
    try:
        parts = publishable_key.split('_')
        if len(parts) >= 3:
            encoded_part = parts[2].split('$')[0]
            padding = len(encoded_part) % 4
            if padding:
                encoded_part += "=" * (4 - padding)
            decoded = base64.b64decode(encoded_part).decode("utf-8")
            return f"https://{decoded}/.well-known/jwks.json"
    except Exception:
        pass
    return "https://api.clerk.com/v1/jwks"

def get_clerk_jwks(jwks_url: str):
    now = time.time()
    if CLERK_JWKS_CACHE["keys"] and CLERK_JWKS_CACHE["last_fetched"] and (now - CLERK_JWKS_CACHE["last_fetched"] < 3600):
        return CLERK_JWKS_CACHE["keys"]
        
    try:
        r = httpx.get(jwks_url, timeout=5.0)
        r.raise_for_status()
        jwks = r.json()
        CLERK_JWKS_CACHE["keys"] = jwks
        CLERK_JWKS_CACHE["last_fetched"] = now
        return jwks
    except Exception as e:
        if CLERK_JWKS_CACHE["keys"]:
            return CLERK_JWKS_CACHE["keys"]
        raise HTTPException(status_code=401, detail=f"Failed to fetch Clerk keys: {str(e)}")

def verify_clerk_jwt(token: str) -> dict:
    from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
    from cryptography.hazmat.backends import default_backend
    
    try:
        unverified_header = jwt.get_unverified_header(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token format")
        
    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(status_code=401, detail="Token missing key identifier kid")
        
    jwks_url = resolve_clerk_jwks_url(settings.CLERK_PUBLISHABLE_KEY)
    jwks = get_clerk_jwks(jwks_url)
    
    target_key = None
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            target_key = key
            break
            
    if not target_key:
        raise HTTPException(status_code=401, detail="Public key not found in JWKS")
        
    def int_from_base64url(s: str) -> int:
        s = s.replace('-', '+').replace('_', '/')
        padding = len(s) % 4
        if padding:
            s += "=" * (4 - padding)
        val = base64.b64decode(s)
        return int.from_bytes(val, byteorder="big")
        
    try:
        n = int_from_base64url(target_key["n"])
        e = int_from_base64url(target_key["e"])
        
        pub_numbers = RSAPublicNumbers(e, n)
        public_key = pub_numbers.public_key(default_backend())
        
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False}
        )
        return payload
    except Exception as err:
        raise HTTPException(status_code=401, detail=f"JWT verification failed: {str(err)}")

def get_current_session(credentials: HTTPAuthorizationCredentials = Depends(reusable_oauth2)):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    
    # Check if Clerk is active
    if settings.CLERK_SECRET_KEY and settings.CLERK_PUBLISHABLE_KEY:
        return verify_clerk_jwt(token)
        
    # Local Auth Fallback
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )


