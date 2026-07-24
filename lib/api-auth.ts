import { NextResponse } from "next/server";
import { getTenantContext, getAuthContext } from "./auth";
import { hasPermission, type Permission } from "./permissions";

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function authorizeTenant(permission: Permission) {
  const context = await getTenantContext();
  if (!context) {
    return { ok: false as const, response: NextResponse.json({ ok: false, message: "يجب تسجيل الدخول" }, { status: 401 }) };
  }
  if (context.blocked) {
    return { ok: false as const, response: NextResponse.json({ ok: false, message: "المنصة موقوفة مؤقتًا" }, { status: 403 }) };
  }
  if (!hasPermission(context.membership.role, permission, context.membership.permissions)) {
    return { ok: false as const, response: NextResponse.json({ ok: false, message: "ليس لديك صلاحية لهذا الإجراء" }, { status: 403 }) };
  }
  return { ok: true as const, context };
}

export async function authorizeSuperAdmin() {
  const context = await getAuthContext();
  if (!context || (context.user.role !== "SUPER_ADMIN" && context.user.role !== "ADMIN")) {
    return { ok: false as const, response: NextResponse.json({ ok: false, message: "غير مصرح" }, { status: 403 }) };
  }
  return { ok: true as const, context };
}
