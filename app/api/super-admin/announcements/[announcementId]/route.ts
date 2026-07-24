import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeSuperAdmin, isSameOrigin } from "../../../../../lib/api-auth";
import { requestFingerprint } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ announcementId: string }> }) {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const parsed = z.object({ active: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "حالة غير صحيحة" }, { status: 400 });
  const { announcementId } = await params;
  const before = await prisma.systemAnnouncement.findUnique({ where: { id: announcementId }, select: { id: true, active: true } });
  if (!before) return NextResponse.json({ ok: false, message: "الإعلان غير موجود" }, { status: 404 });
  const { ipHash } = await requestFingerprint();
  await prisma.$transaction([
    prisma.systemAnnouncement.update({ where: { id: announcementId }, data: { active: parsed.data.active } }),
    prisma.auditLog.create({ data: { actorId: auth.context.user.id, action: "ANNOUNCEMENT_STATUS_CHANGED", entityType: "SystemAnnouncement", entityId: announcementId, before, after: { active: parsed.data.active }, ipHash } }),
  ]);
  return NextResponse.json({ ok: true });
}