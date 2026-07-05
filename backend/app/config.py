import os
import sys
from pydantic_settings import BaseSettings, SettingsConfigDict

def get_user_data_dir() -> str:
    appName = "BarbellOS"
    if os.name == 'nt':
        appdata = os.environ.get('APPDATA')
        if appdata:
            return os.path.join(appdata, appName)
        else:
            return os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming', appName)
    elif sys.platform == 'darwin':
        return os.path.join(os.path.expanduser('~'), 'Library', 'Application Support', appName)
    else:
        return os.path.join(os.path.expanduser('~'), '.config', appName)

def resolve_db_path() -> str:
    env_path = os.environ.get("DATABASE_PATH")
    if env_path:
        return env_path
    
    if getattr(sys, 'frozen', False):
        appdata_dir = get_user_data_dir()
        db_file = os.path.join(appdata_dir, "gym_management.db")
        return f"sqlite:///{db_file}"
    
    return "sqlite:///data/gym_management.db"

def resolve_user_data_dir() -> str:
    db_url = resolve_db_path()
    if db_url.startswith("sqlite:///"):
        db_file_path = db_url.replace("sqlite:///", "")
        dir_name = os.path.dirname(db_file_path)
        if dir_name:
            return dir_name
            
    if getattr(sys, 'frozen', False):
        return get_user_data_dir()
        
    return "data"

class Settings(BaseSettings):
    DATABASE_PATH: str = resolve_db_path()
    USER_DATA_DIR: str = resolve_user_data_dir()
    BACKEND_PORT: int = 8000
    SECRET_KEY: str = "default-secret-key-for-pin-sessions"
    
    # Hardware Configuration
    MOCK_HARDWARE: bool = True
    HARDWARE_READER_IP: str = "192.168.1.201"
    HARDWARE_READER_PORT: int = 4370
    
    # AI Assistant Configuration
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    
    # Clerk Authentication Configuration
    CLERK_PUBLISHABLE_KEY: str = ""
    CLERK_SECRET_KEY: str = ""

    model_config = SettingsConfigDict(

        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

