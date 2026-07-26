import "server-only";

import { NotificationCategory, NotificationPriority, Prisma, UserRole } from "@prisma/client";
import { firebaseAdminMessaging } from "@/lib/firebase/admin";
import { isInvalidFirebaseTokenCode, normalizeInternalNotificationUrl, safeFirebaseErrorCode } from "@/lib/notifications/security";
import { prisma } from "@/lib/prisma";

const STAFF_ROLES: UserRole[] = ["TEACHER_OWNER", "TEACHER_ADMIN", "TEACHER_EDITOR", "SUPPORT_STAFF"];
export type NotificationAudience =
  | { kind: "USER"; userId: string }
  | { kind: "USERS"; userIds: string[] }
  | { kind: "ACADEMY_STUDENTS" }
  | { kind: "ACADEMY_STAFF" }
  | { kind: "COURSE_STUDENTS"; courseId: string };
export type CreateNotificationInput = {
  tenantId: string; audience: NotificationAudience; type: string; category: NotificationCategory;
  title: string; message: string; link?: string | null; priority?: NotificationPriority;
  source?: string; createdById?: string | null; metadata?: Prisma.InputJsonValue; idempotencyKey?: string;
};

async function audienceUserIds(tenantId: string, audience: NotificationAudience) {
  if (audience.kind === "COURSE_STUDENTS") {
    const rows = await prisma.enrollment.findMany({
      where: { tenantId, courseId: audience.courseId, status: "ACTIVE", student: { status: "ACTIVE", memberships: { some: { tenantId, status: "ACTIVE" } } } },
      select: { studentId: true }, distinct: ["studentId"],
    });
    return rows.map((row) => row.studentId);
  }
  const ids = audience.kind === "USER" ? [audience.userId] : audience.kind === "USERS" ? [...new Set(audience.userIds)] : undefined;
  const roles = audience.kind === "ACADEMY_STUDENTS" ? (["STUDENT"] satisfies UserRole[]) : audience.kind === "ACADEMY_STAFF" ? STAFF_ROLES : undefined;
  const rows = await prisma.tenantMember.findMany({
    where: { tenantId, status: "ACTIVE", ...(ids ? { userId: { in: ids } } : {}), ...(roles ? { role: { in: roles } } : {}), user: { status: "ACTIVE" } },
    select: { userId: true }, distinct: ["userId"],
  });
  return rows.map((row) => row.userId);
}
function batches<T>(values: T[], size = 500) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

export async function createNotification(input: CreateNotificationInput) {
  const userIds = await audienceUserIds(input.tenantId, input.audience);
  if (!userIds.length) return { notificationId: null, recipientCount: 0, pushSent: 0 };
  let notification = input.idempotencyKey ? await prisma.notification.findUnique({
    where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey } }, select: { id: true },
  }) : null;
  let created = false;
  if (!notification) {
    try {
      notification = await prisma.notification.create({
        data: {
          tenantId: input.tenantId, type: input.type.slice(0, 100), category: input.category,
          title: input.title.trim().slice(0, 120), message: input.message.trim().slice(0, 600),
          link: normalizeInternalNotificationUrl(input.link, "/dashboard"), priority: input.priority ?? "NORMAL",
          source: (input.source ?? "SYSTEM").slice(0, 60), createdById: input.createdById ?? null,
          metadata: input.metadata, idempotencyKey: input.idempotencyKey,
        }, select: { id: true },
      });
      created = true;
    } catch (error) {
      if (!input.idempotencyKey || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      notification = await prisma.notification.findUniqueOrThrow({
        where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey } }, select: { id: true },
      });
    }
  }
  if (!created) {
    const recipientCount = await prisma.notificationRecipient.count({ where: { notificationId: notification.id } });
    return { notificationId: notification.id, recipientCount, pushSent: 0, duplicate: true };
  }
  await prisma.notificationRecipient.createMany({
    data: userIds.map((userId) => ({ notificationId: notification!.id, tenantId: input.tenantId, userId })), skipDuplicates: true,
  });
  const recipients = await prisma.notificationRecipient.findMany({ where: { notificationId: notification.id }, select: { id: true, userId: true } });
  const prefs = await prisma.notificationPreference.findMany({
    where: { tenantId: input.tenantId, userId: { in: userIds }, category: input.category }, select: { userId: true, inApp: true, push: true },
  });
  const pref = new Map(prefs.map((row) => [row.userId, row]));
  await prisma.notificationDelivery.createMany({
    data: recipients.map((row) => {
      const disabled = pref.get(row.userId)?.inApp === false;
      return { notificationId: notification!.id, recipientId: row.id, tenantId: input.tenantId, userId: row.userId, channel: "IN_APP", status: disabled ? "SKIPPED" : "SENT", errorCode: disabled ? "PREFERENCE_DISABLED" : null, sentAt: disabled ? null : new Date() };
    }), skipDuplicates: true,
  });
  const hiddenIds = recipients.filter((row) => pref.get(row.userId)?.inApp === false).map((row) => row.id);
  if (hiddenIds.length) await prisma.notificationRecipient.updateMany({ where: { id: { in: hiddenIds } }, data: { isArchived: true, archivedAt: new Date() } });

  const pushRecipients = recipients.filter((row) => pref.get(row.userId)?.push !== false);
  const devices = pushRecipients.length ? await prisma.pushDevice.findMany({
    where: { tenantId: input.tenantId, userId: { in: pushRecipients.map((row) => row.userId) }, enabled: true, permissionState: "GRANTED", token: { not: null } },
    select: { id: true, userId: true, token: true }, take: 2000,
  }) : [];
  const recipientByUser = new Map(pushRecipients.map((row) => [row.userId, row.id]));
  const deliveries = devices.flatMap((device) => {
    const recipientId = recipientByUser.get(device.userId);
    return recipientId && device.token ? [{ notificationId: notification!.id, recipientId, tenantId: input.tenantId, userId: device.userId, deviceId: device.id, channel: "PUSH" as const }] : [];
  });
  if (deliveries.length) await prisma.notificationDelivery.createMany({ data: deliveries, skipDuplicates: true });
  const messaging = firebaseAdminMessaging();
  if (!messaging || !devices.length) {
    if (deliveries.length) await prisma.notificationDelivery.updateMany({
      where: { notificationId: notification.id, channel: "PUSH", status: "PENDING" },
      data: { status: "SKIPPED", errorCode: messaging ? "NO_ACTIVE_DEVICE" : "PROVIDER_NOT_CONFIGURED" },
    });
    return { notificationId: notification.id, recipientCount: recipients.length, pushSent: 0 };
  }

  let pushSent = 0;
  const link = normalizeInternalNotificationUrl(input.link, "/dashboard");
  for (const batch of batches(devices.filter((device) => device.token))) {
    const response = await messaging.sendEachForMulticast({
      tokens: batch.map((device) => device.token!), notification: { title: input.title.trim().slice(0, 120), body: input.message.trim().slice(0, 600) },
      data: { notificationId: notification.id, type: input.type.slice(0, 100), link }, webpush: { fcmOptions: { link } },
    }).catch((error: unknown) => ({ successCount: 0, responses: batch.map(() => ({ success: false as const, error })) }));
    pushSent += response.successCount;
    await Promise.all(response.responses.map(async (result, index) => {
      const device = batch[index]; if (!device) return;
      const code = result.success ? null : safeFirebaseErrorCode(result.error);
      await prisma.notificationDelivery.updateMany({
        where: { notificationId: notification!.id, deviceId: device.id, channel: "PUSH" },
        data: { status: result.success ? "SENT" : isInvalidFirebaseTokenCode(code!) ? "INVALID_TOKEN" : "FAILED", providerMessageId: result.success ? result.messageId : null, errorCode: code, attemptCount: { increment: 1 }, sentAt: result.success ? new Date() : null },
      });
      if (!result.success) await prisma.pushDevice.update({
        where: { id: device.id },
        data: { ...(isInvalidFirebaseTokenCode(code!) ? { enabled: false, token: null } : {}), lastFailureCode: code, lastFailureAt: new Date() },
      });
    }));
  }
  return { notificationId: notification.id, recipientCount: recipients.length, pushSent };
}

export async function sendTestPushToInstallation(input: { tenantId: string; userId: string; installationId: string }) {
  const device = await prisma.pushDevice.findFirst({
    where: { ...input, enabled: true, permissionState: "GRANTED", token: { not: null } }, select: { id: true, token: true },
  });
  if (!device?.token) return { ok: false as const, reason: "DEVICE_NOT_REGISTERED" as const };
  const messaging = firebaseAdminMessaging();
  if (!messaging) return { ok: false as const, reason: "PROVIDER_NOT_CONFIGURED" as const };
  try {
    await messaging.send({
      token: device.token,
      notification: { title: "إشعارات Skoola جاهزة 🔔", body: "هتوصلك هنا المحاضرات والامتحانات والتنبيهات المهمة." },
      data: { type: "TEST_PUSH", link: "/notifications" }, webpush: { fcmOptions: { link: "/notifications" } },
    });
    return { ok: true as const };
  } catch (error) {
    const reason = safeFirebaseErrorCode(error);
    await prisma.pushDevice.update({
      where: { id: device.id },
      data: { ...(isInvalidFirebaseTokenCode(reason) ? { enabled: false, token: null } : {}), lastFailureCode: reason, lastFailureAt: new Date() },
    });
    return { ok: false as const, reason };
  }
}
