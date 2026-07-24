import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { getAuthContext } from "../../../../lib/auth";
import { isSameOrigin } from "../../../../lib/api-auth";

const schema = z.object({
  courseId: z.string().min(1, "الكورس مطلوب"),
  paymentMethod: z.enum(["VODAFONE_CASH", "INSTAPAY", "CASH", "PAYMOB", "FAWRY", "STRIPE", "OTHER"]).default("VODAFONE_CASH"),
  referenceNumber: z.string().trim().max(100).optional().nullable(),
  proofUrl: z.string().trim().url().optional().nullable().or(z.literal("")),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  }

  const auth = await getAuthContext();
  if (!auth || auth.user.role !== "STUDENT" || !auth.membership) {
    return NextResponse.json({ ok: false, message: "يجب تسجيل الدخول كطالب أولاً" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "بيانات الدفع غير صحيحة" },
      { status: 400 }
    );
  }

  const tenantId = auth.membership.tenantId;
  const course = await prisma.course.findFirst({
    where: { id: parsed.data.courseId, tenantId, status: "PUBLISHED" },
  });

  if (!course) {
    return NextResponse.json({ ok: false, message: "الكورس غير متاح حاليًا" }, { status: 404 });
  }

  // Check existing enrollment
  const existingEnrollment = await prisma.enrollment.findUnique({
    where: { tenantId_studentId_courseId: { tenantId, studentId: auth.user.id, courseId: course.id } },
  });

  if (existingEnrollment && existingEnrollment.status === "ACTIVE") {
    return NextResponse.json({ ok: false, message: "أنت مشترك في هذا الكورس بالفعل" }, { status: 400 });
  }

  // Check pending payment
  const pendingPayment = await prisma.payment.findFirst({
    where: {
      tenantId,
      studentId: auth.user.id,
      courseId: course.id,
      status: "PENDING",
    },
  });

  if (pendingPayment) {
    return NextResponse.json(
      { ok: false, message: "لديك طلب اشتراك قيد المراجعة بالفعل لهذا الكورس" },
      { status: 400 }
    );
  }

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        tenantId,
        studentId: auth.user.id,
        courseId: course.id,
        amount: course.price,
        paymentMethod: parsed.data.paymentMethod,
        referenceNumber: parsed.data.referenceNumber || null,
        proofUrl: parsed.data.proofUrl || null,
        status: "PENDING",
      },
    });

    await tx.activityLog.create({
      data: {
        tenantId,
        actorId: auth.user.id,
        action: "تقديم طلب اشتراك ودفع",
        entityType: "Payment",
        entityId: created.id,
      },
    });

    return created;
  });

  return NextResponse.json({ ok: true, payment }, { status: 201 });
}
