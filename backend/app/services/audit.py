import os
from datetime import datetime
from app.config import settings

AUDIT_FILE = os.path.join(settings.USER_DATA_DIR, "audit.log")


def log_audit(action: str, details: str, via: str = "manual"):
    os.makedirs(os.path.dirname(AUDIT_FILE), exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] [via: {via}] {action} - {details}\n"
    try:
        with open(AUDIT_FILE, "a", encoding="utf-8") as f:
            f.write(log_line)
    except Exception as e:
        print(f"Failed to write audit log: {e}")
