import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeSuperAdmin, isSameOrigin } from "@/lib/api-auth";
import { requestFingerprint } from "@/lib/auth";

const patchSchema = z.object({
  status: z.enum(["UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  adjustments: z.number().optional(),
  discount: z.number().optional(),
  internalNote: z.string().optional().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; statementId: string }> }
) {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });

  const { tenantId, statementId } = await params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "بيانات غير صالحة" }, { status: 400 });

  const statement = await prisma.billingStatement.findFirst({
    where: { id: statementId, tenantId },
  });

  if (!statement) return NextResponse.json({ ok: false, message: "الفاتورة غير موجودة" }, { status: 404 });

  const data = parsed.data;
  const { ipHash } = await requestFingerprint();

  const newSubtotal = Number(statement.subtotal);
  const newAdjustments = data.adjustments !== undefined ? data.adjustments : Number(statement.adjustments);
  const newDiscount = data.discount !== undefined ? data.discount : Number(statement.discount);
  const newFinalAmount = Math.max(0, newSubtotal + newAdjustments - newDiscount);

  let newPaidAmount = Number(statement.paidAmount);
  const newStatus = data.status || statement.status;

  if (data.status === "PAID") {
    newPaidAmount = newFinalAmount;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.billingStatement.update({
      where: { id: statementId },
      data: {
        ...(data.status ? { status: newStatus } : {}),
        adjustments: newAdjustments,
        discount: newDiscount,
        finalAmount: newFinalAmount,
        paidAmount: newPaidAmount,
        ...(data.internalNote !== undefined ? { internalNote: data.internalNote } : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: auth.context.user.id,
        action: "BILLING_STATEMENT_UPDATED",
        entityType: "BillingStatement",
        entityId: statementId,
        metadata: JSON.parse(JSON.stringify(data)),
        ipHash,
      },
    });

    return res;
  });

  return NextResponse.json({ ok: true, statement: updated, message: "تم تحديث حالة الفاتورة بنجاح" });
}
