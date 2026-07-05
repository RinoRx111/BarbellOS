import json
from datetime import date, datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select
from app.db import get_session
from app.models import ChatMessage, Member, Plan
from app import crud
from app.services.ai import call_llm
from app.services.ai_config import get_ai_config, save_ai_config
from app.services.audit import log_audit

from app.auth import get_current_session

router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[Depends(get_current_session)])

class ChatPayload(BaseModel):
    message: str

class ConfirmPayload(BaseModel):
    confirm_id: str

class AiConfigPayload(BaseModel):
    provider: str
    api_key: Optional[str] = None
    openai_key: Optional[str] = None
    anthropic_key: Optional[str] = None
    ollama_url: Optional[str] = None

@router.get("/history")
def get_chat_history(session: Session = Depends(get_session)):
    messages = session.exec(
        select(ChatMessage).order_by(ChatMessage.created_at.desc()).limit(20)
    ).all()
    # Return chronologically
    return [{"id": m.id, "role": m.role, "content": m.content, "created_at": m.created_at} for m in reversed(messages)]

@router.get("/config")
def get_config():
    config = get_ai_config()
    masked = {}
    for k, v in config.items():
        if k in ["api_key", "openai_key", "anthropic_key"]:
            if v:
                masked[k] = f"...{v[-4:]}" if len(v) >= 4 else "is_set"
            else:
                masked[k] = ""
        else:
            masked[k] = v
    return masked

@router.post("/config")
def update_config(payload: AiConfigPayload):
    current = get_ai_config()
    
    def resolve_key(new_val: Optional[str], old_val: str) -> str:
        if new_val is None:
            return ""
        if new_val.startswith("...") or new_val == "is_set":
            return old_val
        return new_val

    save_ai_config({
        "provider": payload.provider,
        "api_key": resolve_key(payload.api_key, current.get("api_key", "")),
        "openai_key": resolve_key(payload.openai_key, current.get("openai_key", "")),
        "anthropic_key": resolve_key(payload.anthropic_key, current.get("anthropic_key", "")),
        "ollama_url": payload.ollama_url or "http://localhost:11434"
    })
    return {"message": "AI configuration updated successfully"}

@router.post("/chat")
async def chat_interaction(payload: ChatPayload, session: Session = Depends(get_session)):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Empty query message.")
        
    # Save user message to database
    user_msg = ChatMessage(role="user", content=payload.message)
    session.add(user_msg)
    session.commit()
    
    # Process through LLM turning
    response = await call_llm(session, payload.message)
    
    if response["status"] == "text":
        # Save assistant text reply to database
        assistant_msg = ChatMessage(role="assistant", content=response["content"])
        session.add(assistant_msg)
        session.commit()
        
    return response

@router.post("/confirm")
def confirm_ai_action(payload: ConfirmPayload, session: Session = Depends(get_session)):
    from app.services.ai import PENDING_ACTIONS
    
    confirm_id = payload.confirm_id
    if confirm_id not in PENDING_ACTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired AI confirmation token."
        )
        
    pending = PENDING_ACTIONS.pop(confirm_id)
    action = pending["action"]
    params = pending["params"]
    
    try:
        if action == "freeze_member":
            member_id = int(params["member_id"])
            frozen_from = date.fromisoformat(params["frozen_from"])
            frozen_until = date.fromisoformat(params["frozen_until"])
            
            member = crud.freeze_member(session, member_id, frozen_from, frozen_until)
            detail_str = f"Froze member {member.name} (ID: {member.id}) from {frozen_from} to {frozen_until}"
            log_audit("freeze_member", detail_str, via="ai")
            
        elif action == "log_payment":
            member_id = int(params["member_id"])
            plan_id = int(params["plan_id"])
            amount = float(params["amount"])
            method = params["method"]
            
            payment = crud.log_payment(session, member_id, plan_id, amount, method, datetime.utcnow())
            member = payment.member
            plan = session.get(Plan, plan_id)
            plan_name = plan.name if plan else "Plan"
            detail_str = f"Recorded payment of ₹{amount} ({method}) for {member.name} (ID: {member.id}) renewing plan: {plan_name}"
            log_audit("log_payment", detail_str, via="ai")
            
        elif action == "add_member":
            name = params["name"]
            phone = params["phone"]
            plan_id = int(params["plan_id"])
            join_date = date.fromisoformat(params["join_date"])
            email = params.get("email")
            
            member = crud.create_member(session, name=name, phone=phone, plan_id=plan_id, join_date=join_date, email=email)
            detail_str = f"Registered new member {member.name} (ID: {member.id}, Phone: {member.phone})"
            log_audit("add_member", detail_str, via="ai")
            
            # Auto log initial payment
            plan = session.get(Plan, plan_id)
            if plan:
                crud.log_payment(session, member_id=member.id, plan_id=plan_id, amount=plan.price, method="cash", payment_date=datetime.utcnow())
                
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported write action '{action}'.")
            
        # Save confirmation assistant text to history
        assistant_content = f"Successfully executed action: {detail_str}."
        assistant_msg = ChatMessage(role="assistant", content=assistant_content)
        session.add(assistant_msg)
        session.commit()
        
        return {"status": "success", "message": assistant_content}
        
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to execute AI transaction: {str(e)}"
        )

