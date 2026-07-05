from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from app.db import get_session
from app.models import Attendance, Member
from app import crud, schemas
from app.services.websocket_manager import manager

from app.auth import get_current_session

router = APIRouter(prefix="/attendance", tags=["attendance"], dependencies=[Depends(get_current_session)])


@router.get("", response_model=List[schemas.AttendanceRead])
def read_attendance(limit: int = 100, session: Session = Depends(get_session)):
    logs = crud.get_attendance_logs(session, limit=limit)
    res = []
    for log in logs:
        member_name = "Unknown Member"
        if log.member_id:
            member = log.member
            if member:
                member_name = member.name
        res.append(
            schemas.AttendanceRead(
                id=log.id,
                member_id=log.member_id,
                check_in_time=log.check_in_time,
                check_in_method=log.check_in_method,
                access_granted=log.access_granted,
                member_name=member_name
            )
        )
    return res

@router.post("/manual-override/{member_id}", response_model=schemas.AttendanceRead)
async def manual_override(member_id: int, session: Session = Depends(get_session)):
    member = crud.get_member_by_id(session, member_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Member with ID {member_id} not found."
        )
    
    log = crud.log_attendance(
        session,
        member_id=member.id,
        check_in_method="manual",
        access_granted=True
    )
    
    # Broadcast event
    await manager.broadcast({
        "event": "attendance",
        "log": {
            "id": log.id,
            "member_id": member.id,
            "member_name": member.name,
            "check_in_time": log.check_in_time.isoformat(),
            "check_in_method": "manual",
            "access_granted": True,
            "member_status": member.status,
            "duplicate": False
        }
    })
    
    return schemas.AttendanceRead(
        id=log.id,
        member_id=log.member_id,
        check_in_time=log.check_in_time,
        check_in_method=log.check_in_method,
        access_granted=log.access_granted,
        member_name=member.name
    )

@router.post("/manual-override", response_model=schemas.AttendanceRead)
async def general_manual_override(session: Session = Depends(get_session)):
    log = crud.log_attendance(
        session,
        member_id=None,
        check_in_method="manual",
        access_granted=True
    )
    
    # Broadcast event
    await manager.broadcast({
        "event": "attendance",
        "log": {
            "id": log.id,
            "member_id": None,
            "member_name": "Manual Override (Owner)",
            "check_in_time": log.check_in_time.isoformat(),
            "check_in_method": "manual",
            "access_granted": True,
            "member_status": "active",
            "duplicate": False
        }
    })
    
    return schemas.AttendanceRead(
        id=log.id,
        member_id=None,
        check_in_time=log.check_in_time,
        check_in_method=log.check_in_method,
        access_granted=log.access_granted,
        member_name="Manual Override (Owner)"
    )

@router.post("/scan")
async def scan_credential(payload: schemas.ScanPayload, session: Session = Depends(get_session)):
    from app.models import GymSettings
    
    gym_settings = session.exec(select(GymSettings)).first()
    policy = gym_settings.access_policy if gym_settings else "fail_closed"
    
    try:
        member = crud.get_member_by_card_or_template(
            session,
            card_id=payload.card_id,
            template_id=payload.biometric_template_id
        )
    except Exception as e:
        # Hardware/lookup error case
        access_granted = (policy == "fail_open")
        log = crud.log_attendance(
            session,
            member_id=None,
            check_in_method=payload.method,
            access_granted=access_granted
        )
        
        event_data = {
            "event": "attendance",
            "log": {
                "id": log.id,
                "member_id": None,
                "member_name": "System/Hardware Error",
                "check_in_time": log.check_in_time.isoformat(),
                "check_in_method": payload.method,
                "access_granted": access_granted,
                "member_status": "error",
                "duplicate": False
            }
        }
        await manager.broadcast(event_data)
        
        return {
            "access_granted": access_granted,
            "reason": f"System error: {str(e)}" if not access_granted else "Access Granted (Fail-Open)",
            "member_name": "System/Hardware Error",
            "duplicate": False
        }
    
    if not member:
        access_granted = (policy == "fail_open")
        log = crud.log_attendance(
            session,
            member_id=None,
            check_in_method=payload.method,
            access_granted=access_granted
        )
        
        event_data = {
            "event": "attendance",
            "log": {
                "id": log.id,
                "member_id": None,
                "member_name": "Unknown Guest",
                "check_in_time": log.check_in_time.isoformat(),
                "check_in_method": payload.method,
                "access_granted": access_granted,
                "member_status": "unrecognized",
                "duplicate": False
            }
        }
        await manager.broadcast(event_data)
        
        return {
            "access_granted": access_granted,
            "reason": "Unrecognized credential" if not access_granted else "Access Granted (Fail-Open)",
            "member_name": "Unknown Guest",
            "duplicate": False
        }
        
    status_str = member.status  # active | expired | frozen
    
    # Check duplicate scan (scanned in the last 2 minutes)
    two_minutes_ago = datetime.utcnow() - timedelta(minutes=2)
    recent_scan = session.exec(
        select(Attendance)
        .where(Attendance.member_id == member.id)
        .where(Attendance.check_in_time >= two_minutes_ago)
    ).first()
    
    is_duplicate = recent_scan is not None
    
    access_granted = False
    reason = ""
    
    if status_str == "active":
        access_granted = True
        reason = "Access Granted"
    elif status_str == "frozen":
        access_granted = False
        reason = "Membership Frozen"
    else:
        access_granted = False
        reason = "Membership Expired"
        
    log = crud.log_attendance(
        session,
        member_id=member.id,
        check_in_method=payload.method,
        access_granted=access_granted
    )
    
    # Broadcast event
    await manager.broadcast({
        "event": "attendance",
        "log": {
            "id": log.id,
            "member_id": member.id,
            "member_name": member.name,
            "check_in_time": log.check_in_time.isoformat(),
            "check_in_method": payload.method,
            "access_granted": access_granted,
            "member_status": status_str,
            "duplicate": is_duplicate
        }
    })
    
    return {
        "access_granted": access_granted,
        "reason": reason,
        "member_name": member.name,
        "duplicate": is_duplicate
    }

