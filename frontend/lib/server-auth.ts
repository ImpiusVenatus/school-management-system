import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, ACCESS_TOKEN_MAX_AGE_SEC, REFRESH_COOKIE } from "@/lib/auth-cookies";

export const BACKEND_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const REFRESH_MAX_AGE_SEC = 7 * 24 * 60 * 60;
const COOKIE_PATH = "/";

export type SessionTokens = {
  accessToken: string;
  refreshToken?: string;
};

/** Call backend refresh; does not mutate the response. */
export async function refreshTokensFromRequest(req: NextRequest): Promise<SessionTokens | null> {
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;
  const res = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  if (!data.access_token) return null;
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

export function applySessionCookies(response: NextResponse, tokens: SessionTokens) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: ACCESS_TOKEN_MAX_AGE_SEC,
    path: COOKIE_PATH,
  });
  if (tokens.refreshToken) {
    response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: REFRESH_MAX_AGE_SEC,
      path: COOKIE_PATH,
    });
    // Drop legacy narrow-path refresh cookie from older builds
    response.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, path: "/api/auth", maxAge: 0 });
  }
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, path: COOKIE_PATH, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, path: COOKIE_PATH, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, path: "/api/auth", maxAge: 0 });
}

/** Returns a valid access JWT, refreshing the session when the current one is missing or expired. */
export async function resolveAccessToken(
  req: NextRequest
): Promise<{ accessToken: string; refreshed: SessionTokens | null } | null> {
  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  if (access) {
    const me = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${access}` },
    });
    if (me.ok) return { accessToken: access, refreshed: null };
  }
  const refreshed = await refreshTokensFromRequest(req);
  if (!refreshed) return null;
  return { accessToken: refreshed.accessToken, refreshed };
}
