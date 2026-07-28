import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { PUBLIC_SITE_ORIGIN } from "../../../../lib/public-site-url";
import { authorizeTenant, isSameOrigin } from "../../../../lib/api-auth";
import { hashToken, requestFingerprint } from "../../../../lib/auth";

const schema = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(["TEACHER_ADMIN", "TEACHER_EDITOR", "SUPPORT_STAFF"]) });

export async function POST(request: Request) {
  const auth = await authorizeTenant("staff.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "تحقق من البريد والدور" }, { status: 400 });
  const tenantId = auth.context.membership.tenantId;
  const existing = await prisma.user.findFirst({ where: { email: parsed.data.email, memberships: { some: { tenantId } } }, select: { id: true } });
  if (existing) return NextResponse.json({ ok: false, message: "هذا المستخدم عضو بالفعل" }, { status: 409 });
  await prisma.staffInvitation.updateMany({ where: { tenantId, email: parsed.data.email, status: "PENDING" }, data: { status: "REVOKED" } });
  const rawToken = randomBytes(32).toString("base64url");
  const { ipHash } = await requestFingerprint();
  const invitation = await prisma.$transaction(async (tx) => {
    const created = await tx.staffInvitation.create({ data: { tenantId, email: parsed.data.email, role: parsed.data.role, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), createdById: auth.context.user.id } });
    await tx.auditLog.create({ data: { tenantId, actorId: auth.context.user.id, action: "STAFF_INVITED", entityType: "StaffInvitation", entityId: created.id, metadata: { email: parsed.data.email, role: parsed.data.role }, ipHash } });
    return created;
  });
  if (process.env.NODE_ENV === "development") {
    const baseUrl = PUBLIC_SITE_ORIGIN;
    console.info(`Staff invitation URL: ${baseUrl}/staff-invite/${rawToken}`);
  }
  return NextResponse.json({ ok: true, invitation: { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt } }, { status: 201 });
}
