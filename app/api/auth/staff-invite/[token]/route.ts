import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "../../../../../lib/api-auth";
import { createSession, hashToken, requestFingerprint } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

const schema = z.object({ email: z.string().trim().toLowerCase().email(), fullName: z.string().trim().min(3).max(100), username: z.string().trim().toLowerCase().regex(/^[a-zA-Z0-9_]{3,30}$/), phone: z.string().trim().regex(/^01[0125][0-9]{8}$/), password: z.string().min(10).max(128), confirmPassword: z.string() }).refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "كلمتا المرور غير متطابقتين" });

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "تحقق من البيانات المدخلة" }, { status: 400 });
  const { token } = await params;
  const invitation = await prisma.staffInvitation.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= new Date() || invitation.email !== parsed.data.email) return NextResponse.json({ ok: false, message: "الدعوة غير صالحة أو انتهت" }, { status: 410 });
  const existing = await prisma.user.findFirst({ where: { OR: [{ email: invitation.email }, { username: parsed.data.username }, { phone: parsed.data.phone }] }, select: { id: true } });
  if (existing) return NextResponse.json({ ok: false, message: "يوجد حساب بهذه البيانات. تواصل مع مالك المنصة لربطه بأمان." }, { status: 409 });
  const passwordHash = await hash(parsed.data.password, 12);
  const { ipHash } = await requestFingerprint();
  try {
    const user = await prisma.$transaction(async (tx) => {
      const claimed = await tx.staffInvitation.updateMany({ where: { id: invitation.id, status: "PENDING", expiresAt: { gt: new Date() } }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
      if (claimed.count !== 1) throw new Error("INVITATION_ALREADY_USED");
      const created = await tx.user.create({ data: { fullName: parsed.data.fullName, username: parsed.data.username, email: invitation.email, phone: parsed.data.phone, passwordHash, role: invitation.role, status: "ACTIVE", memberships: { create: { tenantId: invitation.tenantId, role: invitation.role, status: "ACTIVE", permissions: invitation.permissions ?? undefined } } } });
      await tx.auditLog.create({ data: { tenantId: invitation.tenantId, actorId: created.id, action: "STAFF_INVITATION_ACCEPTED", entityType: "StaffInvitation", entityId: invitation.id, metadata: { role: invitation.role }, ipHash } });
      return created;
    });
    await createSession(user.id, false, invitation.tenantId);
    return NextResponse.json({ ok: true, redirectTo: "/teacher" }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INVITATION_ALREADY_USED") return NextResponse.json({ ok: false, message: "تم استخدام الدعوة بالفعل" }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ ok: false, message: "اسم المستخدم أو الهاتف مستخدم بالفعل" }, { status: 409 });
    throw error;
  }
}