import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { authorizeStudentSubscription } from "../../../../lib/api-auth";
import { isSameOrigin } from "../../../../lib/api-auth";
import { notifyPaymentSubmitted } from "../../../../lib/notifications/events";
import { configurationMessage } from "../../../../lib/bunny/config";
import { deleteStorageFile, uploadStorageFile } from "../../../../lib/bunny/storage";
import { createBunnyStoragePath } from "../../../../lib/media/paths";
import { processImage } from "../../../../lib/media/image";
import { extensionForMime, imageMimeTypes, mediaErrorMessage, resolveVerifiedMimeType, validateDescriptor } from "../../../../lib/media/validation";

export const runtime = "nodejs";

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

  const authorization = await authorizeStudentSubscription();
  if (!authorization.ok) return authorization.response;
  const auth = authorization.context;

  const contentType = request.headers.get("content-type") ?? "";
  let proofFile: File | null = null;
  let body: unknown;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ ok: false, message: "تعذر قراءة بيانات الطلب" }, { status: 400 });
    const file = form.get("proof");
    proofFile = file instanceof File && file.size > 0 ? file : null;
    body = {
      courseId: form.get("courseId"),
      paymentMethod: form.get("paymentMethod") || "VODAFONE_CASH",
      referenceNumber: form.get("referenceNumber") || null,
      proofUrl: null,
    };
  } else {
    body = await request.json().catch(() => null);
  }

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

  let storagePath: string | undefined;
  let proofUrl = parsed.data.proofUrl || null;
  let payment;

  try {
    if (proofFile) {
      const descriptor = validateDescriptor({
        fileName: proofFile.name,
        mimeType: proofFile.type,
        fileSize: proofFile.size,
        resourceType: "image",
      });
      const originalBytes = new Uint8Array(await proofFile.arrayBuffer());
      const verifiedMimeType = resolveVerifiedMimeType(originalBytes, descriptor.mimeType);
      if (!imageMimeTypes.has(verifiedMimeType)) throw new Error("UNSUPPORTED_IMAGE");
      const processed = await processImage(originalBytes, verifiedMimeType, "image");
      const extension = extensionForMime[processed.mimeType] ?? processed.extension;
      storagePath = createBunnyStoragePath(tenantId, "image", extension, course.id);
      proofUrl = await uploadStorageFile(storagePath, processed.bytes);
    }

    payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          tenantId,
          studentId: auth.user.id,
          courseId: course.id,
          amount: course.price,
          paymentMethod: parsed.data.paymentMethod,
          referenceNumber: parsed.data.referenceNumber || null,
          proofUrl,
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
  } catch (error) {
    if (storagePath) await deleteStorageFile(storagePath).catch(() => undefined);
    const isBunnyError = error instanceof Error && (error.message.startsWith("BUNNY_") || error.name === "BunnyConfigurationError");
    const message = isBunnyError ? configurationMessage(error) : mediaErrorMessage(error);
    return NextResponse.json({ ok: false, message }, { status: isBunnyError ? 503 : 400 });
  }

  await notifyPaymentSubmitted({ tenantId, paymentId: payment.id }).catch(() => undefined);

  return NextResponse.json({ ok: true, payment }, { status: 201 });
}
