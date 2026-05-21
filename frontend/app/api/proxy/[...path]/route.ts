import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth-cookies";
import { BACKEND_URL, applySessionCookies, refreshTokensFromRequest } from "@/lib/server-auth";

async function proxy(req: NextRequest, path: string[]) {
  let access = req.cookies.get(ACCESS_COOKIE)?.value;
  const target = `${BACKEND_URL}/api/${path.join("/")}${req.nextUrl.search}`;
  let refreshedTokens: Awaited<ReturnType<typeof refreshTokensFromRequest>> = null;

  async function forward(token: string | undefined) {
    const headers = new Headers(req.headers);
    headers.delete("host");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    else headers.delete("authorization");
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
  if (res.status === 401) {
    refreshedTokens = await refreshTokensFromRequest(req);
    if (refreshedTokens) {
      access = refreshedTokens.accessToken;
      res = await forward(access);
    }
  }

  const body = await res.arrayBuffer();
  const out = new NextResponse(body, { status: res.status, headers: res.headers });
  if (refreshedTokens) applySessionCookies(out, refreshedTokens);
  return out;
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
