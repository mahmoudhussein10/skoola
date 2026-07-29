import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { createSession, homeForRole, requestFingerprint } from "../../../../lib/auth";
import { loginSchema } from "../../../../lib/validation";
import { isSameOrigin } from "../../../../lib/api-auth";
import { tenantStaffRoles } from "../../../../lib/permissions";
import { subscriptionAllowsDashboard, syncTenantSubscriptionState } from "../../../../lib/subscriptions";

const GENERIC_ERROR = "بيانات الدخول غير صحيحة";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const portal = body && typeof body === "object" && "portal" in body ? body.portal : undefined;
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "تحقق من البيانات المدخلة" }, { status: 400 });

  const identifier = parsed.data.identifier.toLowerCase();
  const { ipHash } = await requestFingerprint();
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const failures = await prisma.loginAttempt.count({ where: { ipHash, successful: false, createdAt: { gte: since } } });
  if (failures >= 8) return NextResponse.json({ ok: false, message: "محاولات كثيرة. حاول مرة أخرى بعد 15 دقيقة" }, { status: 429 });

  const platform = await prisma.platformSettings.upsert({ where: { id: "default" }, update: {}, create: {} });
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }, { phone: parsed.data.identifier }] },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        include: { tenant: { select: { id: true, slug: true, status: true, subscriptions: { select: { status: true, trialEndsAt: true, currentPeriodEnd: true, gracePeriodEndsAt: true } } } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  const valid = user ? await compare(parsed.data.password, user.passwordHash) : false;
  await prisma.loginAttempt.create({ data: { identifier, ipHash, successful: Boolean(valid), userId: user?.id } });

  if (!user || !valid) return NextResponse.json({ ok: false, message: GENERIC_ERROR }, { status: 401 });
  if (portal === "student" && user.role !== "STUDENT") return NextResponse.json({ ok: false, message: "هذا الحساب ليس حساب طالب. استخدم بوابة الدخول المناسبة لنوع حسابك." }, { status: 403 });
  if (portal === "teacher" && !tenantStaffRoles.includes(user.role)) return NextResponse.json({ ok: false, message: "هذا الحساب ليس حساب مدرس. استخدم بوابة الدخول المناسبة لنوع حسابك." }, { status: 403 });
  if (portal === "super-admin" && user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") return NextResponse.json({ ok: false, message: "هذا الحساب غير مصرح له بدخول الإدارة العليا." }, { status: 403 });
  if (platform.maintenanceMode && user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") return NextResponse.json({ ok: false, message: "المنصة في وضع الصيانة مؤقتًا" }, { status: 503 });
  if (user.status === "SUSPENDED") return NextResponse.json({ ok: false, message: "الحساب موقوف. تواصل مع الدعم" }, { status: 403 });
  if (user.status !== "ACTIVE") return NextResponse.json({ ok: false, message: "الحساب قيد المراجعة" }, { status: 403 });

  let activeTenantId: string | undefined = undefined;

  if (user.role === "STUDENT") {
    const syncedStudents = await Promise.all(user.memberships.map((membership) => syncTenantSubscriptionState(membership.tenantId)));
    const studentMembership = user.memberships.find((membership, index) => {
      const tenantStatus = syncedStudents[index]?.tenantStatus ?? membership.tenant.status;
      return (!parsed.data.tenantSlug || membership.tenant.slug === parsed.data.tenantSlug) && tenantStatus !== "SUSPENDED" && tenantStatus !== "DISABLED" && tenantStatus !== "ARCHIVED";
    });
    if (!studentMembership) {
      return NextResponse.json({ ok: false, message: "حساب الطالب غير مرتبط بمدرس نشط حاليًا" }, { status: 403 });
    }
    activeTenantId = studentMembership.tenantId;
  } else if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
    const syncedSubscriptions = await Promise.all(user.memberships.map((membership) => syncTenantSubscriptionState(membership.tenantId)));
    const availableMemberships = user.memberships.filter((membership, index) => {
      const synced = syncedSubscriptions[index];
      const tenantStatus = synced?.tenantStatus ?? membership.tenant.status;
      const subscriptionStatus = synced?.effectiveStatus ?? membership.tenant.subscriptions[0]?.status;
      const subscriptionLocked = Boolean(subscriptionStatus && !subscriptionAllowsDashboard(subscriptionStatus));
      return tenantStatus !== "DISABLED" && tenantStatus !== "ARCHIVED" && (tenantStatus !== "SUSPENDED" || subscriptionLocked);
    });
    const staffMembership = parsed.data.tenantSlug
      ? availableMemberships.find((membership) => membership.tenant.slug === parsed.data.tenantSlug)
      : availableMemberships.length === 1 ? availableMemberships[0] : null;
    if (!staffMembership) {
      return NextResponse.json({ ok: false, message: "الحساب مرتبط بأكثر من منصة. سجّل الدخول من رابط المنصة المطلوبة." }, { status: 409 });
    }
    activeTenantId = staffMembership.tenantId;
  }

  try {
    await createSession(user.id, parsed.data.remember, activeTenantId);
  } catch (error) {
    if (error instanceof Error && error.message === "DEVICE_LIMIT") {
      return NextResponse.json({ ok: false, message: "تم الوصول للحد الأقصى للأجهزة. ألغِ جهازًا قديمًا أولًا" }, { status: 403 });
    }
    throw error;
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const redirectTo = user.role === "STUDENT" ? "/dashboard" : homeForRole(user.role);
  return NextResponse.json({ ok: true, redirectTo });
}
