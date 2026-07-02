import os
import json
from app.config import settings

CONFIG_FILE = os.path.join(settings.USER_DATA_DIR, "ai_config.json")


def get_ai_config() -> dict:
    # Pre-create directory if needed
    os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
    
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
            
    # Default fallback to env variables
    return {
        "provider": "groq",
        "api_key": settings.GROQ_API_KEY,
        "openai_key": settings.OPENAI_API_KEY,
        "anthropic_key": settings.ANTHROPIC_API_KEY,
        "ollama_url": settings.OLLAMA_BASE_URL
    }

def save_ai_config(config: dict):
    os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)
