import { NextResponse } from "next/server";
import { getTenantContext, getAuthContext } from "./auth";
import { hasPermission, type Permission, tenantStaffRoles } from "./permissions";
import { subscriptionAllowsDashboard } from "./subscriptions";

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

export async function authorizeStudentSubscription() {
  const context = await getTenantContext();
  if (!context || context.user.role !== "STUDENT" || !context.membership) return { ok: false as const, response: NextResponse.json({ ok: false, message: "يجب تسجيل الدخول كطالب" }, { status: 401 }) };
  if (context.blocked) return { ok: false as const, response: NextResponse.json({ ok: false, message: "الأكاديمية متوقفة مؤقتًا حتى تجديد الاشتراك" }, { status: 403 }) };
  return { ok: true as const, context };
}
export async function authorizeTeacherSubscription() {
  const context = await getTenantContext();
  if (!context || !context.membership || !tenantStaffRoles.includes(context.user.role)) {
    return { ok: false as const, response: NextResponse.json({ ok: false, message: "يجب تسجيل الدخول بحساب مدرس" }, { status: 401 }) };
  }
  if (context.membership.role !== "TEACHER_OWNER" && context.membership.role !== "TEACHER_ADMIN") {
    return { ok: false as const, response: NextResponse.json({ ok: false, message: "إدارة الاشتراك متاحة لمالك الأكاديمية أو المدير فقط" }, { status: 403 }) };
  }
  const subscription = context.membership.tenant.subscriptions?.[0];
  if (context.blocked && (!subscription || subscriptionAllowsDashboard(subscription.status))) {
    return { ok: false as const, response: NextResponse.json({ ok: false, message: "المنصة موقوفة إداريًا" }, { status: 403 }) };
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
