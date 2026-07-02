import bcrypt

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
