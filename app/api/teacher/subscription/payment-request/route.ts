import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeTeacherSubscription, isSameOrigin } from "@/lib/api-auth";
import { configurationMessage } from "@/lib/bunny/config";
import { deleteStorageFile, uploadStorageFile } from "@/lib/bunny/storage";
import { processImage } from "@/lib/media/image";
import { createBunnyStoragePath } from "@/lib/media/paths";
import { extensionForMime, imageMimeTypes, mediaErrorMessage, resolveVerifiedMimeType, validateDescriptor } from "@/lib/media/validation";
import { prisma } from "@/lib/prisma";
import { BILLING_CYCLES, getSubscriptionPolicy } from "@/lib/subscriptions";
import { quotePlanChange } from "@/lib/subscription-policy";

export const runtime = "nodejs";

const schema = z.object({
  planCode: z.enum(["STARTER", "GROWTH", "PRO"]),
  billingCycle: z.enum(BILLING_CYCLES),
  paymentMethod: z.enum(["VODAFONE_CASH", "INSTAPAY"]),
  referenceNumber: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const auth = await authorizeTeacherSubscription();
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, message: "تعذر قراءة بيانات الدفع" }, { status: 400 });
  const parsed = schema.safeParse({ planCode: form.get("planCode"), billingCycle: form.get("billingCycle"), paymentMethod: form.get("paymentMethod"), referenceNumber: form.get("referenceNumber") || undefined, notes: form.get("notes") || undefined });
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "بيانات الاشتراك غير صحيحة" }, { status: 400 });
  const proof = form.get("proof");
  if (!(proof instanceof File) || proof.size <= 0) return NextResponse.json({ ok: false, message: "ارفع صورة إيصال التحويل" }, { status: 400 });

  const tenantId = auth.context.membership.tenantId;
  const [plan, settings, subscription, policy] = await Promise.all([
    prisma.subscriptionPlan.findFirst({ where: { code: parsed.data.planCode, isActive: true, isCustom: false } }),
    prisma.platformSettings.upsert({ where: { id: "default" }, update: {}, create: {} }),
    prisma.tenantSubscription.findUnique({ where: { tenantId } }),
    getSubscriptionPolicy(),
  ]);
  if (!plan || plan.monthlyPrice == null || !subscription) return NextResponse.json({ ok: false, message: "الخطة غير متاحة حاليًا" }, { status: 404 });
  const methodEnabled = parsed.data.paymentMethod === "VODAFONE_CASH" ? settings.billingVodafoneCashEnabled && Boolean(settings.billingVodafoneCashNumber) : settings.billingInstaPayEnabled && Boolean(settings.billingInstaPayAddress);
  if (!methodEnabled) return NextResponse.json({ ok: false, message: "طريقة الدفع المختارة غير متاحة حاليًا" }, { status: 409 });

  let storagePath: string | undefined;
  try {
    const descriptor = validateDescriptor({ fileName: proof.name, mimeType: proof.type.toLowerCase(), fileSize: proof.size, resourceType: "image" });
    const source = new Uint8Array(await proof.arrayBuffer());
    const verifiedMimeType = resolveVerifiedMimeType(source, descriptor.mimeType);
    if (!imageMimeTypes.has(verifiedMimeType) || verifiedMimeType === "image/svg+xml") throw new Error("UNSUPPORTED_IMAGE");
    const processed = await processImage(source, verifiedMimeType, "image");
    const extension = extensionForMime[processed.mimeType] ?? processed.extension;
    storagePath = createBunnyStoragePath(tenantId, "image", extension);
    const proofUrl = await uploadStorageFile(storagePath, processed.bytes);
    const now = new Date();
    const pricing = quotePlanChange({
      current: { status: subscription.status, planId: subscription.planId, baseMonthlyPrice: Number(subscription.baseMonthlyPrice), currentPeriodStart: subscription.currentPeriodStart, currentPeriodEnd: subscription.currentPeriodEnd },
      requested: { id: plan.id, monthlyPrice: Number(plan.monthlyPrice), activeStudentLimit: plan.activeStudentLimit, storageLimitGb: plan.storageLimitGb },
      cycle: parsed.data.billingCycle, policy: policy.pricing, now,
    });

    const paymentRequest = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`);
      const pending = await tx.subscriptionPaymentRequest.findFirst({ where: { tenantId, status: { in: ["PENDING", "NEEDS_REVIEW"] } }, select: { id: true } });
      if (pending) throw new Error("PENDING_PAYMENT_EXISTS");
      const media = await tx.mediaAsset.create({ data: {
        tenantId, uploadedById: auth.context.user.id, resourceType: "image", provider: "BUNNY_STORAGE",
        originalFileName: proof.name, storedFileName: storagePath!.split("/").pop(), mimeType: processed.mimeType,
        fileExtension: extension, fileSizeBytes: BigInt(processed.bytes.byteLength), title: "إيصال اشتراك Skoola",
        altText: "صورة إيصال تحويل اشتراك الأكاديمية", bunnyStoragePath: storagePath, publicUrl: proofUrl,
        uploadStatus: "COMPLETED", processingStatus: "READY", uploadProgress: 100, width: processed.width, height: processed.height,
        metadata: { purpose: "subscription_receipt", originalSizeBytes: proof.size },
      } });
      const created = await tx.subscriptionPaymentRequest.create({ data: {
        tenantId, subscriptionId: subscription.id, requestedPlanId: plan.id, billingCycle: parsed.data.billingCycle, changeType: pricing.changeType,
        originalAmount: pricing.originalAmountEgp, discountAmount: pricing.discountAmountEgp, prorationCredit: pricing.prorationCreditEgp, amount: pricing.amountEgp,
        currency: "EGP", paymentMethod: parsed.data.paymentMethod, referenceNumber: parsed.data.referenceNumber || null,
        proofUrl: media.publicUrl, notes: parsed.data.notes || null, status: "PENDING", periodStart: pricing.periodStart, periodEnd: pricing.periodEnd,
      } });
      await tx.subscriptionEvent.create({ data: { tenantId, subscriptionId: subscription.id, actorUserId: auth.context.user.id, type: "PAYMENT_REQUESTED", key: `payment-requested:${created.id}`, payload: { requestId: created.id, planCode: plan.code, billingCycle: parsed.data.billingCycle, amount: pricing.amountEgp } } });
      await tx.auditLog.create({ data: { tenantId, actorId: auth.context.user.id, action: "SUBSCRIPTION_PAYMENT_REQUESTED", entityType: "SubscriptionPaymentRequest", entityId: created.id, after: { planCode: plan.code, billingCycle: parsed.data.billingCycle, changeType: pricing.changeType, amount: pricing.amountEgp } } });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ ok: true, paymentRequest: { id: paymentRequest.id, status: paymentRequest.status } }, { status: 201 });
  } catch (error) {
    if (storagePath) await deleteStorageFile(storagePath).catch(() => undefined);
    if (error instanceof Error && error.message === "PENDING_PAYMENT_EXISTS") return NextResponse.json({ ok: false, message: "لديك طلب دفع قيد المراجعة بالفعل" }, { status: 409 });
    const isBunnyError = error instanceof Error && (error.message.startsWith("BUNNY_") || error.name === "BunnyConfigurationError");
    return NextResponse.json({ ok: false, message: isBunnyError ? configurationMessage(error) : mediaErrorMessage(error) }, { status: isBunnyError ? 503 : 400 });
  }
}