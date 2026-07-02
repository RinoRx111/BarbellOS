import os
import subprocess
import sys

def build():
    # Change working directory to backend folder to resolve local app paths properly
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print("Starting FastAPI Backend compilation via PyInstaller...")
    
    # Define hidden imports necessary for FastAPI, Uvicorn, and SQLModel to execute properly
    hidden_imports = [
        "uvicorn.protocols.http.autoimpl",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.http.httptools_impl",
        "uvicorn.protocols.websockets.autoimpl",
        "uvicorn.protocols.websockets.websockets_impl",
        "uvicorn.lifespan.on",
        "uvicorn.lifespan.off",
        "sqlmodel.sql.expression",
        "sqlmodel.main",
        "email_validator",
        "anyio._backends._asyncio"
    ]
    
    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name=main",
        "--onefile",
        "--noconsole",
        "--clean",
        "--workpath=build_temp",
        "--distpath=dist",
    ]
    
    for imp in hidden_imports:
        cmd.append(f"--hidden-import={imp}")
        
    cmd.append("app/main.py")
    
    print(f"Running command: {' '.join(cmd)}")
    subprocess.check_call(cmd)
    print("Backend compilation completed successfully!")

if __name__ == "__main__":
    build()
