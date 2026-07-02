from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from app.db import get_session
from app import crud, schemas

router = APIRouter(prefix="/plans", tags=["plans"])

@router.get("", response_model=List[schemas.PlanRead])
def read_plans(session: Session = Depends(get_session)):
    return crud.get_plans(session)

@router.get("/{plan_id}", response_model=schemas.PlanRead)
def read_plan(plan_id: int, session: Session = Depends(get_session)):
    plan = crud.get_plan_by_id(session, plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan with id {plan_id} not found."
        )
    return plan

@router.post("", response_model=schemas.PlanRead)
def create_plan(payload: schemas.PlanCreate, session: Session = Depends(get_session)):
    return crud.create_plan(
        session,
        name=payload.name,
        duration_days=payload.duration_days,
        price=payload.price
    )

@router.put("/{plan_id}", response_model=schemas.PlanRead)
def update_plan(plan_id: int, payload: schemas.PlanCreate, session: Session = Depends(get_session)):
    try:
        return crud.update_plan(
            session,
            plan_id=plan_id,
            name=payload.name,
            duration_days=payload.duration_days,
            price=payload.price
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

@router.delete("/{plan_id}")
def delete_plan(plan_id: int, session: Session = Depends(get_session)):
    success = crud.delete_plan(session, plan_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan with id {plan_id} not found."
        )
    return {"message": "Plan deleted successfully"}
