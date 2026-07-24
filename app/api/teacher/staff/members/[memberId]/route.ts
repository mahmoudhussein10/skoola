import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeTenant, isSameOrigin } from "../../../../../../lib/api-auth";
import { requestFingerprint } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";

const schema = z.object({ role: z.enum(["TEACHER_ADMIN", "TEACHER_EDITOR", "SUPPORT_STAFF"]), status: z.enum(["ACTIVE", "SUSPENDED"]) });

async function targetMember(memberId: string, tenantId: string) {
  return prisma.tenantMember.findFirst({ where: { id: memberId, tenantId }, select: { id: true, userId: true, role: true, status: true } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const auth = await authorizeTenant("staff.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "الدور أو الحالة غير صحيح" }, { status: 400 });
  const { memberId } = await params;
  const tenantId = auth.context.membership.tenantId;
  const before = await targetMember(memberId, tenantId);
  if (!before) return NextResponse.json({ ok: false, message: "عضو الفريق غير موجود" }, { status: 404 });
  if (before.role === "TEACHER_OWNER" || before.userId === auth.context.user.id) return NextResponse.json({ ok: false, message: "لا يمكن تعديل المالك أو حسابك الحالي" }, { status: 403 });
  const { ipHash } = await requestFingerprint();
  await prisma.$transaction([
    prisma.tenantMember.update({ where: { id: memberId }, data: parsed.data }),
    prisma.auditLog.create({ data: { tenantId, actorId: auth.context.user.id, action: "STAFF_MEMBER_UPDATED", entityType: "TenantMember", entityId: memberId, before, after: parsed.data, ipHash } }),
  ]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const auth = await authorizeTenant("staff.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const { memberId } = await params;
  const tenantId = auth.context.membership.tenantId;
  const before = await targetMember(memberId, tenantId);
  if (!before) return NextResponse.json({ ok: false, message: "عضو الفريق غير موجود" }, { status: 404 });
  if (before.role === "TEACHER_OWNER" || before.userId === auth.context.user.id) return NextResponse.json({ ok: false, message: "لا يمكن إزالة المالك أو حسابك الحالي" }, { status: 403 });
  const { ipHash } = await requestFingerprint();
  await prisma.$transaction([
    prisma.tenantMember.update({ where: { id: memberId }, data: { status: "REVOKED" } }),
    prisma.authSession.deleteMany({ where: { userId: before.userId, activeTenantId: tenantId } }),
    prisma.auditLog.create({ data: { tenantId, actorId: auth.context.user.id, action: "STAFF_MEMBER_REVOKED", entityType: "TenantMember", entityId: memberId, before, after: { status: "REVOKED" }, ipHash } }),
  ]);
  return NextResponse.json({ ok: true });
}