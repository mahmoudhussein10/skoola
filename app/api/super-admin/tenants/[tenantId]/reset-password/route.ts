import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authorizeSuperAdmin, isSameOrigin } from "@/lib/api-auth";
import { requestFingerprint } from "@/lib/auth";

const schema = z.object({
  newPassword: z.string().min(6, "كلمة المرور لا تقل عن 6 أحرف"),
});

export async function POST(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });

  const { tenantId } = await params;
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "كلمة المرور يجب أن لا تقل عن 6 أحرف" }, { status: 400 });

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, ownerId: true } });
  if (!tenant || !tenant.ownerId) return NextResponse.json({ ok: false, message: "المنصة أو مالك الحساب غير موجود" }, { status: 404 });

  const passwordHash = await hash(parsed.data.newPassword, 12);
  const { ipHash } = await requestFingerprint();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: tenant.ownerId },
      data: { passwordHash },
    }),
    prisma.authSession.deleteMany({
      where: { userId: tenant.ownerId },
    }),
    prisma.auditLog.create({
      data: {
        tenantId,
        actorId: auth.context.user.id,
        action: "TEACHER_PASSWORD_RESET",
        entityType: "User",
        entityId: tenant.ownerId,
        ipHash,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, message: "تم إعادة تعيين كلمة المرور بنجاح وتسجيل الخروج من الجلسات السابقة" });
}
