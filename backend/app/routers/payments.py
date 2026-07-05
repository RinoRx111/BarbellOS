from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from app.db import get_session
from app import crud, schemas

from app.auth import get_current_session

router = APIRouter(prefix="/payments", tags=["payments"], dependencies=[Depends(get_current_session)])


@router.get("", response_model=List[schemas.PaymentRead])
def read_payments(session: Session = Depends(get_session)):
    return crud.get_payments(session)

@router.get("/member/{member_id}", response_model=List[schemas.PaymentRead])
def read_member_payments(member_id: int, session: Session = Depends(get_session)):
    return crud.get_payments_for_member(session, member_id)

@router.post("", response_model=schemas.PaymentRead)
def log_payment(payload: schemas.PaymentCreate, session: Session = Depends(get_session)):
    try:
        payment_date = datetime.utcnow()
        return crud.log_payment(
            session,
            member_id=payload.member_id,
            plan_id=payload.plan_id,
            amount=payload.amount,
            method=payload.method,
            payment_date=payment_date
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
