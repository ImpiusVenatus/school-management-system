import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ACCESS_MIN = 15;
const REFRESH_DAYS = 7;

export async function POST(req: NextRequest) {
  const refresh = req.cookies.get("sms_refresh")?.value;
  if (!refresh) {
    return NextResponse.json({ detail: "No refresh token" }, { status: 401 });
  }
  const res = await fetch(`${BACKEND}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set("sms_access", data.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: ACCESS_MIN * 60,
    path: "/",
  });
  if (data.refresh_token) {
    response.cookies.set("sms_refresh", data.refresh_token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: REFRESH_DAYS * 24 * 60 * 60,
      path: "/api/auth",
    });
  }
  return response;
}
