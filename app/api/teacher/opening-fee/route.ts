import { NextResponse } from "next/server";
import { getAuthContext, requestFingerprint } from "../../../../lib/auth";
import { isSameOrigin } from "../../../../lib/api-auth";
import { prisma } from "../../../../lib/prisma";
import { uploadStorageFile, deleteStorageFile } from "../../../../lib/bunny/storage";
import { createBunnyStoragePath } from "../../../../lib/media/paths";
import { processImage } from "../../../../lib/media/image";
import { extensionForMime, resolveVerifiedMimeType, validateDescriptor } from "../../../../lib/media/validation";

export const runtime = "nodejs";
const PAYMENT_NUMBER = "01064225977";

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context?.membership || context.membership.role !== "TEACHER_OWNER") return NextResponse.json({ ok: false, message: "غير مصرح" }, { status: 403 });
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const tenantId = context.membership.tenantId;
  const billing = await prisma.teacherBillingSettings.findUnique({ where: { tenantId } });
  if (!billing || !["PENDING", "SUBMITTED"].includes(billing.openingFeeStatus)) return NextResponse.json({ ok: false, message: "رسوم فتح الحساب غير مطلوبة" }, { status: 409 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, message: "تعذر قراءة بيانات التحويل" }, { status: 400 });
  const method = form.get("paymentMethod");
  const referenceNumber = String(form.get("referenceNumber") || "").trim().slice(0, 100) || null;
  const file = form.get("proof");
  if (!["VODAFONE_CASH", "INSTAPAY"].includes(String(method))) return NextResponse.json({ ok: false, message: "اختر فودافون كاش أو InstaPay" }, { status: 400 });
  if (!(file instanceof File) || !file.size) return NextResponse.json({ ok: false, message: "ارفع صورة إيصال التحويل" }, { status: 400 });

  const pending = await prisma.teacherBillingPaymentSubmission.findFirst({ where: { tenantId, purpose: "OPENING_FEE", status: "PENDING" } });
  if (pending) return NextResponse.json({ ok: false, message: "يوجد طلب دفع قيد المراجعة بالفعل" }, { status: 409 });
  const statement = await prisma.billingStatement.findUnique({ where: { statementNumber: `OPEN-${tenantId}` } });
  if (!statement) return NextResponse.json({ ok: false, message: "تعذر العثور على فاتورة فتح الحساب" }, { status: 404 });

  let storagePath: string | undefined;
  try {
    let descriptor = validateDescriptor({ fileName: file.name, mimeType: file.type.toLowerCase(), fileSize: file.size, resourceType: "image" });
    const originalBytes = new Uint8Array(await file.arrayBuffer());
    const verifiedMime = resolveVerifiedMimeType(originalBytes, descriptor.mimeType);
    if (verifiedMime !== descriptor.mimeType) {
      const extension = extensionForMime[verifiedMime];
      if (!extension) throw new Error("UNSUPPORTED_FILE");
      descriptor = { ...descriptor, mimeType: verifiedMime, extension };
    }
    const processed = await processImage(originalBytes, descriptor.mimeType, "image");
    storagePath = createBunnyStoragePath(tenantId, "image", processed.extension);
    const proofUrl = await uploadStorageFile(storagePath, processed.bytes);
    const { ipHash } = await requestFingerprint();
    const submission = await prisma.$transaction(async (tx) => {
      const item = await tx.teacherBillingPaymentSubmission.create({ data: {
        tenantId, statementId: statement.id, amount: billing.openingFeeAmount, paymentMethod: String(method) as "VODAFONE_CASH" | "INSTAPAY",
        referenceNumber, proofUrl, purpose: "OPENING_FEE", notes: `رسوم فتح الحساب إلى ${PAYMENT_NUMBER}`,
      } });
      await tx.mediaAsset.create({ data: {
        tenantId, uploadedById: context.user.id, resourceType: "image", provider: "BUNNY_STORAGE", originalFileName: file.name,
        storedFileName: storagePath!.split("/").pop(), mimeType: processed.mimeType, fileExtension: processed.extension,
        fileSizeBytes: BigInt(processed.bytes.byteLength), title: "إيصال رسوم فتح الحساب", altText: "صورة تحويل رسوم فتح الحساب",
        bunnyStoragePath: storagePath, publicUrl: proofUrl, uploadStatus: "COMPLETED", processingStatus: "READY", uploadProgress: 100,
        width: processed.width, height: processed.height, metadata: { purpose: "OPENING_FEE", submissionId: item.id },
      } });
      await tx.teacherBillingSettings.update({ where: { tenantId }, data: { openingFeeStatus: "SUBMITTED" } });
      if (billing.openingFeeDueAt && billing.openingFeeDueAt <= new Date()) await tx.tenant.update({ where: { id: tenantId }, data: { status: "SUSPENDED", suspendedAt: new Date() } });
      await tx.auditLog.create({ data: { tenantId, actorId: context.user.id, action: "OPENING_FEE_PAYMENT_SUBMITTED", entityType: "TeacherBillingPaymentSubmission", entityId: item.id, metadata: { amount: Number(billing.openingFeeAmount), paymentMethod: String(method), proofUrl }, ipHash } });
      return item;
    });
    return NextResponse.json({ ok: true, submissionId: submission.id });
  } catch (error) {
    if (storagePath) await deleteStorageFile(storagePath).catch(() => undefined);
    console.error("Opening fee submission failed:", error);
    return NextResponse.json({ ok: false, message: "تعذر رفع الإيصال. استخدم صورة JPG أو PNG أو WebP بحجم مناسب." }, { status: 400 });
  }
}
