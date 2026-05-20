import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  const refresh = req.cookies.get("sms_refresh")?.value;
  if (refresh) {
    await fetch(`${BACKEND}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    }).catch(() => {});
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("sms_access", "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set("sms_refresh", "", { httpOnly: true, path: "/api/auth", maxAge: 0 });
  return res;
}
