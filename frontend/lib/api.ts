const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const USE_PROXY = process.env.NEXT_PUBLIC_USE_API_PROXY !== "false";

export function getApiUrl(path: string) {
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function resolveRequest(path: string, token?: string): { url: string; credentials?: RequestCredentials } {
  if (token) {
    return { url: getApiUrl(path) };
  }
  if (USE_PROXY && typeof window !== "undefined") {
    const proxyPath = path.startsWith("/api/") ? path.slice(5) : path.replace(/^\//, "");
    return { url: `/api/proxy/${proxyPath}`, credentials: "include" };
  }
  return { url: getApiUrl(path), credentials: "include" };
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token: rawToken, ...init } = options;
  const token = rawToken ?? undefined;
  const { url, credentials } = resolveRequest(path, token);
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...init, headers, credentials: credentials ?? init.credentials });
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      const refreshed = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" }).catch(() => null);
      if (refreshed?.ok) {
        const retry = await fetch(url, { ...init, headers, credentials: "include" });
        if (retry.ok) {
          if (retry.status === 204 || retry.headers.get("content-length") === "0") return undefined as T;
          return retry.json();
        }
      }
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail) || "Request failed");
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return res.json();
}

export async function apiFormData<T>(
  path: string,
  formData: FormData,
  options: { token?: string | null } = {}
): Promise<T> {
  const token = options.token ?? undefined;
  const { url, credentials } = resolveRequest(path, token);
  const headers: HeadersInit = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { method: "POST", body: formData, headers, credentials: credentials ?? "include" });
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}
