import os
import pytest
from datetime import date, datetime, timedelta
from sqlmodel import SQLModel, create_engine, Session
from fastapi.testclient import TestClient

TEST_DB_FILE = "test_system_temp.db"
os.environ["DATABASE_PATH"] = f"sqlite:///{TEST_DB_FILE}"

from app.main import app
from app.db import get_session
from app import crud, models

# Setup SQLite testing engine
engine = create_engine(f"sqlite:///{TEST_DB_FILE}", connect_args={"check_same_thread": False})

@pytest.fixture(name="session")
def session_fixture():
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass
            
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    
    session.close()
    engine.dispose()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass

@pytest.fixture(name="client")
def client_fixture(session):
    def get_session_override():
        return session
    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

def test_derived_status_edge_cases(session):
    """
    Unit test for edge cases in derived member status calculations.
    """
    plan = crud.create_plan(session, name="Standard", duration_days=30, price=500.0)
    join_date = date.today()
    member = crud.create_member(session, name="Tester", phone="9999999999", plan_id=plan.id, join_date=join_date)
    
    # 1. Active: expiry in future, no freezes
    assert member.status == "active"
    
    # 2. Frozen in future (should still show active today)
    member.frozen_from = date.today() + timedelta(days=2)
    member.frozen_until = date.today() + timedelta(days=5)
    session.add(member)
    session.commit()
    assert member.status == "active"
    
    # 3. Frozen today (starts today, ends tomorrow)
    member.frozen_from = date.today()
    member.frozen_until = date.today() + timedelta(days=1)
    session.add(member)
    session.commit()
    assert member.status == "frozen"
    
    # 4. Frozen in past (ended yesterday)
    member.frozen_from = date.today() - timedelta(days=5)
    member.frozen_until = date.today() - timedelta(days=1)
    session.add(member)
    session.commit()
    assert member.status == "active"
    
    # 5. Expired: expiry is yesterday, no freezes
    member.frozen_from = None
    member.frozen_until = None
    member.expiry_date = date.today() - timedelta(days=1)
    session.add(member)
    session.commit()
    assert member.status == "expired"
    
    # 6. Expired but with active freeze dates: since freeze check is first in models.py, status is frozen
    member.frozen_from = date.today() - timedelta(days=1)
    member.frozen_until = date.today() + timedelta(days=1)
    session.add(member)
    session.commit()
    assert member.status == "frozen"

def test_access_control_integration(client, session):
    """
    Integration test for access control checking endpoint.
    """
    plan = crud.create_plan(session, name="Access Monthly", duration_days=30, price=1000.0)
    
    # 1. Test scanning an unregistered card ID
    response = client.post("/api/attendance/scan", json={"card_id": "999-999-999", "method": "card"})
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["access_granted"] is False
    assert "Unrecognized" in res_data["reason"]
    
    # 2. Setup active member with card ID
    member = crud.create_member(session, name="Card User", phone="8888888888", plan_id=plan.id, join_date=date.today())
    member.card_id = "123-456-789"
    session.add(member)
    session.commit()
    
    # Test scanning active member
    response = client.post("/api/attendance/scan", json={"card_id": "123-456-789", "method": "card"})
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["access_granted"] is True
    assert res_data["reason"] == "Access Granted"
    
    # 3. Test scanning expired member
    member.expiry_date = date.today() - timedelta(days=1)
    session.add(member)
    session.commit()
    
    response = client.post("/api/attendance/scan", json={"card_id": "123-456-789", "method": "card"})
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["access_granted"] is False
    assert res_data["reason"] == "Membership Expired"
    
    # 4. Test scanning frozen member
    member.expiry_date = date.today() + timedelta(days=10)
    member.frozen_from = date.today()
    member.frozen_until = date.today() + timedelta(days=5)
    session.add(member)
    session.commit()
    
    response = client.post("/api/attendance/scan", json={"card_id": "123-456-789", "method": "card"})
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["access_granted"] is False
    assert res_data["reason"] == "Membership Frozen"

def test_complete_system_simulation_flow(client, session):
    """
    System test simulating full user journeys and financial validations.
    """
    # Step 1: Onboard the gym owner & configuration
    response = client.post("/api/auth/setup", json={"name": "Manager John", "pin": "9999"})
    assert response.status_code == 200
    
    # Verify we can login
    response = client.post("/api/auth/login", json={"pin": "9999"})
    assert response.status_code == 200
    
    # Setup Gym settings name
    settings_payload = {
        "gym_name": "Powerhouse Barbell",
        "owner_name": "Manager John",
        "phone": "9876543210",
        "access_policy": "fail_open"
    }
    response = client.post("/api/settings", json=settings_payload)
    assert response.status_code == 200
    
    # Step 2: Create membership subscription plans
    plan_monthly = crud.create_plan(session, name="Monthly Plan", duration_days=30, price=1500.0)
    plan_annual = crud.create_plan(session, name="Annual Plan", duration_days=365, price=12000.0)
    
    # Step 3: Register a new member
    member_payload = {
        "name": "Bruce Wayne",
        "phone": "9555555555",
        "card_id": "bat-card-001",
        "plan_id": plan_monthly.id,
        "join_date": date.today().isoformat()
    }
    response = client.post("/api/members", json=member_payload)
    assert response.status_code == 200
    member_id = response.json()["id"]
    
    # Step 4: Member checks in (Active)
    response = client.post("/api/attendance/scan", json={"card_id": "bat-card-001", "method": "card"})
    assert response.status_code == 200
    assert response.json()["access_granted"] is True
    
    # Step 5: Plan expires (move expiry_date in DB to yesterday)
    db_member = session.get(models.Member, member_id)
    db_member.expiry_date = date.today() - timedelta(days=1)
    session.add(db_member)
    session.commit()
    
    # Member checks in (Expired) - Access Denied
    response = client.post("/api/attendance/scan", json={"card_id": "bat-card-001", "method": "card"})
    assert response.status_code == 200
    assert response.json()["access_granted"] is False
    assert response.json()["reason"] == "Membership Expired"
    
    # Step 6: Log renewal payment
    payment_payload = {
        "member_id": member_id,
        "plan_id": plan_monthly.id,
        "amount": 1500.0,
        "method": "upi"
    }
    response = client.post("/api/payments", json=payment_payload)
    assert response.status_code == 200
    
    # Member checks in again (Active renewed)
    response = client.post("/api/attendance/scan", json={"card_id": "bat-card-001", "method": "card"})
    assert response.status_code == 200
    assert response.json()["access_granted"] is True
    
    # Step 7: Record operating expenses
    expense_payload_1 = {
        "category": "salary",
        "amount": 800.0,
        "date": date.today().isoformat(),
        "note": "Trainer wages"
    }
    expense_payload_2 = {
        "category": "utilities",
        "amount": 300.0,
        "date": date.today().isoformat(),
        "note": "Electricity bill"
    }
    response_exp1 = client.post("/api/expenses", json=expense_payload_1)
    assert response_exp1.status_code == 200
    response_exp2 = client.post("/api/expenses", json=expense_payload_2)
    assert response_exp2.status_code == 200
    
    # Step 8: Validate financial statement on Dashboard
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    dashboard_data = response.json()
    assert dashboard_data["revenue_this_month"] == 1500.0 # From the renewal payment
    assert dashboard_data["expenses_this_month"] == 1100.0 # salaries (800) + utilities (300)
    assert dashboard_data["net_profit"] == 400.0
    
    # Step 9: Propose member freeze via AI Confirmation Gate
    confirm_payload = {
        "action": "freeze_member",
        "params": {
            "member_id": member_id,
            "frozen_from": date.today().isoformat(),
            "frozen_until": (date.today() + timedelta(days=7)).isoformat()
        }
    }
    response = client.post("/api/ai/confirm", json=confirm_payload)
    assert response.status_code == 200
    
    # Step 10: Member checks in (Frozen) - Access Denied
    response = client.post("/api/attendance/scan", json={"card_id": "bat-card-001", "method": "card"})
    assert response.status_code == 200
    assert response.json()["access_granted"] is False
    assert response.json()["reason"] == "Membership Frozen"
