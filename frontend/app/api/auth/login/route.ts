import { NextRequest, NextResponse } from "next/server";
import { applySessionCookies, BACKEND_URL } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const form = new URLSearchParams();
  form.append("username", body.email);
  form.append("password", body.password);
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ detail: data.detail || "Login failed" }, { status: res.status });
  }
  let user = null;
  const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  if (meRes.ok) user = await meRes.json();

  const response = NextResponse.json({ user });
  applySessionCookies(response, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  });
  return response;
}
