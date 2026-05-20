import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ACCESS_MIN = 15;
const REFRESH_DAYS = 7;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const form = new URLSearchParams();
  form.append("username", body.email);
  form.append("password", body.password);
  const res = await fetch(`${BACKEND}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ detail: data.detail || "Login failed" }, { status: res.status });
  }
  const secure = process.env.NODE_ENV === "production";
  let user = null;
  const meRes = await fetch(`${BACKEND}/api/auth/me`, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  if (meRes.ok) user = await meRes.json();

  const response = NextResponse.json({ user });
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
