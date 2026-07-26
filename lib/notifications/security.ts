import type { UserRole } from "@prisma/client";

const SAFE_PATH = /^\/(?:dashboard|teacher(?:\/|$)|course(?:\?|$)|t\/[a-z0-9-]+(?:\/|$))/i;

export const pushEligibleRoles: UserRole[] = [
  "STUDENT",
  "TEACHER_OWNER",
  "TEACHER_ADMIN",
  "TEACHER_EDITOR",
  "SUPPORT_STAFF",
];

export function isPushEligibleRole(role: UserRole) {
  return pushEligibleRoles.includes(role);
}

export function defaultDashboardForRole(role: UserRole) {
  return role === "STUDENT" ? "/dashboard" : "/teacher";
}

export function normalizeInternalNotificationUrl(value: unknown, fallback = "/dashboard") {
  if (typeof value !== "string" || value.length > 500 || !SAFE_PATH.test(value)) return fallback;
  try {
    const parsed = new URL(value, "https://skoola.local");
    if (parsed.origin !== "https://skoola.local") return fallback;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}

export function summarizeUserAgent(userAgent: string) {
  const value = userAgent.slice(0, 500);
  const browser = /Edg\//.test(value)
    ? "Edge"
    : /OPR\//.test(value)
      ? "Opera"
      : /CriOS|Chrome\//.test(value)
        ? "Chrome"
        : /FxiOS|Firefox\//.test(value)
          ? "Firefox"
          : /Safari\//.test(value)
            ? "Safari"
            : "Other";
  const platform = /iPhone|iPad|iPod/.test(value)
    ? "iOS"
    : /Android/.test(value)
      ? "Android"
      : /Windows/.test(value)
        ? "Windows"
        : /Macintosh|Mac OS X/.test(value)
          ? "macOS"
          : /Linux/.test(value)
            ? "Linux"
            : "Other";
  return { browser, platform, summary: `${browser} · ${platform}` };
}

export function safeFirebaseErrorCode(error: unknown) {
  const raw = typeof error === "object" && error && "code" in error ? String(error.code) : "push/unknown";
  const code = raw.toLowerCase();
  if (code.includes("registration-token-not-registered")) return "TOKEN_UNREGISTERED";
  if (code.includes("invalid-registration-token") || code.includes("invalid-argument")) return "TOKEN_INVALID";
  if (code.includes("messaging/credential") || code.includes("authentication")) return "PROVIDER_AUTH";
  if (code.includes("quota") || code.includes("rate")) return "PROVIDER_RATE_LIMIT";
  return "PROVIDER_FAILURE";
}

export function isInvalidFirebaseTokenCode(code: string) {
  return code === "TOKEN_UNREGISTERED" || code === "TOKEN_INVALID";
}
