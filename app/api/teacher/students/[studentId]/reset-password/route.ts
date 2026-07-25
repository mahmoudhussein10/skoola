import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { authorizeTenant, isSameOrigin } from "../../../../../../lib/api-auth";
import { requestFingerprint } from "../../../../../../lib/auth";

export async function POST(request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = await authorizeTenant("students.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });

  const { studentId } = await params;
  const tenantId = auth.context.membership.tenantId;
  const student = await prisma.tenantMember.findFirst({
    where: { tenantId, userId: studentId, role: "STUDENT", status: "ACTIVE" },
    select: { userId: true, user: { select: { fullName: true } } },
  });
  if (!student) return NextResponse.json({ ok: false, message: "الطالب غير موجود داخل أكاديميتك أو حسابه غير نشط" }, { status: 404 });

  const temporaryPassword = `Sk@${randomBytes(9).toString("base64url")}`;
  const passwordHash = await hash(temporaryPassword, 12);
  const { ipHash } = await requestFingerprint();

  await prisma.$transaction([
    prisma.user.update({ where: { id: student.userId }, data: { passwordHash } }),
    prisma.authSession.deleteMany({ where: { userId: student.userId } }),
    prisma.auditLog.create({
      data: {
        tenantId,
        actorId: auth.context.user.id,
        action: "STUDENT_PASSWORD_RESET",
        entityType: "User",
        entityId: student.userId,
        metadata: { studentName: student.user.fullName, sessionsRevoked: true },
        ipHash,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    temporaryPassword,
    message: "تم إنشاء كلمة مرور جديدة وتسجيل خروج الطالب من جميع الجلسات القديمة.",
  });
}
