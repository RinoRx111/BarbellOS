from typing import Optional
from fastapi import APIRouter, Depends
from sqlmodel import Session
from app.db import get_session
from app import crud, schemas

from app.auth import get_current_session

router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(get_current_session)])


@router.get("", response_model=Optional[schemas.GymSettingsRead])
def read_settings(session: Session = Depends(get_session)):
    return crud.get_gym_settings(session)

@router.post("", response_model=schemas.GymSettingsRead)
def update_settings(payload: schemas.GymSettingsCreate, session: Session = Depends(get_session)):
    return crud.update_gym_settings(
        session,
        gym_name=payload.gym_name,
        owner_name=payload.owner_name,
        phone=payload.phone,
        access_policy=payload.access_policy
    )
