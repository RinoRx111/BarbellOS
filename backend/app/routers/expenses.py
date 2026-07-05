from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from app.db import get_session
from app import crud, schemas

from app.auth import get_current_session

router = APIRouter(prefix="/expenses", tags=["expenses"], dependencies=[Depends(get_current_session)])


@router.get("", response_model=List[schemas.ExpenseRead])
def read_expenses(session: Session = Depends(get_session)):
    return crud.get_expenses(session)

@router.post("", response_model=schemas.ExpenseRead)
def create_expense(payload: schemas.ExpenseCreate, session: Session = Depends(get_session)):
    try:
        return crud.create_expense(
            session,
            category=payload.category,
            amount=payload.amount,
            date_val=payload.date,
            note=payload.note
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{expense_id}")
def delete_expense(expense_id: int, session: Session = Depends(get_session)):
    success = crud.delete_expense(session, expense_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense with ID {expense_id} not found."
        )
    return {"message": "Expense deleted successfully"}
