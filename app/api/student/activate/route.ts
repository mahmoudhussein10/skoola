import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "../../../../lib/api-auth";
import { getAuthContext, hashToken } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

const schema = z.object({ code: z.string().trim().toUpperCase().min(4).max(40) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  }

  const auth = await getAuthContext();
  if (!auth || !auth.membership) {
    return NextResponse.json({ ok: false, message: "يرجى تسجيل الدخول أولاً لتفعيل الكود" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "أدخل كود التفعيل بشكل صحيح" }, { status: 400 });
  }

  const tenantId = auth.membership.tenantId;
  const rawCode = parsed.data.code;
  const codeHash = hashToken(rawCode);

  const code = await prisma.activationCode.findFirst({
    where: { tenantId, codeHash },
    include: { course: { select: { id: true, title: true, status: true } } },
  });

  if (!code || code.status !== "ACTIVE" || (code.expiresAt && code.expiresAt <= new Date()) || code.usedCount >= code.maxUses) {
    return NextResponse.json({ ok: false, message: "كود التفعيل غير صحيح أو مستخدم أو انتهت صلاحيته" }, { status: 404 });
  }

  if (!code.course || code.course.status !== "PUBLISHED") {
    return NextResponse.json({ ok: false, message: "هذا الكود غير مرتبط بكورس منشور حاليًا" }, { status: 409 });
  }

  // Activate Course Enrollment for any authenticated user (Student or Teacher)
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.enrollment.findUnique({
      where: {
        tenantId_studentId_courseId: {
          tenantId,
          studentId: auth.user.id,
          courseId: code.course!.id,
        },
      },
    });

    if (existing?.status === "ACTIVE" || existing?.status === "COMPLETED") {
      return { enrollment: existing, alreadyActive: true };
    }

    const consumed = await tx.activationCode.updateMany({
      where: { id: code.id, tenantId, status: "ACTIVE", usedCount: { lt: code.maxUses } },
      data: {
        usedCount: { increment: 1 },
        status: code.usedCount + 1 >= code.maxUses ? "EXHAUSTED" : "ACTIVE",
      },
    });

    if (consumed.count !== 1) throw new Error("ACTIVATION_CODE_CONSUMED");

    const enrollment = existing
      ? await tx.enrollment.update({ where: { id: existing.id }, data: { status: "ACTIVE", expiresAt: null } })
      : await tx.enrollment.create({
          data: {
            tenantId,
            studentId: auth.user.id,
            courseId: code.course!.id,
            status: "ACTIVE",
          },
        });

    await tx.activityLog.create({
      data: {
        tenantId,
        actorId: auth.user.id,
        action: "تفعيل اشتراك بكود",
        entityType: "Course",
        entityId: code.course!.id,
      },
    });

    return { enrollment, alreadyActive: false };
  }).catch((error) => {
    if (error instanceof Error && error.message === "ACTIVATION_CODE_CONSUMED") return null;
    throw error;
  });

  if (!result) {
    return NextResponse.json({ ok: false, message: "تم استخدام الكود للتو. اطلب كودًا جديدًا" }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    alreadyActive: result.alreadyActive,
    courseTitle: code.course.title,
    courseId: code.course.id,
  });
}
