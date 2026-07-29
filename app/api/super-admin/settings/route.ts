import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeSuperAdmin, isSameOrigin } from "../../../../lib/api-auth";
import { requestFingerprint } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

const schema = z.object({
  platformName: z.string().trim().min(3).max(100),
  supportEmail: z.union([z.string().trim().email(), z.literal("")]),
  supportPhone: z.string().trim().max(30),
  registrationEnabled: z.boolean(),
  teacherRegistrationEnabled: z.boolean(),
  maintenanceMode: z.boolean(),
  requireAdminApproval: z.boolean(),
  maxDevicesPerStudent: z.number().int().min(1).max(10),
  defaultTenantStatus: z.enum(["TRIAL", "ACTIVE", "SUSPENDED", "DISABLED"]),
  maxUploadSizeMb: z.number().int().min(1).max(500),
  billingVodafoneCashEnabled: z.boolean(),
  billingVodafoneCashNumber: z.string().trim().max(30),
  billingInstaPayEnabled: z.boolean(),
  billingInstaPayAddress: z.string().trim().max(120),
  billingAccountName: z.string().trim().max(120),
  billingPaymentInstructions: z.string().trim().max(500),
  subscriptionTrialHours: z.number().int().min(1).max(720),
  subscriptionGraceDays: z.number().int().min(0).max(60),
  subscriptionQuarterlyDiscount: z.number().min(0).max(50),
  subscriptionSemiannualDiscount: z.number().min(0).max(60),
  subscriptionAnnualBilledMonths: z.number().int().min(1).max(12),
  allowedUploadTypes: z.array(z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp", "video/mp4"])).max(5),
});

export async function PUT(request: Request) {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "تحقق من قيم الإعدادات" }, { status: 400 });
  const before = await prisma.platformSettings.findUnique({ where: { id: "default" } });
  const { ipHash } = await requestFingerprint();
  const after = await prisma.$transaction(async (tx) => {
    const settings = await tx.platformSettings.upsert({
      where: { id: "default" },
      create: { ...parsed.data, teacherRegistrationEnabled: false, supportEmail: parsed.data.supportEmail || null, supportPhone: parsed.data.supportPhone || null, billingVodafoneCashNumber: parsed.data.billingVodafoneCashNumber || null, billingInstaPayAddress: parsed.data.billingInstaPayAddress || null, billingAccountName: parsed.data.billingAccountName || null, billingPaymentInstructions: parsed.data.billingPaymentInstructions || null },
      update: { ...parsed.data, teacherRegistrationEnabled: false, supportEmail: parsed.data.supportEmail || null, supportPhone: parsed.data.supportPhone || null, billingVodafoneCashNumber: parsed.data.billingVodafoneCashNumber || null, billingInstaPayAddress: parsed.data.billingInstaPayAddress || null, billingAccountName: parsed.data.billingAccountName || null, billingPaymentInstructions: parsed.data.billingPaymentInstructions || null },
    });
    await tx.auditLog.create({ data: { actorId: auth.context.user.id, action: "PLATFORM_SETTINGS_UPDATED", entityType: "PlatformSettings", entityId: "default", before: before ?? undefined, after: settings, ipHash } });
    return settings;
  });
  return NextResponse.json({ ok: true, settings: after });
}
