import { NextRequest, NextResponse } from "next/server";
import { applySessionCookies, refreshTokensFromRequest } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  const tokens = await refreshTokensFromRequest(req);
  if (!tokens) {
    return NextResponse.json({ detail: "No refresh token" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  applySessionCookies(response, tokens);
  return response;
}
