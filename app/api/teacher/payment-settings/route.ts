import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeTenant, isSameOrigin } from "../../../../lib/api-auth";
import { requestFingerprint } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { paymentSettingsSchema } from "../../../../lib/payment-settings";

export async function PUT(request: Request) {
  const auth = await authorizeTenant("tenant.settings.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });

  const parsed = paymentSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "راجع بيانات الدفع" }, { status: 400 });
  }

  const tenantId = auth.context.membership.tenantId;
  const data = {
    ...parsed.data,
    vodafoneCashNumber: parsed.data.vodafoneCashNumber.replace(/[\s-]/g, "") || null,
    instaPayAddress: parsed.data.instaPayAddress || null,
    bankName: parsed.data.bankName || null,
    bankAccountNumber: parsed.data.bankAccountNumber || null,
    bankIban: parsed.data.bankIban || null,
    accountHolderName: parsed.data.accountHolderName || null,
    paymentInstructions: parsed.data.paymentInstructions || null,
  };
  const before = await prisma.teacherBillingSettings.findUnique({ where: { tenantId } });
  const { ipHash } = await requestFingerprint();
  const settings = await prisma.$transaction(async (tx) => {
    const updated = await tx.teacherBillingSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: auth.context.user.id,
        action: "TEACHER_PAYMENT_SETTINGS_UPDATED",
        entityType: "TeacherBillingSettings",
        entityId: updated.id,
        before: before ? { vodafoneCashEnabled: before.vodafoneCashEnabled, instaPayEnabled: before.instaPayEnabled, bankTransferEnabled: before.bankTransferEnabled } : undefined,
        after: { vodafoneCashEnabled: updated.vodafoneCashEnabled, instaPayEnabled: updated.instaPayEnabled, bankTransferEnabled: updated.bankTransferEnabled },
        ipHash,
      },
    });
    return updated;
  });

  revalidatePath("/teacher/settings");
  revalidatePath("/t/" + auth.context.membership.tenant.slug, "layout");
  return NextResponse.json({ ok: true, settings });
}