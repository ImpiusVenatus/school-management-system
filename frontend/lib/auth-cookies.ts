export const ACCESS_COOKIE = "sms_access";
export const REFRESH_COOKIE = "sms_refresh";

/** Must match backend ACCESS_TOKEN_EXPIRE_MINUTES (default 2h). */
export const ACCESS_TOKEN_MAX_AGE_SEC =
  (Number(process.env.ACCESS_TOKEN_EXPIRE_MINUTES) || 120) * 60;

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}
