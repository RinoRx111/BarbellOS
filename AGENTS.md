# BarbellOS - Agent Guidelines

This workspace contains a single-tenant, offline-first desktop BarbellOS (Gym Management System).

## Project Commands

### Frontend (React + Vite)
- **Path**: `frontend/`
- **Development Server**: `npm run dev`
- **Production Build**: `npm run build`
- **Run Tests**: `npm run test`

### Backend (FastAPI + SQLModel)
- **Path**: `backend/`
- **Development Server**: `python -m uvicorn app.main:app --reload`
- **Run Tests**: `pytest`
- **Run Migrations**: `alembic upgrade head`

---

## Architectural & Design Constraints

These decisions are intentional. Do NOT change or "fix" them:

1. **Strict Single-Tenancy**:
   - Do NOT add `gym_id`, `tenant_id`, or multi-tenancy scaffolding anywhere. The app runs offline on a single machine for one gym.
2. **Derived Member Status**:
   - The `status` field on members is **never** a stored, trusted database column.
   - Status must always be derived dynamically at query time from `expiry_date` and frozen periods (`frozen_from` and `frozen_until`).
   - Do NOT build background worker scripts or cron jobs that write/update a stored status column.
3. **Fail-Open Default Access Policy**:
   - The physical access control policy must default to `fail_open`.
   - If the backend or reader is offline, the door defaults to unlocked. Do NOT change this default unless explicitly requested.
4. **No Raw SQL execution in AI Assistant**:
   - The AI assistant must only call named, validated internal Python/SQLModel functions.
   - Do NOT create a generic tool that executes raw SQL queries from user input.

---

## Reference Documents

- **Glossary & AI Rules**: [docs/GLOSSARY.md](file:///c:/Users/aditi/OneDrive/Desktop/gym%20management%20system/docs/GLOSSARY.md)
- **Database Schema**: [docs/SCHEMA.md](file:///c:/Users/aditi/OneDrive/Desktop/gym%20management%20system/docs/SCHEMA.md)
- **API Docs**: Check the `/docs` endpoint on the running local backend (`http://localhost:8000/docs`).
