from datetime import datetime, date, timedelta
from sqlmodel import Session, select
from app.models import Payment, Expense, Member, Attendance

def get_revenue_summary(session: Session, start_date: str, end_date: str) -> dict:
    try:
        sd = datetime.strptime(start_date, "%Y-%m-%d").date()
        ed = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        return {"error": "Invalid date format. Use YYYY-MM-DD."}
        
    payments = session.exec(
        select(Payment).where(
            Payment.payment_date >= datetime(sd.year, sd.month, sd.day),
            Payment.payment_date <= datetime(ed.year, ed.month, ed.day, 23, 59, 59)
        )
    ).all()
    total = sum(p.amount for p in payments)
    return {"total_revenue": total, "payments_count": len(payments)}

def get_expenses_summary(session: Session, start_date: str, end_date: str) -> dict:
    try:
        sd = datetime.strptime(start_date, "%Y-%m-%d").date()
        ed = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        return {"error": "Invalid date format. Use YYYY-MM-DD."}
        
    expenses = session.exec(
        select(Expense).where(Expense.date >= sd, Expense.date <= ed)
    ).all()
    total = sum(e.amount for e in expenses)
    
    # Categorized breakdown
    breakdown = {}
    for e in expenses:
        breakdown[e.category] = breakdown.get(e.category, 0.0) + e.amount
        
    return {"total_expenses": total, "expenses_count": len(expenses), "breakdown": breakdown}

def get_active_members(session: Session) -> dict:
    members = session.exec(select(Member)).all()
    active_members = [m for m in members if m.status == "active"]
    return {"active_members_count": len(active_members), "total_members_count": len(members)}

def get_expiring_members(session: Session, days: int = 7) -> dict:
    today = date.today()
    target_date = today + timedelta(days=days)
    members = session.exec(select(Member)).all()
    expiring = []
    for m in members:
        if m.status == "active" and today <= m.expiry_date <= target_date:
            expiring.append({
                "id": m.id,
                "name": m.name,
                "phone": m.phone,
                "expiry_date": m.expiry_date.isoformat()
            })
    return {"days_checked": days, "expiring_members_count": len(expiring), "members": expiring}

def get_attendance_trend(session: Session, days: int = 7) -> dict:
    today = date.today()
    start_date = today - timedelta(days=days - 1)
    
    attendance = session.exec(
        select(Attendance).where(Attendance.check_in_time >= datetime(start_date.year, start_date.month, start_date.day))
    ).all()
    
    counts = {}
    for i in range(days):
        d = start_date + timedelta(days=i)
        counts[d.isoformat()] = {"granted": 0, "denied": 0, "total": 0}
        
    for a in attendance:
        date_str = a.check_in_time.date().isoformat()
        if date_str in counts:
            counts[date_str]["total"] += 1
            if a.access_granted:
                counts[date_str]["granted"] += 1
            else:
                counts[date_str]["denied"] += 1
                
    trend = [{"date": k, "total": v["total"], "granted": v["granted"], "denied": v["denied"]} for k, v in counts.items()]
    return {"trend": trend}
