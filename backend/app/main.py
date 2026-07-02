from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.db import init_db
from app.routers import settings, auth, plans, members, payments, expenses, attendance, dashboard, ai
from app.services.websocket_manager import manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize the database tables on startup
    init_db()
    
    # Run automated rolling database backups on startup
    try:
        from app.services.backup import run_backup
        run_backup()
    except Exception as e:
        print(f"Startup database backup error: {e}")
        
    yield

app = FastAPI(
    title="BarbellOS API",
    description="Offline-first BarbellOS backend",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for the local React app (usually runs on port 5173 or inside Electron file context)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For desktop local apps, allow * simplifies dev and Electron environment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(settings.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(plans.router, prefix="/api")
app.include_router(members.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(expenses.router, prefix="/api")
app.include_router(attendance.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(ai.router, prefix="/api")

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "barbellos-backend"}

@app.websocket("/ws/attendance")
async def websocket_attendance(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection open, handle any incoming client messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    import os
    from app.config import settings
    port = int(os.environ.get("PORT", settings.BACKEND_PORT))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")


