import os
import pytest
from datetime import date, datetime, timedelta
from sqlmodel import SQLModel, create_engine, Session
from fastapi.testclient import TestClient

# Use a temporary file SQLite database for tests to support multi-thread access
TEST_DB_FILE = "test_temp.db"
os.environ["DATABASE_PATH"] = f"sqlite:///{TEST_DB_FILE}"

from app.main import app
from app.db import get_session
from app import crud, models

# Setup standard SQLite testing engine
engine = create_engine(f"sqlite:///{TEST_DB_FILE}", connect_args={"check_same_thread": False})

@pytest.fixture(name="session")
def session_fixture():
    # Clean up any leftover test db
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass
            
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    
    # Clean up test db after tests
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

def test_member_status_and_payment_stacking(session):
    # 1. Create a plan
    plan = crud.create_plan(session, name="Monthly", duration_days=30, price=1000.0)
    assert plan.id is not None
    
    # 2. Create a member
    join_date = date.today()
    member = crud.create_member(
        session, name="John Doe", phone="1234567890", plan_id=plan.id, join_date=join_date
    )
    
    # Expected expiry is join_date + 30 days
    assert member.expiry_date == join_date + timedelta(days=30)
    assert member.status == "active"
    
    # 3. Test expiry status change
    member.expiry_date = date.today() - timedelta(days=5)
    session.add(member)
    session.commit()
    assert member.status == "expired"
    
    # 4. Log a payment on expired member - should start plan today
    payment_date = datetime.utcnow()
    crud.log_payment(
        session, member_id=member.id, plan_id=plan.id, amount=1000.0, method="cash", payment_date=payment_date
    )
    # Expiry should now be payment_date + 30 days
    assert member.expiry_date == payment_date.date() + timedelta(days=30)
    assert member.status == "active"
    
    # 5. Log a payment on active member - should stack (add 30 days on top of current expiry)
    current_expiry = member.expiry_date
    crud.log_payment(
        session, member_id=member.id, plan_id=plan.id, amount=1000.0, method="cash", payment_date=payment_date
    )
    assert member.expiry_date == current_expiry + timedelta(days=30)

def test_member_freeze_and_unfreeze(session):
    plan = crud.create_plan(session, name="Monthly", duration_days=30, price=1000.0)
    join_date = date.today()
    member = crud.create_member(
        session, name="Alice", phone="0987654321", plan_id=plan.id, join_date=join_date
    )
    
    original_expiry = member.expiry_date  # join_date + 30 days
    
    # Freeze for 10 days
    freeze_start = join_date + timedelta(days=5)
    freeze_end = join_date + timedelta(days=14)  # 10 days inclusive (14 - 5 + 1)
    
    crud.freeze_member(session, member_id=member.id, frozen_from=freeze_start, frozen_until=freeze_end)
    
    # Expiry date should shift by 10 days
    assert member.expiry_date == original_expiry + timedelta(days=10)
    
    # Set dates so freeze is currently active (enveloping today)
    member.frozen_from = date.today() - timedelta(days=1)
    member.frozen_until = date.today() + timedelta(days=1)
    session.add(member)
    session.commit()
    assert member.status == "frozen"
    
    # Unfreeze today (unfreeze_date = today)
    # Original freeze: yesterday (day 0), today (day 1), tomorrow (day 2). Total 3 days.
    # Actual freeze: only yesterday (1 day). Today is unfreeze, so they return.
    # Expiry should subtract 2 unused days (tomorrow + today)
    original_expiry_with_freeze = member.expiry_date
    crud.unfreeze_member(session, member_id=member.id, unfreeze_date=date.today())
    
    assert member.expiry_date == original_expiry_with_freeze - timedelta(days=2)
    assert member.frozen_until == date.today() - timedelta(days=1)  # Ended yesterday
    assert member.status == "active"

def test_api_endpoints_settings_and_auth(client):
    # Health check
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    
    # Auth status (should be false/not onboarded initially)
    response = client.get("/api/auth/status")
    assert response.status_code == 200
    assert response.json()["onboarded"] is False
    
    # Setup admin
    response = client.post("/api/auth/setup", json={"name": "Owner", "pin": "1234"})
    assert response.status_code == 200
    assert response.json()["name"] == "Owner"
    
    # Auth status should now be true
    response = client.get("/api/auth/status")
    assert response.status_code == 200
    assert response.json()["onboarded"] is True
    
    # Fail dual setup
    response = client.post("/api/auth/setup", json={"name": "Owner2", "pin": "4321"})
    assert response.status_code == 400
    
    # Login success
    response = client.post("/api/auth/login", json={"pin": "1234"})
    assert response.status_code == 200
    assert response.json()["status"] == "unlocked"
    
    # Login fail
    response = client.post("/api/auth/login", json={"pin": "wrong"})
    assert response.status_code == 401

def test_dashboard_endpoint(client, session):
    # 1. Setup plan & member
    plan = crud.create_plan(session, name="Monthly", duration_days=30, price=1000.0)
    join_date = date.today()
    member = crud.create_member(
        session, name="Jane", phone="1231231234", plan_id=plan.id, join_date=join_date
    )
    
    # 2. Setup payment
    crud.log_payment(
        session, member_id=member.id, plan_id=plan.id, amount=1000.0, method="upi", payment_date=datetime.utcnow()
    )
    
    # 3. Setup expense
    crud.create_expense(session, category="maintenance", amount=200.0, date_val=join_date)
    
    # 4. Setup attendance
    crud.log_attendance(session, member_id=member.id, check_in_method="biometric", access_granted=True)
    
    # Check dashboard API
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert data["active_members"] == 1
    assert data["revenue_this_month"] == 1000.0
    assert data["expenses_this_month"] == 200.0
    assert data["net_profit"] == 800.0
    assert len(data["recent_attendance"]) == 1
    assert data["recent_attendance"][0]["member_name"] == "Jane"

def test_database_backup_and_retention(session):
    from app.services.backup import run_backup
    
    # Trigger backup (since TEST_DB_FILE is test_temp.db, backup will go to test_temp.db's backups folder)
    run_backup()
    
    # Verify backup folder exists
    backup_dir = "backups"
    assert os.path.exists(backup_dir)
    
    # Verify file is backed up
    files = os.listdir(backup_dir)
    assert len(files) > 0
    assert any("test_temp_backup" in f for f in files)
    
    # Clean up test backups
    for f in files:
        os.remove(os.path.join(backup_dir, f))
    os.rmdir(backup_dir)

def test_ai_endpoints_and_history(client, session):
    from datetime import date, timedelta
    
    # 1. Update AI config
    payload = {
        "provider": "groq",
        "api_key": "gsk_testkey",
        "openai_key": "sk_testkey",
        "anthropic_key": "ant_testkey",
        "ollama_url": "http://localhost:11434"
    }
    response = client.post("/api/ai/config", json=payload)
    assert response.status_code == 200
    
    # Check config loads
    response = client.get("/api/ai/config")
    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "groq"
    assert data["api_key"] == "gsk_testkey"
    
    # 2. Add message directly
    msg = models.ChatMessage(role="user", content="Hello AI")
    session.add(msg)
    session.commit()
    
    # Check history
    response = client.get("/api/ai/history")
    assert response.status_code == 200
    history = response.json()
    assert len(history) == 1
    assert history[0]["content"] == "Hello AI"
    
    # 3. Confirm write action (freeze_member)
    plan = crud.create_plan(session, name="Monthly Plan", duration_days=30, price=1000.0)
    member = crud.create_member(
        session,
        name="Bob AI",
        phone="5555555555",
        plan_id=plan.id,
        join_date=date.today()
    )
    
    confirm_payload = {
        "action": "freeze_member",
        "params": {
            "member_id": member.id,
            "frozen_from": date.today().isoformat(),
            "frozen_until": (date.today() + timedelta(days=10)).isoformat()
        }
    }
    
    response = client.post("/api/ai/confirm", json=confirm_payload)
    assert response.status_code == 200
    res_data = response.json()
    assert "Successfully executed action" in res_data["message"]
    
    # Verify member status is frozen
    session.refresh(member)
    assert member.status == "frozen"



