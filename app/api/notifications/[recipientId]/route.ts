import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { isSameOrigin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ action: z.enum(["READ", "UNREAD", "ARCHIVE"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ recipientId: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const auth = await getAuthContext();
  if (!auth?.membership) return NextResponse.json({ ok: false, message: "غير مصرح" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "إجراء غير صالح" }, { status: 400 });
  const { recipientId } = await params;
  const now = new Date();
  const result = await prisma.notificationRecipient.updateMany({
    where: { id: recipientId, tenantId: auth.membership.tenantId, userId: auth.user.id },
    data: parsed.data.action === "READ"
      ? { isRead: true, isSeen: true, readAt: now, seenAt: now }
      : parsed.data.action === "UNREAD"
        ? { isRead: false, readAt: null }
        : { isArchived: true, archivedAt: now },
  });
  if (!result.count) return NextResponse.json({ ok: false, message: "الإشعار غير موجود" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
