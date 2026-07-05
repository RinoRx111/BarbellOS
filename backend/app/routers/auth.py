from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from app.db import get_session
from app import crud, schemas, auth
from app.auth import get_current_session, create_access_token
from datetime import datetime, timedelta

router = APIRouter(prefix="/auth", tags=["auth"])

LOGIN_ATTEMPTS = {
    "attempts": 0,
    "locked_until": None
}

@router.get("/status")
def get_auth_status(session: Session = Depends(get_session)):
    from app.config import settings
    admin = crud.get_admin_user(session)
    clerk_active = bool(settings.CLERK_PUBLISHABLE_KEY and settings.CLERK_SECRET_KEY)
    return {
        "onboarded": admin is not None,
        "clerk_active": clerk_active,
        "clerk_publishable_key": settings.CLERK_PUBLISHABLE_KEY if clerk_active else None
    }


@router.post("/setup", response_model=schemas.AdminUserRead)
def setup_admin(payload: schemas.AdminUserCreate, session: Session = Depends(get_session)):
    admin = crud.get_admin_user(session)
    if admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin account is already set up."
        )
    db_admin = crud.create_admin_user(session, name=payload.name, pin=payload.pin)
    token = create_access_token(db_admin.name)
    return schemas.AdminUserRead(
        id=db_admin.id,
        name=db_admin.name,
        created_at=db_admin.created_at,
        token=token
    )

@router.post("/login")
def login(payload: schemas.AdminUserLogin, session: Session = Depends(get_session)):
    now = datetime.utcnow()
    if LOGIN_ATTEMPTS["locked_until"] and now < LOGIN_ATTEMPTS["locked_until"]:
        time_left = int((LOGIN_ATTEMPTS["locked_until"] - now).total_seconds())
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Locked out. Try again in {time_left} seconds."
        )

    admin = crud.get_admin_user(session)
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System is not set up. Please run onboarding setup first."
        )
    
    is_valid = auth.verify_pin(payload.pin, admin.pin_hash)
    if not is_valid:
        LOGIN_ATTEMPTS["attempts"] += 1
        if LOGIN_ATTEMPTS["attempts"] >= 5:
            LOGIN_ATTEMPTS["locked_until"] = datetime.utcnow() + timedelta(seconds=60)
            LOGIN_ATTEMPTS["attempts"] = 0
            raise HTTPException(
                status_code=429,
                detail="Too many failed attempts. Locked out for 60 seconds."
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid PIN."
        )
    
    # Reset attempts on success
    LOGIN_ATTEMPTS["attempts"] = 0
    LOGIN_ATTEMPTS["locked_until"] = None
    
    token = create_access_token(admin.name)
    return {"status": "unlocked", "name": admin.name, "token": token}

@router.post("/change-pin")
def change_pin(payload: schemas.AdminUserLogin, session: Session = Depends(get_session), current_user = Depends(get_current_session)):
    admin = crud.get_admin_user(session)
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No admin account found."
        )
    
    crud.update_admin_pin(session, pin=payload.pin)
    return {"message": "PIN updated successfully"}

