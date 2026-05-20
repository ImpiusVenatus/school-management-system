# School Management System - Backend

FastAPI backend based on **Frappe Education** module. Uses **Neon PostgreSQL** and **in-house auth only** (no Google or third-party login).

## Setup

1. **Python 3.11+** – use a venv inside `backend/`:

   ```bash
   cd backend
   python -m venv venv
   ```

   Activate the venv:

   - **Windows (Git Bash / MINGW64):** `source venv/Scripts/activate`
   - **Windows (cmd):** `venv\Scripts\activate`
   - **Windows (PowerShell):** `venv\Scripts\Activate.ps1`
   - **macOS/Linux:** `source venv/bin/activate`

   Then install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. **Database (Neon)**  
   Copy `.env.example` to `.env` and set:

   ```env
   DATABASE_URL=postgresql://user:password@your-host.neon.tech/neondb?sslmode=require
   SECRET_KEY=your-secret-key
   ```

3. **Create tables** (first time):

   ```bash
   cd backend
   python -c "from app.main import init_db; init_db()"
   # Or use Alembic: alembic upgrade head
   ```

4. **Run the server**:

   ```bash
   python run.py
   # or: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   - API: http://localhost:8000  
   - Docs: http://localhost:8000/docs  

## Auth (in-house only)

- **POST /api/auth/login** – Form: `username` (email), `password` → returns JWT.
- **POST /api/auth/register** – Body: `email`, `password`, `full_name`, `role`.
- **GET /api/auth/me** – Header: `Authorization: Bearer <token>`.

All other `/api/*` routes require `Authorization: Bearer <token>`.

## Main API areas (from Frappe Education)

| Area | Prefix | Notes |
|------|--------|--------|
| Auth | `/api/auth` | Login, register, me |
| Students | `/api/students` | CRUD, guardians link |
| Programs | `/api/programs` | CRUD, program courses |
| Courses | `/api/courses` | CRUD, assessment criteria |
| Enrollments | `/api/enrollments` | Program + course enrollments |
| Academic | `/api/academic` | Years, terms |
| Student groups | `/api/student-groups` | Groups, get students in group |
| Course schedules | `/api/course-schedules` | CRUD, events for calendar |
| Attendance | `/api/attendance` | List, mark attendance, check exists |
| Leave | `/api/leave` | Apply leave, list |
| Fees | `/api/fees` | Structures, schedules, components |
| Assessment | `/api/assessment` | Grading scales, plans, results, get_grade |
| Instructors | `/api/instructors` | CRUD |
| Rooms | `/api/rooms` | CRUD |
| Guardians | `/api/guardians` | CRUD, get_student_guardians |
| Applicants | `/api/applicants` | CRUD, enroll_student from applicant |

## Migrations (Alembic)

```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```

```bash
python scripts/reset_db.py        # asks you to type "reset"
python scripts/reset_db.py --yes  # no prompt
```