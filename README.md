# School Management System

A complete school management system with FastAPI backend and Next.js frontend. Single-tenant per deployment—each school runs its own instance.

## Structure

```
school-management-system/
├── backend/     # FastAPI + PostgreSQL
├── frontend/    # Next.js + Tailwind
└── README.md
```

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv venv
# Activate venv (Windows: venv\Scripts\activate)
pip install -r requirements.txt
cp .env.example .env   # Set DATABASE_URL, SECRET_KEY
python -c "from app.main import init_db; init_db()"
fastapi dev app/main.py
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

### 3. First Run

Open http://localhost:3000. If not configured, you'll see the setup page to enter school name, logo, and create the first admin account.

## Features

- **Setup**: First-run configuration (school name, logo, first admin)
- **Students**: List, detail, add/edit; grade, section, advisor
- **Teachers**: List, detail, assignments, termination
- **Clubs**: Clubs, moderators, members, posts (year-scoped)
- **Notices**: Categories, notices (pinned, filters)
- **Files**: Upload, list, download (local storage)
- **Auth**: In-house only (email + password, JWT)
