# Backend permissions (route inventory)

This document maps existing API routers to the **permission codes** that should gate them.

Notes:
- **Auth-only** means the endpoint requires authentication but no granular permission beyond that.
- **Read vs manage**: `*.read` for GET/list/detail; `*.manage` (or create/update/delete-specific codes where they already exist) for writes.

## Router → permissions

| Router prefix | What it covers | Read | Write/manage |
|---|---|---:|---:|
| `/api/auth/*` | login/refresh/logout/me/register | Public for login/refresh/logout; auth for `/me`; superuser for `/register` | n/a |
| `/api/setup/*` | first-run setup | Public until configured | Public until configured |
| `/api/rbac/*` | roles/permissions management | `roles.read` | `roles.manage` |
| `/api/audit/*` | audit logs export/stats | `audit.read` | n/a |
| `/api/settings/*` | school settings/profile/notifications | Auth-only for GETs; `settings.manage` for changes | `settings.manage` |
| `/api/students/*` | student CRUD | `students.read` | `students.create` / `students.update` / `students.delete` |
| `/api/guardians/*` | guardians CRUD | `guardians.read` | `guardians.manage` |
| `/api/applicants/*` | applicants/admissions | `applicants.read` | `applicants.manage` |
| `/api/programs/*` | programs CRUD | `programs.read` | `programs.manage` |
| `/api/courses/*` | courses CRUD | `courses.read` | `courses.manage` |
| `/api/student-groups/*` | student groups CRUD | `student_groups.read` | `student_groups.manage` |
| `/api/enrollments/*` | enrollments CRUD | `enrollments.read` | `enrollments.manage` |
| `/api/academic/*` | academic years/terms | `academic_years.read` | `academic_years.manage` |
| `/api/attendance/*` | attendance | `attendance.read` | `attendance.mark` (and/or manage if added later) |
| `/api/leave/*` | leave requests | `leave.read` | `leave.manage` |
| `/api/course-schedules/*` | course schedules | `course_schedules.read` | `course_schedules.manage` |
| `/api/instructors/*` | instructors | `instructors.read` | `instructors.manage` |
| `/api/rooms/*` | rooms | `rooms.read` | `rooms.manage` |
| `/api/notices/*` | notices | `notices.read` | `notices.publish*` |
| `/api/assessment/*` | exams/marks | `exams.read` / `marks.read` | `exams.manage` / `marks.enter` / `marks.publish` |
| `/api/fees/*` | fee categories/structures/schedules | `fees.read` | `fees.manage` |
| `/api/invoices/*` | invoices & payments | `invoices.read` / `payments.read` | `fees.manage` / `invoices.generate` / `payments.collect` |
| `/api/files/*` | file records + serving | `files.read` | `files.upload` / `files.delete` |
| `/api/clubs/*` | clubs | `clubs.read` | `clubs.manage` |
| `/api/k12/*` | k12 classes/sections/subjects/enrollments | `classes.read` / `sections.read` / `subjects.read` | `classes.manage` / `sections.manage` / `subjects.manage` |

