# School Management System – Frontend

Next.js (App Router) frontend for the School Management System.

## Prerequisites
- **Backend running** at `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`)
- Node.js 20+ recommended

## Setup (local dev)

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

From `.env.local.example`:
- **`NEXT_PUBLIC_API_URL`**: Backend base URL (no trailing slash)
- **`NEXT_PUBLIC_USE_API_PROXY`**:
  - `true` (recommended): frontend calls `/api/proxy/...` and uses **httpOnly cookies** (`sms_access`, `sms_refresh`) with automatic refresh
  - `false`: frontend uses direct backend calls with a Bearer token (legacy path)

## Useful commands

```bash
npm run lint
npm run typecheck
npm run build
```
