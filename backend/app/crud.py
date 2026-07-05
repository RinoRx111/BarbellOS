from datetime import date, datetime, timedelta
from typing import List, Optional
from sqlmodel import Session, select, func
from app.models import GymSettings, AdminUser, Plan, Member, Payment, Attendance, Expense
from app.auth import hash_pin
import base64
import hashlib
from cryptography.fernet import Fernet
from app.config import settings

def get_fernet() -> Fernet:
    key_bytes = settings.SECRET_KEY.encode("utf-8")
    hashed = hashlib.sha256(key_bytes).digest()
    fernet_key = base64.urlsafe_b64encode(hashed)
    return Fernet(fernet_key)

def encrypt_val(val: Optional[str]) -> Optional[str]:
    if val is None or val == "":
        return val
    f = get_fernet()
    return f.encrypt(val.encode("utf-8")).decode("utf-8")

def decrypt_val(val: Optional[str]) -> Optional[str]:
    if val is None or val == "":
        return val
    if not val.startswith("gAAAAA"):
        return val
    f = get_fernet()
    try:
        return f.decrypt(val.encode("utf-8")).decode("utf-8")
    except Exception:
        return val

def decrypt_member(member: Optional[Member]) -> Optional[Member]:
    if member:
        member.card_id = decrypt_val(member.card_id)
        member.biometric_template_id = decrypt_val(member.biometric_template_id)
    return member


# --- Gym Settings CRUD ---
def get_gym_settings(session: Session) -> Optional[GymSettings]:
    return session.exec(select(GymSettings)).first()

def create_gym_settings(session: Session, gym_name: str, owner_name: str, phone: str, access_policy: str = "fail_open") -> GymSettings:
    settings = GymSettings(gym_name=gym_name, owner_name=owner_name, phone=phone, access_policy=access_policy)
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings

def update_gym_settings(session: Session, gym_name: str, owner_name: str, phone: str, access_policy: str) -> GymSettings:
    settings = get_gym_settings(session)
    if not settings:
        settings = GymSettings(gym_name=gym_name, owner_name=owner_name, phone=phone, access_policy=access_policy)
    else:
        settings.gym_name = gym_name
        settings.owner_name = owner_name
        settings.phone = phone
        settings.access_policy = access_policy
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings

# --- Admin User CRUD ---
def get_admin_user(session: Session) -> Optional[AdminUser]:
    return session.exec(select(AdminUser)).first()

def create_admin_user(session: Session, name: str, pin: str) -> AdminUser:
    pin_hash = hash_pin(pin)
    admin = AdminUser(name=name, pin_hash=pin_hash)
    session.add(admin)
    session.commit()
    session.refresh(admin)
    return admin

def update_admin_pin(session: Session, pin: str) -> AdminUser:
    admin = get_admin_user(session)
    if not admin:
        raise ValueError("No admin user exists to update PIN.")
    admin.pin_hash = hash_pin(pin)
    session.add(admin)
    session.commit()
    session.refresh(admin)
    return admin

# --- Plans CRUD ---
def get_plans(session: Session) -> List[Plan]:
    return session.exec(select(Plan)).all()

def get_plan_by_id(session: Session, plan_id: int) -> Optional[Plan]:
    return session.get(Plan, plan_id)

def create_plan(session: Session, name: str, duration_days: int, price: float) -> Plan:
    plan = Plan(name=name, duration_days=duration_days, price=price)
    session.add(plan)
    session.commit()
    session.refresh(plan)
    return plan

def update_plan(session: Session, plan_id: int, name: str, duration_days: int, price: float) -> Plan:
    plan = session.get(Plan, plan_id)
    if not plan:
        raise ValueError(f"Plan with id {plan_id} not found.")
    plan.name = name
    plan.duration_days = duration_days
    plan.price = price
    session.add(plan)
    session.commit()
    session.refresh(plan)
    return plan

def delete_plan(session: Session, plan_id: int) -> bool:
    plan = session.get(Plan, plan_id)
    if not plan:
        return False
    session.delete(plan)
    session.commit()
    return True

# --- Members CRUD ---
def get_members(session: Session) -> List[Member]:
    return session.exec(select(Member)).all()

def get_member_by_id(session: Session, member_id: int) -> Optional[Member]:
    return session.get(Member, member_id)

def get_member_by_card_or_template(session: Session, card_id: Optional[str] = None, template_id: Optional[str] = None) -> Optional[Member]:
    if not card_id and not template_id:
        return None
    members = session.exec(select(Member)).all()
    for m in members:
        if card_id and m.card_id == card_id:
            return m
        if template_id and m.biometric_template_id == template_id:
            return m
    return None


def create_member(
    session: Session,
    name: str,
    phone: str,
    plan_id: int,
    join_date: date,
    email: Optional[str] = None,
    photo_path: Optional[str] = None,
    card_id: Optional[str] = None,
    biometric_template_id: Optional[str] = None
) -> Member:
    plan = get_plan_by_id(session, plan_id)
    if not plan:
        raise ValueError(f"Plan with ID {plan_id} does not exist.")
    
    # Expiry is join_date + plan duration
    expiry_date = join_date + timedelta(days=plan.duration_days)
    
    member = Member(
        name=name,
        phone=phone,
        email=email,
        photo_path=photo_path,
        plan_id=plan_id,
        join_date=join_date,
        expiry_date=expiry_date,
        card_id=card_id,
        biometric_template_id=biometric_template_id
    )
    session.add(member)
    session.commit()
    session.refresh(member)
    return member

def update_member(
    session: Session,
    member_id: int,
    name: str,
    phone: str,
    plan_id: int,
    email: Optional[str] = None,
    photo_path: Optional[str] = None,
    card_id: Optional[str] = None,
    biometric_template_id: Optional[str] = None
) -> Member:
    member = session.get(Member, member_id)
    if not member:
        raise ValueError(f"Member with ID {member_id} not found.")
    
    # If the plan is changed, adjust expiry date based on original join date plus new plan duration
    # (Or keep the original expiry if it is a simple profile update; typical profile edits shouldn't shorten membership,
    # but if they explicitly change the plan tier, we update it)
    if member.plan_id != plan_id:
        plan = get_plan_by_id(session, plan_id)
        if not plan:
            raise ValueError(f"Plan with ID {plan_id} does not exist.")
        member.plan_id = plan_id
        # Recalculate expiry from join date
        member.expiry_date = member.join_date + timedelta(days=plan.duration_days)
        # Shift forward if currently frozen
        if member.frozen_from and member.frozen_until:
            freeze_days = (member.frozen_until - member.frozen_from).days + 1
            member.expiry_date += timedelta(days=freeze_days)
            
    member.name = name
    member.phone = phone
    member.email = email
    member.photo_path = photo_path
    member.card_id = card_id
    member.biometric_template_id = biometric_template_id
    
    session.add(member)
    session.commit()
    session.refresh(member)
    return member

def delete_member(session: Session, member_id: int) -> bool:
    member = session.get(Member, member_id)
    if not member:
        return False
    session.delete(member)
    session.commit()
    return True

# --- Freeze & Unfreeze Members ---
def freeze_member(session: Session, member_id: int, frozen_from: date, frozen_until: date) -> Member:
    member = session.get(Member, member_id)
    if not member:
        raise ValueError(f"Member with ID {member_id} not found.")
    
    # Calculate freeze duration in days
    freeze_days = (frozen_until - frozen_from).days + 1
    if freeze_days <= 0:
        raise ValueError("Freeze end date must be after freeze start date.")
    
    # If member was already frozen, unfreeze them first to calculate correct shift
    if member.frozen_from and member.frozen_until:
        unfreeze_member(session, member_id, date.today())
        
    member.frozen_from = frozen_from
    member.frozen_until = frozen_until
    member.expiry_date = member.expiry_date + timedelta(days=freeze_days)
    
    session.add(member)
    session.commit()
    session.refresh(member)
    return member

def unfreeze_member(session: Session, member_id: int, unfreeze_date: date) -> Member:
    member = session.get(Member, member_id)
    if not member:
        raise ValueError(f"Member with ID {member_id} not found.")
    
    if not member.frozen_from or not member.frozen_until:
        return member  # Not frozen
        
    # Case 1: Unfreeze before freeze starts
    if unfreeze_date < member.frozen_from:
        freeze_days = (member.frozen_until - member.frozen_from).days + 1
        member.expiry_date = member.expiry_date - timedelta(days=freeze_days)
        member.frozen_from = None
        member.frozen_until = None
    
    # Case 2: Unfreeze in the middle of a freeze
    elif member.frozen_from <= unfreeze_date <= member.frozen_until:
        original_freeze_days = (member.frozen_until - member.frozen_from).days + 1
        actual_freeze_days = (unfreeze_date - member.frozen_from).days
        
        unused_days = original_freeze_days - actual_freeze_days
        member.expiry_date = member.expiry_date - timedelta(days=unused_days)
        
        if unfreeze_date == member.frozen_from:
            # If unfrozen on the start date itself, no freeze occurred
            member.frozen_from = None
            member.frozen_until = None
        else:
            member.frozen_until = unfreeze_date - timedelta(days=1)
            
    session.add(member)
    session.commit()
    session.refresh(member)
    return member

# --- Payments CRUD ---
def get_payments(session: Session) -> List[Payment]:
    return session.exec(select(Payment).order_by(Payment.payment_date.desc())).all()

def get_payments_for_member(session: Session, member_id: int) -> List[Payment]:
    return session.exec(select(Payment).where(Payment.member_id == member_id).order_by(Payment.payment_date.desc())).all()

def log_payment(session: Session, member_id: int, plan_id: int, amount: float, method: str, payment_date: datetime) -> Payment:
    member = session.get(Member, member_id)
    if not member:
        raise ValueError(f"Member with ID {member_id} not found.")
    
    plan = session.get(Plan, plan_id)
    if not plan:
        raise ValueError(f"Plan with ID {plan_id} not found.")
        
    # Compute new expiry:
    # If the membership is active (expiry is in the future), stack duration on top of current expiry.
    # Otherwise, start plan from payment date.
    today = payment_date.date()
    base_date = member.expiry_date if member.expiry_date >= today else today
    
    new_expiry = base_date + timedelta(days=plan.duration_days)
    member.expiry_date = new_expiry
    member.plan_id = plan_id
    
    payment = Payment(
        member_id=member_id,
        amount=amount,
        method=method,
        payment_date=payment_date,
        plan_id=plan_id
    )
    
    session.add(payment)
    session.add(member)
    session.commit()
    session.refresh(payment)
    return payment

# --- Attendance CRUD ---
def get_attendance_logs(session: Session, limit: int = 100) -> List[Attendance]:
    return session.exec(select(Attendance).order_by(Attendance.check_in_time.desc()).limit(limit)).all()

def log_attendance(session: Session, member_id: Optional[int], check_in_method: str, access_granted: bool, check_in_time: Optional[datetime] = None) -> Attendance:
    if not check_in_time:
        check_in_time = datetime.utcnow()
        
    log = Attendance(
        member_id=member_id,
        check_in_method=check_in_method,
        access_granted=access_granted,
        check_in_time=check_in_time
    )
    session.add(log)
    session.commit()
    session.refresh(log)
    return log

# --- Expenses CRUD ---
def get_expenses(session: Session) -> List[Expense]:
    return session.exec(select(Expense).order_by(Expense.date.desc())).all()

def create_expense(session: Session, category: str, amount: float, date_val: date, note: Optional[str] = None) -> Expense:
    # Validate category
    valid_categories = {"rent", "equipment", "salary", "utilities", "maintenance", "other"}
    if category not in valid_categories:
        raise ValueError(f"Invalid expense category '{category}'. Must be one of {valid_categories}")
        
    expense = Expense(category=category, amount=amount, date=date_val, note=note)
    session.add(expense)
    session.commit()
    session.refresh(expense)
    return expense

def delete_expense(session: Session, expense_id: int) -> bool:
    expense = session.get(Expense, expense_id)
    if not expense:
        return False
    session.delete(expense)
    session.commit()
    return True
