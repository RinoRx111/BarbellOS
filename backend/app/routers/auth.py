from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from app.db import get_session
from app import crud, schemas, auth

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/status")
def get_auth_status(session: Session = Depends(get_session)):
    admin = crud.get_admin_user(session)
    return {"onboarded": admin is not None}

@router.post("/setup", response_model=schemas.AdminUserRead)
def setup_admin(payload: schemas.AdminUserCreate, session: Session = Depends(get_session)):
    admin = crud.get_admin_user(session)
    if admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin account is already set up."
        )
    return crud.create_admin_user(session, name=payload.name, pin=payload.pin)

@router.post("/login")
def login(payload: schemas.AdminUserLogin, session: Session = Depends(get_session)):
    admin = crud.get_admin_user(session)
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System is not set up. Please run onboarding setup first."
        )
    
    is_valid = auth.verify_pin(payload.pin, admin.pin_hash)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid PIN."
        )
    
    return {"status": "unlocked", "name": admin.name}

@router.post("/change-pin")
def change_pin(payload: schemas.AdminUserLogin, session: Session = Depends(get_session)):
    admin = crud.get_admin_user(session)
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No admin account found."
        )
    
    crud.update_admin_pin(session, pin=payload.pin)
    return {"message": "PIN updated successfully"}
