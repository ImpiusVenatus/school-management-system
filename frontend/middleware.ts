import { NextRequest, NextResponse } from "next/server";

const PUBLIC = ["/login", "/setup", "/"];
const AUTH_API = ["/api/auth/login", "/api/auth/refresh", "/api/auth/logout"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (AUTH_API.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }
  if (PUBLIC.includes(pathname)) {
    return NextResponse.next();
  }
  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }
  const access = req.cookies.get("sms_access")?.value;
  if (access) {
    return NextResponse.next();
  }
  const refresh = req.cookies.get("sms_refresh")?.value;
  if (refresh) {
    const refreshUrl = new URL("/api/auth/refresh", req.url);
    const res = await fetch(refreshUrl, {
      method: "POST",
      headers: { cookie: req.headers.get("cookie") || "" },
    });
    if (res.ok) {
      const response = NextResponse.next();
      const setCookies = res.headers.getSetCookie?.() || [];
      for (const c of setCookies) response.headers.append("set-cookie", c);
      return response;
    }
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/setup"],
};
