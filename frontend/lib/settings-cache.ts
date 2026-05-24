import { api } from "@/lib/api";

type CacheEntry = { data: unknown; expiresAt: number };

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 60_000;
const STORAGE_PREFIX = "sms-settings-cache:";

function cacheKey(path: string, token?: string | null): string {
  return `${token ?? "cookie"}::${path}`;
}

function readSession(key: string): CacheEntry | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(key: string, entry: CacheEntry): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota or private mode */
  }
}

function clearSession(prefix?: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (!prefix) {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k?.startsWith(STORAGE_PREFIX)) sessionStorage.removeItem(k);
      }
      return;
    }
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX) && k.includes(prefix)) sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

/** GET with in-memory + sessionStorage TTL cache for settings pages. */
export async function cachedGet<T>(
  path: string,
  options: { token?: string | null } = {},
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  const key = cacheKey(path, options.token);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.data as T;
  }
  const sessionHit = readSession(key);
  if (sessionHit) {
    cache.set(key, sessionHit);
    return sessionHit.data as T;
  }
  const data = await api<T>(path, options);
  const entry: CacheEntry = { data, expiresAt: Date.now() + ttlMs };
  cache.set(key, entry);
  writeSession(key, entry);
  return data;
}

/** Drop cached GET responses (call after PATCH/POST/DELETE). */
export function invalidateSettingsCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    clearSession();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(prefix)) cache.delete(key);
  }
  clearSession(prefix);
}
