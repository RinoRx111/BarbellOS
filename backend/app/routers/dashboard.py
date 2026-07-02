from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func
from app.db import get_session
from app.models import Member, Payment, Expense, Attendance

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("")
def get_dashboard_data(session: Session = Depends(get_session)):
    today = date.today()
    start_of_month = date(today.year, today.month, 1)
    
    # Next month calculation for boundary check
    if today.month == 12:
        end_of_month = date(today.year, today.month, 31)
    else:
        end_of_month = date(today.year, today.month + 1, 1) - timedelta(days=1)
        
    # 1. Active Member Count (status is active)
    all_members = session.exec(select(Member)).all()
    active_count = sum(1 for m in all_members if m.status == "active")
    
    # 2. Revenue (This Month)
    # Filter payments in the current calendar month
    payments_stmt = select(Payment).where(
        Payment.payment_date >= datetime(start_of_month.year, start_of_month.month, 1)
    )
    payments_this_month = session.exec(payments_stmt).all()
    # Ensure payment date is in this month
    revenue = sum(p.amount for p in payments_this_month if p.payment_date.date() <= end_of_month)
    
    # 3. Expenses (This Month)
    expenses_stmt = select(Expense).where(
        Expense.date >= start_of_month,
        Expense.date <= end_of_month
    )
    expenses_this_month = session.exec(expenses_stmt).all()
    total_expenses = sum(e.amount for e in expenses_this_month)
    
    # 4. Net Profit
    net_profit = revenue - total_expenses
    
    # 5. Members Expiring in next 7 days (default from Glossary)
    seven_days_later = today + timedelta(days=7)
    expiring_soon_members = []
    for m in all_members:
        if m.status == "active" and today <= m.expiry_date <= seven_days_later:
            expiring_soon_members.append({
                "id": m.id,
                "name": m.name,
                "phone": m.phone,
                "expiry_date": m.expiry_date
            })
            
    # 6. Today's Attendance Summary
    today_start = datetime(today.year, today.month, today.day, 0, 0, 0)
    attendance_today = session.exec(
        select(Attendance).where(Attendance.check_in_time >= today_start)
    ).all()
    
    total_scans = len(attendance_today)
    scans_granted = sum(1 for a in attendance_today if a.access_granted)
    scans_denied = total_scans - scans_granted
    
    # 7. Today's Log Feed (recent 8 check-ins)
    recent_attendance = []
    attendance_sorted = sorted(attendance_today, key=lambda x: x.check_in_time, reverse=True)[:8]
    
    for a in attendance_sorted:
        name = "Unknown Guest"
        status_str = "unrecognized"
        if a.member_id:
            member = session.get(Member, a.member_id)
            if member:
                name = member.name
                status_str = member.status
                
        # Check duplicate scan
        # (Was there another scan by the same member within 2 minutes prior?)
        is_duplicate = False
        if a.member_id:
            two_mins_prior = a.check_in_time - timedelta(minutes=2)
            prior_scans = session.exec(
                select(Attendance)
                .where(Attendance.member_id == a.member_id)
                .where(Attendance.check_in_time >= two_mins_prior)
                .where(Attendance.check_in_time < a.check_in_time)
            ).all()
            is_duplicate = len(prior_scans) > 0
            
        recent_attendance.append({
            "id": a.id,
            "member_id": a.member_id,
            "member_name": name,
            "check_in_time": a.check_in_time,
            "check_in_method": a.check_in_method,
            "access_granted": a.access_granted,
            "member_status": status_str,
            "duplicate": is_duplicate
        })
        
    return {
        "active_members": active_count,
        "revenue_this_month": revenue,
        "expenses_this_month": total_expenses,
        "net_profit": net_profit,
        "expiring_members": expiring_soon_members,
        "attendance_summary": {
            "total": total_scans,
            "granted": scans_granted,
            "denied": scans_denied
        },
        "recent_attendance": recent_attendance
    }
