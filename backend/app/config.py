import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_PATH: str = "sqlite:///data/gym_management.db"
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

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
