from datetime import date, datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship

class GymSettings(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    gym_name: str
    owner_name: str
    phone: str
    access_policy: str = Field(default="fail_open") # fail_open | fail_closed

class AdminUser(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    pin_hash: str  # Hash of the login PIN
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Plan(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str  # e.g., "Monthly", "Quarterly", "PT - 12 sessions"
    duration_days: int
    price: float

    # Relationships
    members: List["Member"] = Relationship(back_populates="plan")

class Member(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    phone: str
    email: Optional[str] = Field(default=None, nullable=True)
    photo_path: Optional[str] = Field(default=None, nullable=True)
    plan_id: int = Field(foreign_key="plan.id")
    join_date: date
    expiry_date: date  # Computed at signup/renewal as join_date + plan duration
    frozen_from: Optional[date] = Field(default=None, nullable=True)
    frozen_until: Optional[date] = Field(default=None, nullable=True)
    biometric_template_id: Optional[str] = Field(default=None, nullable=True)
    card_id: Optional[str] = Field(default=None, nullable=True)

    # Relationships
    plan: Optional[Plan] = Relationship(back_populates="members")
    payments: List["Payment"] = Relationship(back_populates="member")
    attendances: List["Attendance"] = Relationship(back_populates="member")

    @property
    def status(self) -> str:
        """
        Derive status dynamically at runtime based on dates.
        Statuses: "frozen", "expired", "active"
        """
        today = date.today()
        
        # Check if currently frozen
        if self.frozen_from and self.frozen_until:
            if self.frozen_from <= today <= self.frozen_until:
                return "frozen"
                
        # Check if plan has expired
        if today > self.expiry_date:
            return "expired"
            
        return "active"

class Payment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    member_id: int = Field(foreign_key="member.id")
    amount: float
    payment_date: datetime = Field(default_factory=datetime.utcnow)
    method: str  # cash | upi | card
    plan_id: int = Field(foreign_key="plan.id")

    # Relationships
    member: Optional[Member] = Relationship(back_populates="payments")

class Attendance(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    member_id: Optional[int] = Field(default=None, foreign_key="member.id", nullable=True)
    check_in_time: datetime = Field(default_factory=datetime.utcnow)
    check_in_method: str  # biometric | card | manual
    access_granted: bool

    # Relationships
    member: Optional[Member] = Relationship(back_populates="attendances")

class Expense(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    category: str  # rent | equipment | salary | utilities | maintenance | other
    amount: float
    date: date
    note: Optional[str] = Field(default=None, nullable=True)

class ChatMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    role: str  # user | assistant | tool
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
