import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import type { UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { hasPermission, type Permission, tenantStaffRoles } from "./permissions";
import { subscriptionAllowsDashboard, syncTenantSubscriptionState } from "./subscriptions";

export const SESSION_COOKIE = "chemistry_session";
export const SUPPORT_COOKIE = "chemistry_support";

export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function startSupportMode(actorUserId: string, tenantId: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, status: { not: "ARCHIVED" } },
    select: { id: true },
  });
  if (!tenant) return false;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const { ipHash } = await requestFingerprint();
  await prisma.$transaction(async (tx) => {
    await tx.supportSession.updateMany({
      where: { actorUserId, endedAt: null },
      data: { endedAt: new Date() },
    });
    await tx.supportSession.create({
      data: { actorUserId, tenantId, tokenHash: hashToken(token), expiresAt },
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: actorUserId,
        action: "SUPPORT_MODE_STARTED",
        entityType: "Tenant",
        entityId: tenantId,
        metadata: { expiresAt: expiresAt.toISOString(), readOnly: true },
        ipHash,
      },
    });
  });

  const jar = await cookies();
  jar.set(SUPPORT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 60,
  });
  return true;
}

export async function clearSupportMode() {
  const jar = await cookies();
  const token = jar.get(SUPPORT_COOKIE)?.value;
  if (token) {
    const support = await prisma.supportSession.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, actorUserId: true, tenantId: true, endedAt: true },
    });
    if (support && !support.endedAt) {
      await prisma.$transaction([
        prisma.supportSession.update({ where: { id: support.id }, data: { endedAt: new Date() } }),
        prisma.auditLog.create({
          data: {
            tenantId: support.tenantId,
            actorId: support.actorUserId,
            action: "SUPPORT_MODE_ENDED",
            entityType: "Tenant",
            entityId: support.tenantId,
          },
        }),
      ]);
    }
  }
  jar.delete(SUPPORT_COOKIE);
}
export async function requestFingerprint() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const agent = h.get("user-agent") ?? "unknown";
  return {
    ipHash: hashToken(`${process.env.AUTH_SECRET}:${forwarded}`),
    deviceId: hashToken(agent).slice(0, 32),
    userAgent: agent.slice(0, 500),
  };
}

export function homeForRole(role: UserRole) {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return "/super-admin";
  if (tenantStaffRoles.includes(role)) return "/teacher";
  return "/dashboard";
}

export async function createSession(userId: string, _remember = true, tenantId?: string) {
  void _remember;
  const token = randomBytes(32).toString("base64url");
  const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  const isStudent = targetUser?.role === "STUDENT";

  // Student: 7 days rolling inactivity window (604800s). Teacher/Admin: 365 days persistent session.
  const maxAge = isStudent ? 7 * 24 * 60 * 60 : 365 * 24 * 60 * 60;
  const { deviceId, ipHash, userAgent } = await requestFingerprint();
  const settings = await prisma.platformSettings.upsert({ where: { id: "default" }, update: {}, create: {} });
  const membership = tenantId ? await prisma.tenantMember.findFirst({
    where: { userId, tenantId, status: "ACTIVE" },
    select: { tenantId: true },
  }) : null;

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.authSession.deleteMany({ where: { userId, expiresAt: { lte: now } } });
    const liveDeviceSessions = await tx.authSession.findMany({
      where: { userId, expiresAt: { gt: now } },
      select: { deviceId: true },
      distinct: ["deviceId"],
    });
    const liveDeviceIds = liveDeviceSessions.map((session) => session.deviceId);
    await tx.deviceSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(liveDeviceIds.length ? { deviceId: { notIn: liveDeviceIds } } : {}),
      },
      data: { revokedAt: now },
    });

    const knownDevice = await tx.deviceSession.findUnique({ where: { userId_deviceId: { userId, deviceId } } });
    const activeDevices = isStudent
      ? await tx.deviceSession.count({ where: { userId, revokedAt: null } })
      : 0;
    const currentDeviceIsActive = knownDevice?.revokedAt === null;
    if (isStudent && !currentDeviceIsActive && activeDevices >= settings.maxDevicesPerStudent) {
      throw new Error("DEVICE_LIMIT");
    }
    await tx.deviceSession.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      update: { userAgent, ipHash, lastActiveAt: new Date(), revokedAt: null },
      create: { userId, deviceId, userAgent, ipHash },
    });
    await tx.authSession.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        deviceId,
        activeTenantId: membership?.tenantId,
        expiresAt: new Date(Date.now() + maxAge * 1000),
      },
    });
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function getAuthContext() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          avatarUrl: true,
          lastLoginAt: true,
          memberships: {
            where: { status: "ACTIVE" },
            include: { tenant: { include: { theme: true, settings: true, subscriptions: { select: { status: true, trialEndsAt: true, currentPeriodEnd: true, gracePeriodEndsAt: true } } } } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") return null;

  // Student rolling inactivity window renewal (renew for another 7 days upon valid activity)
  if (session.user.role === "STUDENT") {
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (session.lastActiveAt < fiveMinsAgo) {
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      prisma.authSession.update({
        where: { id: session.id },
        data: { expiresAt: newExpiresAt, lastActiveAt: new Date() },
      }).catch(() => {});
    }
  }

  const membership =
    session.user.memberships.find((item) => item.tenantId === session.activeTenantId) ??
    (session.user.memberships.length === 1 ? session.user.memberships[0] : null);
  return { session, user: session.user, membership };
}

export async function currentUser() {
  return (await getAuthContext())?.user ?? null;
}

export async function requireUser(roles?: UserRole | UserRole[]) {
  const context = await getAuthContext();
  if (!context) redirect("/login");
  const allowed = roles ? (Array.isArray(roles) ? roles : [roles]) : null;
  if (allowed && !allowed.includes(context.user.role)) redirect(homeForRole(context.user.role));
  return context.user;
}

export async function getTenantContext() {
  const context = await getAuthContext();
  if (!context) return null;
  if (context.membership) {
    let membership = context.membership;
    if (tenantStaffRoles.includes(context.user.role)) {
      const synced = await syncTenantSubscriptionState(membership.tenantId);
      if (synced) membership = { ...membership, tenant: { ...membership.tenant, status: synced.tenantStatus, subscriptions: membership.tenant.subscriptions.map((item, index) => index === 0 ? { ...item, status: synced.effectiveStatus } : item) } };
    }
    if (membership.tenant.status === "SUSPENDED" || membership.tenant.status === "DISABLED") {
      return { ...context, membership, blocked: true as const, supportMode: false as const };
    }
    return { ...context, membership, blocked: false as const, supportMode: false as const };
  }

  if (context.user.role !== "SUPER_ADMIN" && context.user.role !== "ADMIN") return null;
  const supportToken = (await cookies()).get(SUPPORT_COOKIE)?.value;
  if (!supportToken) return null;
  const support = await prisma.supportSession.findUnique({
    where: { tokenHash: hashToken(supportToken) },
    include: { tenant: { include: { theme: true, settings: true, subscriptions: { select: { status: true, trialEndsAt: true, currentPeriodEnd: true, gracePeriodEndsAt: true } } } } },
  });
  if (!support || support.actorUserId !== context.user.id || support.endedAt || support.expiresAt <= new Date()) return null;

  const membership = {
    id: `support:${support.id}`,
    tenantId: support.tenantId,
    userId: context.user.id,
    role: "SUPPORT_STAFF" as const,
    status: "ACTIVE" as const,
    permissions: ["analytics.view", "audit.view"],
    createdAt: support.createdAt,
    updatedAt: support.createdAt,
    tenant: support.tenant,
  };
  return { ...context, membership, blocked: false as const, supportMode: true as const };
}

export async function requireTenantMember(roles?: UserRole | UserRole[]) {
  const context = await getTenantContext();
  if (!context) redirect("/login");
  if (context.blocked) {
    const subscription = context.membership.tenant.subscriptions?.[0];
    if (tenantStaffRoles.includes(context.user.role) && subscription && !subscriptionAllowsDashboard(subscription.status)) redirect("/teacher/subscription");
    redirect("/tenant-unavailable");
  }
  const allowed = roles ? (Array.isArray(roles) ? roles : [roles]) : null;
  if (allowed && !allowed.includes(context.membership.role)) redirect(homeForRole(context.user.role));
  return context;
}

export async function requireTeacherSubscriptionContext(roles?: UserRole | UserRole[]) {
  const context = await getTenantContext();
  if (!context || !tenantStaffRoles.includes(context.user.role)) redirect("/login?role=teacher");
  const allowed = roles ? (Array.isArray(roles) ? roles : [roles]) : null;
  if (allowed && !allowed.includes(context.membership.role)) redirect(homeForRole(context.user.role));
  const subscription = context.membership.tenant.subscriptions?.[0];
  if (context.blocked && (!subscription || subscriptionAllowsDashboard(subscription.status))) redirect("/tenant-unavailable");
  return context;
}
export async function requireTenantRole(roles: UserRole | UserRole[]) {
  return requireTenantMember(roles);
}

export async function getCurrentTenant() {
  return (await requireTenantMember()).membership.tenant;
}
export async function requireSuperAdmin() {
  const user = await requireUser(["SUPER_ADMIN", "ADMIN"]);
  return user;
}

export async function requirePermission(permission: Permission) {
  const context = await requireTenantMember();
  if (!hasPermission(context.membership.role, permission, context.membership.permissions)) {
    redirect("/teacher?denied=1");
  }
  return context;
}

export async function clearSession() {
  await clearSupportMode();
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    const session = await prisma.authSession.findUnique({
      where: { tokenHash },
      select: { userId: true, deviceId: true },
    });
    if (session) {
      await prisma.$transaction(async (tx) => {
        await tx.authSession.deleteMany({ where: { tokenHash } });
        const otherLiveSessions = await tx.authSession.count({
          where: {
            userId: session.userId,
            deviceId: session.deviceId,
            expiresAt: { gt: new Date() },
          },
        });
        if (otherLiveSessions === 0) {
          await tx.deviceSession.updateMany({
            where: { userId: session.userId, deviceId: session.deviceId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      });
    }
  }
  jar.delete(SESSION_COOKIE);
}
