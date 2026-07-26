import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { isSameOrigin } from "@/lib/api-auth";
import { normalizeInternalNotificationUrl } from "@/lib/notifications/security";
import { prisma } from "@/lib/prisma";

const markAllSchema = z.object({ action: z.literal("MARK_ALL_READ") });

async function inboxContext() {
  const auth = await getAuthContext();
  return auth?.membership && auth.user.status === "ACTIVE" && auth.membership.status === "ACTIVE" ? auth : null;
}

export async function GET(request: Request) {
  const auth = await inboxContext();
  if (!auth) return NextResponse.json({ ok: false, message: "غير مصرح" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const filter = params.get("filter") === "unread" ? "unread" : "all";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 20, 1), 50);
  const cursor = params.get("cursor");
  const tenantId = auth.membership!.tenantId;

  const where = {
    tenantId,
    userId: auth.user.id,
    isArchived: false,
    ...(filter === "unread" ? { isRead: false } : {}),
  };
  const [rows, unreadCount] = await Promise.all([
    prisma.notificationRecipient.findMany({
      where,
      include: {
        notification: {
          select: { id: true, type: true, category: true, title: true, message: true, link: true, priority: true, createdAt: true },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.notificationRecipient.count({ where: { tenantId, userId: auth.user.id, isArchived: false, isRead: false } }),
  ]);
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((row) => ({
    id: row.id,
    isRead: row.isRead,
    isSeen: row.isSeen,
    createdAt: row.createdAt.toISOString(),
    notification: {
      ...row.notification,
      link: normalizeInternalNotificationUrl(row.notification.link, auth.user.role === "STUDENT" ? "/dashboard" : "/teacher"),
      createdAt: row.notification.createdAt.toISOString(),
    },
  }));

  return NextResponse.json({
    ok: true,
    items,
    unreadCount,
    nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const auth = await inboxContext();
  if (!auth) return NextResponse.json({ ok: false, message: "غير مصرح" }, { status: 401 });
  const parsed = markAllSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "إجراء غير صالح" }, { status: 400 });
  const now = new Date();
  await prisma.notificationRecipient.updateMany({
    where: { tenantId: auth.membership!.tenantId, userId: auth.user.id, isArchived: false, isRead: false },
    data: { isRead: true, isSeen: true, readAt: now, seenAt: now },
  });
  return NextResponse.json({ ok: true });
}
