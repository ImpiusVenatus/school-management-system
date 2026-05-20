import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function proxy(req: NextRequest, path: string[]) {
  let access = req.cookies.get("sms_access")?.value;
  const target = `${BACKEND}/api/${path.join("/")}${req.nextUrl.search}`;

  async function forward(token: string | undefined) {
    const headers = new Headers(req.headers);
    headers.delete("host");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const init: RequestInit = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") {
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("multipart/form-data")) {
        init.body = await req.arrayBuffer();
      } else {
        init.body = await req.text();
      }
    }
    return fetch(target, init);
  }

  let res = await forward(access);
  if (res.status === 401 && req.cookies.get("sms_refresh")?.value) {
    const refreshRes = await fetch(new URL("/api/auth/refresh", req.url).toString(), {
      method: "POST",
      headers: { cookie: req.headers.get("cookie") || "" },
    });
    if (refreshRes.ok) {
      const setCookies = refreshRes.headers.getSetCookie?.() || [];
      const newAccess = setCookies
        .map((c) => c.split(";")[0])
        .find((c) => c.startsWith("sms_access="))
        ?.split("=")[1];
      access = newAccess ? decodeURIComponent(newAccess) : req.cookies.get("sms_access")?.value;
      res = await forward(access);
      const out = new NextResponse(await res.arrayBuffer(), { status: res.status, headers: res.headers });
      for (const c of setCookies) out.headers.append("set-cookie", c);
      return out;
    }
  }

  const body = await res.arrayBuffer();
  return new NextResponse(body, { status: res.status, headers: res.headers });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
