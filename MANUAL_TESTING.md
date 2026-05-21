# Manual testing guide (temporary)

Use this checklist to walk through the app in a sensible order after UI or API changes. Delete or archive this file when you no longer need it.

**Prerequisites**

| Step | Command / action |
|------|------------------|
| PostgreSQL running | Database URL in `backend/.env` |
| Backend | `cd backend && fastapi dev app/main.py` → http://localhost:8000 |
| Frontend | `cd frontend && npm run dev` → http://localhost:3000 |
| Env | `frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8000` (proxy/cookies on by default) |

**UI note:** All dashboard dropdowns use the custom **SelectField** (click to open, pick an option). Verify opens/closes and selection on each page below.

---

## Phase 0 — First run & auth

| # | Test | Expected |
|---|------|----------|
| 0.1 | Open http://localhost:3000 (fresh DB) | Redirect to `/setup` |
| 0.2 | Complete setup: school name, type (Program or K-12), admin email/password | Success → dashboard or login |
| 0.3 | Log out (sidebar **Sign out**) | Login page (split layout) |
| 0.4 | Sign in with admin credentials | Dashboard overview loads |
| 0.5 | Sidebar: only **one** sub-item highlighted per section (e.g. **By class** vs **All students**) | No double-active pills |
| 0.6 | Top bar: breadcrumbs, search field, notices, settings | Renders without errors |

---

## Phase 1 — Overview & settings

| # | Route | What to test |
|---|--------|----------------|
| 1.1 | `/dashboard` | Metric cards, attendance/fees/agenda widgets (may be empty on new DB) |
| 1.2 | `/dashboard/settings` | Change school name; **School type** dropdown (Program / K-12); Save — if type changes with existing data, **warning modal** appears with counts; snackbar confirms save; sidebar refreshes |
| 1.3 | `/dashboard/settings/roles` | Permission catalog loads; create role; toggle permissions; **Assign user** dropdown |

If you switch school type to **K-12**, refresh and confirm sidebar **Academics** shows Classes / Sections / Subjects instead of Classes (program) / Subjects.

---

## Phase 2 — People

### Students

| # | Route | What to test |
|---|--------|----------------|
| 2.1 | `/dashboard/students/new` | Add student form: **Gender** + guardian **Relation** dropdowns; submit |
| 2.2 | `/dashboard/students` | List shows new student; open detail |
| 2.3 | `/dashboard/students/[id]` | Edit mode: **Gender** dropdown; save |
| 2.4 | `/dashboard/students/by-class` | **Class (Program)** dropdown loads (not stuck on “Loading…”); pick class → **Section** dropdown → student table |

### Teachers

| # | Route | What to test |
|---|--------|----------------|
| 2.5 | `/dashboard/teachers/new` | **Gender** dropdown; create teacher |
| 2.6 | `/dashboard/teachers` | List; open detail |
| 2.7 | `/dashboard/teachers/[id]` | **Gender** dropdown in edit; save |

---

## Phase 3 — Academics (program-based school)

| # | Route | What to test |
|---|--------|----------------|
| 3.1 | `/dashboard/student-groups` | **Academic year** + **Class (Program)** filter dropdowns; add section modal |
| 3.2 | `/dashboard/courses` | List/create subjects (no native `<select>`) |
| 3.3 | `/dashboard/schedule` | **Section** filter dropdown; **Add Schedule** modal: Section, Course, Instructor, Room dropdowns |
| 3.4 | `/dashboard/attendance` | **Section** dropdown; pick date; view / mark attendance |
| 3.5 | `/dashboard/exam` | **New Assessment Plan** modal: Section, Course, Grading scale dropdowns; enter marks if plans exist |

---

## Phase 3b — Academics (K-12 school type)

Set school type to **K-12** in settings first.

| # | Route | What to test |
|---|--------|----------------|
| 3b.1 | `/dashboard/k12/classes` | **Academic year** dropdown; add class |
| 3b.2 | `/dashboard/k12/sections` | **Class** filter + modal **Class** dropdown; add section |
| 3b.3 | `/dashboard/k12/subjects` | CRUD subjects |

---

## Phase 4 — Operations

| # | Route | What to test |
|---|--------|----------------|
| 4.1 | `/dashboard/admissions` | **Status** filter dropdown; **New Application**: Program + Academic year dropdowns; status workflow (Applied → Approved, etc.) |
| 4.2 | `/dashboard/fees` | **Status** filter dropdown; **Generate Invoices**: fee structure dropdown (needs `fees.manage` / superuser) |
| 4.3 | `/dashboard/notices` | **Category** filter; **New Notice**: category dropdown; create category (admin) |
| 4.4 | `/dashboard/clubs` | List; create club; club detail `/dashboard/clubs/[id]` |
| 4.5 | `/dashboard/files` | **Filter by category** + **Upload (category)** dropdowns; upload file; download |

---

## Phase 5 — Permissions (optional second user)

| # | Test | Expected |
|---|------|----------|
| 5.1 | Create role with limited permissions (e.g. only `notices.read`) | Role saves |
| 5.2 | Register or assign user that role | Sidebar hides Admissions, Fees, etc. |
| 5.3 | Sign in as that user | Restricted nav; API 403 on blocked actions |

Super admin (`is_superuser` from setup) bypasses role checks.

---

## Phase 6 — Regression smoke (15 min)

Run quickly after large changes:

1. Login / logout  
2. Students by class: both dropdowns work  
3. One modal with 3+ dropdowns (Schedule or Exam)  
4. Settings school type dropdown  
5. Sidebar: single active child under Students  
6. No browser console errors on navigation  

---

## School type switching (important)

- Switching **Program ↔ K-12** does **not** delete or migrate data. Both datasets can exist; only the **sidebar** changes.
- Program data: student groups, programs, courses, enrollments.
- K-12 data: classes, sections, subjects, enrollments.
- Settings save requires `settings.manage` or superuser (not only `role === admin`).

---

## Known limitations (not bugs for this pass)

- Top bar **search** and **This week** are placeholders (no command palette yet).  
- **Export** on overview is placeholder.  
- **Forgot?** on login is disabled.  
- Setup page (`/setup`) still uses native `<select>` for school type (outside dashboard shell).  

---

## Reset database (dev only)

```bash
cd backend
python scripts/reset_db.py --yes
```

Then repeat **Phase 0** from setup.

---

## Report issues

Note: route, action, expected vs actual, browser, and whether backend logs show 4xx/5xx.
