import os
from sqlmodel import SQLModel, create_engine, Session
from app.config import settings

# Parse the database file path to pre-create directories if needed
db_url = settings.DATABASE_PATH
if db_url.startswith("sqlite:///"):
    db_file_path = db_url.replace("sqlite:///", "")
    # Resolve directory path
    dir_name = os.path.dirname(db_file_path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)

# SQLite specific argument for multithreading in FastAPI
connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}

engine = create_engine(
    db_url,
    echo=False,
    connect_args=connect_args
)

def init_db():
    # Import all models to ensure they register on SQLModel.metadata
    from app.models import GymSettings, AdminUser, Plan, Member, Payment, Attendance, Expense, ChatMessage
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
