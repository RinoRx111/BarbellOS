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
    from app.models import GymSettings, AdminUser, Plan, Member, Payment, Attendance, Expense, ChatMessage, ChatSession
    SQLModel.metadata.create_all(engine)
    
    # Run database migration for ChatSession if needed
    from sqlalchemy import text
    with engine.begin() as conn:
        # Check if chatmessage table exists first
        result_tables = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='chatmessage';")).fetchall()
        if result_tables:
            result_info = conn.execute(text("PRAGMA table_info(chatmessage);")).fetchall()
            columns = [row[1] for row in result_info]
            if "session_id" not in columns:
                try:
                    # Add column
                    conn.execute(text("ALTER TABLE chatmessage ADD COLUMN session_id INTEGER REFERENCES chatsession(id);"))
                    
                    # Create a default session for old history if there are messages
                    msg_count = conn.execute(text("SELECT COUNT(*) FROM chatmessage;")).scalar()
                    if msg_count > 0:
                        conn.execute(text("INSERT INTO chatsession (title, created_at) VALUES ('Previous History', datetime('now'));"))
                        sess_id = conn.execute(text("SELECT id FROM chatsession WHERE title = 'Previous History' ORDER BY id DESC LIMIT 1;")).scalar()
                        if sess_id:
                            conn.execute(text(f"UPDATE chatmessage SET session_id = {sess_id} WHERE session_id IS NULL;"))
                except Exception as e:
                    print("Migration error adding session_id column:", e)


def get_session():
    with Session(engine) as session:
        yield session
