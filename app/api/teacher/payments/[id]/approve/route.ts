import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "../../../../../../lib/prisma";
import { authorizeTenant, isSameOrigin } from "../../../../../../lib/api-auth";
import { requestFingerprint } from "../../../../../../lib/auth";

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

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, tenantId },
    include: { course: { select: { title: true } }, student: { select: { fullName: true } } },
  });

  if (!payment) {
    return NextResponse.json({ ok: false, message: "طلب الدفع غير موجود" }, { status: 404 });
  }

  if (payment.status === "APPROVED") {
    return NextResponse.json({ ok: false, message: "طلب الدفع مقبول بالفعل" }, { status: 400 });
  }

  const { ipHash } = await requestFingerprint();

  await prisma.$transaction(async (tx) => {
    // 1. Update Payment status
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "APPROVED",
        reviewedById: auth.context.user.id,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
    });

    // 2. Create or activate Enrollment
    await tx.enrollment.upsert({
      where: {
        tenantId_studentId_courseId: {
          tenantId,
          studentId: payment.studentId,
          courseId: payment.courseId,
        },
      },
      create: {
        tenantId,
        studentId: payment.studentId,
        courseId: payment.courseId,
        status: "ACTIVE",
      },
      update: {
        status: "ACTIVE",
      },
    });

    // 3. Create Notification for student
    await tx.notification.create({
      data: {
        tenantId,
        userId: payment.studentId,
        title: "تم قبول الاشتراك!",
        message: `تم قبول طلب دفعك لكورس "${payment.course.title}". يمكنك البدء في المشاهدة الآن!`,
        type: "PAYMENT_APPROVED",
        link: `/course?courseId=${payment.courseId}`,
      },
    });

    // 4. Create Audit Log
    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: auth.context.user.id,
        action: "PAYMENT_APPROVED",
        entityType: "Payment",
        entityId: payment.id,
        after: { studentId: payment.studentId, courseId: payment.courseId, amount: Number(payment.amount) },
        ipHash,
      },
    });

    await tx.activityLog.create({
      data: {
        tenantId,
        actorId: auth.context.user.id,
        action: `موافقة على دفع ${payment.student.fullName} لكورس ${payment.course.title}`,
        entityType: "Payment",
        entityId: payment.id,
      },
    });
  });

  revalidatePath("/teacher/payments");
  revalidatePath("/teacher/students");
  revalidatePath("/dashboard");

  return NextResponse.json({ ok: true, message: "تم قبول طلب الدفع وتفعيل الكورس للطالب" });
}
