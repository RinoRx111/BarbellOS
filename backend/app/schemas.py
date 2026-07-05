from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel

class GymSettingsCreate(BaseModel):
    gym_name: str
    owner_name: str
    phone: str
    access_policy: str = "fail_open"

class GymSettingsRead(BaseModel):
    id: int
    gym_name: str
    owner_name: str
    phone: str
    access_policy: str

class AdminUserCreate(BaseModel):
    name: str
    pin: str

class AdminUserLogin(BaseModel):
    pin: str

class AdminUserRead(BaseModel):
    id: int
    name: str
    created_at: datetime
    token: Optional[str] = None


class PlanCreate(BaseModel):
    name: str
    duration_days: int
    price: float

class PlanRead(BaseModel):
    id: int
    name: str
    duration_days: int
    price: float

class MemberCreate(BaseModel):
    name: str
    phone: str
    plan_id: int
    join_date: date
    email: Optional[str] = None
    photo_path: Optional[str] = None
    card_id: Optional[str] = None
    biometric_template_id: Optional[str] = None

class MemberUpdate(BaseModel):
    name: str
    phone: str
    plan_id: int
    email: Optional[str] = None
    photo_path: Optional[str] = None
    card_id: Optional[str] = None
    biometric_template_id: Optional[str] = None

class MemberFreeze(BaseModel):
    frozen_from: date
    frozen_until: date

class MemberRead(BaseModel):
    id: int
    name: str
    phone: str
    email: Optional[str] = None
    photo_path: Optional[str] = None
    plan_id: int
    join_date: date
    expiry_date: date
    frozen_from: Optional[date] = None
    frozen_until: Optional[date] = None
    biometric_template_id: Optional[str] = None
    card_id: Optional[str] = None
    status: str  # Derived status: frozen | expired | active

class PaymentCreate(BaseModel):
    member_id: int
    plan_id: int
    amount: float
    method: str

class PaymentRead(BaseModel):
    id: int
    member_id: int
    amount: float
    payment_date: datetime
    method: str
    plan_id: int

class ExpenseCreate(BaseModel):
    category: str
    amount: float
    date: date
    note: Optional[str] = None

class ExpenseRead(BaseModel):
    id: int
    category: str
    amount: float
    date: date
    note: Optional[str] = None

class AttendanceRead(BaseModel):
    id: int
    member_id: Optional[int] = None
    check_in_time: datetime
    check_in_method: str
    access_granted: bool
    member_name: Optional[str] = None

class ScanPayload(BaseModel):
    card_id: Optional[str] = None
    biometric_template_id: Optional[str] = None
    method: str  # biometric | card

