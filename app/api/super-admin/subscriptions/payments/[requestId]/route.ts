import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeSuperAdmin, isSameOrigin } from "@/lib/api-auth";
import { reviewSubscriptionPaymentRequest } from "@/lib/subscriptions";
import { notifySubscriptionApproved, notifySubscriptionReceiptReview } from "@/lib/notifications/events";
import { prisma } from "@/lib/prisma";

const schema = z.object({ status: z.enum(["APPROVED", "REJECTED", "NEEDS_REVIEW"]), rejectionReason: z.string().trim().max(500).optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "بيانات المراجعة غير صحيحة" }, { status: 400 });
  if ((parsed.data.status === "REJECTED" || parsed.data.status === "NEEDS_REVIEW") && !parsed.data.rejectionReason) return NextResponse.json({ ok: false, message: "اكتب سبب الرفض" }, { status: 400 });
  const { requestId } = await params;
  try {
    const result = await reviewSubscriptionPaymentRequest({ requestId, reviewerId: auth.context.user.id, status: parsed.data.status, rejectionReason: parsed.data.rejectionReason });
    if (!result.idempotent && parsed.data.status === "APPROVED") {
      const details = await prisma.subscriptionPaymentRequest.findUnique({ where: { id: requestId }, include: { requestedPlan: { select: { name: true } } } });
      if (details) await notifySubscriptionApproved({ tenantId: details.tenantId, requestId: details.id, planName: details.requestedPlan.name, periodEnd: details.periodEnd }).catch(() => undefined);
    }
    if (parsed.data.status === "NEEDS_REVIEW") await notifySubscriptionReceiptReview({ tenantId: result.paymentRequest.tenantId, requestId, reason: parsed.data.rejectionReason! }).catch(() => undefined);
    return NextResponse.json({ ok: true, status: result.paymentRequest.status, idempotent: result.idempotent });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "PAYMENT_REQUEST_NOT_FOUND") return NextResponse.json({ ok: false, message: "طلب الدفع غير موجود" }, { status: 404 });
    if (code === "PAYMENT_REQUEST_ALREADY_REVIEWED") return NextResponse.json({ ok: false, message: "تمت مراجعة هذا الطلب بالفعل" }, { status: 409 });
    return NextResponse.json({ ok: false, message: "تعذر حفظ قرار المراجعة" }, { status: 500 });
  }
}