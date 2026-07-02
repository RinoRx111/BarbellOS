import os
import shutil
import glob
from datetime import datetime
from app.config import settings

def run_backup():
    db_url = settings.DATABASE_PATH
    if not db_url.startswith("sqlite:///"):
        return
        
    db_file_path = db_url.replace("sqlite:///", "")
    if not os.path.exists(db_file_path):
        return
        
    # Determine backup folder relative to database location
    db_dir = os.path.dirname(db_file_path) or "."
    backup_dir = os.path.join(db_dir, "backups")
    os.makedirs(backup_dir, exist_ok=True)
    
    # Generate timestamped filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    db_filename = os.path.basename(db_file_path)
    base_name, ext = os.path.splitext(db_filename)
    backup_filename = f"{base_name}_backup_{timestamp}{ext}"
    backup_file_path = os.path.join(backup_dir, backup_filename)
    
    try:
        # Perform safe copy (copy metadata and content)
        shutil.copy2(db_file_path, backup_file_path)
        print(f"Database backup successfully created: {backup_file_path}")
        
        # Enforce maximum retention limit of 30 rolling backups
        search_pattern = os.path.join(backup_dir, f"{base_name}_backup_*[0-9]{ext}")
        backup_files = sorted(glob.glob(search_pattern))
        
        if len(backup_files) > 30:
            files_to_delete = backup_files[:-30]
            for file_path in files_to_delete:
                try:
                    os.remove(file_path)
                    print(f"Purged old backup file: {file_path}")
                except Exception as e:
                    print(f"Failed to purge old backup {file_path}: {e}")
                    
    except Exception as e:
        print(f"Failed to perform automated database backup: {e}")
