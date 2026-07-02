from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from app.db import get_session
from app import crud, schemas

router = APIRouter(prefix="/members", tags=["members"])

@router.get("", response_model=List[schemas.MemberRead])
def read_members(session: Session = Depends(get_session)):
    return crud.get_members(session)

@router.get("/{member_id}", response_model=schemas.MemberRead)
def read_member(member_id: int, session: Session = Depends(get_session)):
    member = crud.get_member_by_id(session, member_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Member with ID {member_id} not found."
        )
    return member

@router.post("", response_model=schemas.MemberRead)
def create_member(payload: schemas.MemberCreate, session: Session = Depends(get_session)):
    try:
        return crud.create_member(
            session,
            name=payload.name,
            phone=payload.phone,
            plan_id=payload.plan_id,
            join_date=payload.join_date,
            email=payload.email,
            photo_path=payload.photo_path,
            card_id=payload.card_id,
            biometric_template_id=payload.biometric_template_id
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.put("/{member_id}", response_model=schemas.MemberRead)
def update_member(member_id: int, payload: schemas.MemberUpdate, session: Session = Depends(get_session)):
    try:
        return crud.update_member(
            session,
            member_id=member_id,
            name=payload.name,
            phone=payload.phone,
            plan_id=payload.plan_id,
            email=payload.email,
            photo_path=payload.photo_path,
            card_id=payload.card_id,
            biometric_template_id=payload.biometric_template_id
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{member_id}")
def delete_member(member_id: int, session: Session = Depends(get_session)):
    success = crud.delete_member(session, member_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Member with ID {member_id} not found."
        )
    return {"message": "Member deleted successfully"}

@router.post("/{member_id}/freeze", response_model=schemas.MemberRead)
def freeze_member(member_id: int, payload: schemas.MemberFreeze, session: Session = Depends(get_session)):
    try:
        return crud.freeze_member(
            session,
            member_id=member_id,
            frozen_from=payload.frozen_from,
            frozen_until=payload.frozen_until
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/{member_id}/unfreeze", response_model=schemas.MemberRead)
def unfreeze_member(member_id: int, unfreeze_date: Optional[date] = None, session: Session = Depends(get_session)):
    if not unfreeze_date:
        unfreeze_date = date.today()
    try:
        return crud.unfreeze_member(session, member_id=member_id, unfreeze_date=unfreeze_date)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
