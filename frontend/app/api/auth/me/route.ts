import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, applySessionCookies, resolveAccessToken } from "@/lib/server-auth";

export async function GET(req: NextRequest) {
  const session = await resolveAccessToken(req);
  if (!session) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  const response = NextResponse.json(data, { status: res.status });
  if (session.refreshed) applySessionCookies(response, session.refreshed);
  return response;
}
