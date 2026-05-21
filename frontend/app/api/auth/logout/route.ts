import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, clearSessionCookies } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  const refresh = req.cookies.get("sms_refresh")?.value;
  if (refresh) {
    await fetch(`${BACKEND_URL}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    }).catch(() => {});
  }
  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  return res;
}
