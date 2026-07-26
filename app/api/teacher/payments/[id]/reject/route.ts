import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "../../../../../../lib/prisma";
import { authorizeTenant, isSameOrigin } from "../../../../../../lib/api-auth";
import { requestFingerprint } from "../../../../../../lib/auth";
import { notifyPaymentDecision } from "../../../../../../lib/notifications/events";

const schema = z.object({
  reason: z.string().trim().max(300).optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeTenant("students.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  }

  const { id: paymentId } = await params;
  const tenantId = auth.context.membership.tenantId;

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  const rejectionReason = parsed.success && parsed.data.reason ? parsed.data.reason : "تعذر التأكد من عملية التحويل";

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, tenantId },
    include: { course: { select: { title: true } }, student: { select: { fullName: true } } },
  });

  if (!payment) {
    return NextResponse.json({ ok: false, message: "طلب الدفع غير موجود" }, { status: 404 });
  }

  const { ipHash } = await requestFingerprint();

  await prisma.$transaction(async (tx) => {
    // 1. Update Payment status
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "REJECTED",
        rejectionReason,
        reviewedById: auth.context.user.id,
        reviewedAt: new Date(),
        notificationVersion: { increment: 1 },
      },
    });

    // 2. Create Notification for student
    // 3. Create Audit Log
    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: auth.context.user.id,
        action: "PAYMENT_REJECTED",
        entityType: "Payment",
        entityId: payment.id,
        after: { studentId: payment.studentId, courseId: payment.courseId, reason: rejectionReason },
        ipHash,
      },
    });
  });

  await notifyPaymentDecision({ tenantId, studentId: payment.studentId, paymentId: payment.id, version: payment.notificationVersion + 1, approved: false, courseId: payment.courseId }).catch(() => undefined);

  revalidatePath("/teacher/payments");
  revalidatePath("/dashboard");

  return NextResponse.json({ ok: true, message: "تم رفض طلب الدفع وإخطار الطالب" });
}
