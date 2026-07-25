import { NextResponse } from "next/server";
import { authorizeTenant, isSameOrigin } from "../../../../../lib/api-auth";
import { prisma } from "../../../../../lib/prisma";
import { configurationMessage } from "../../../../../lib/bunny/config";
import { deleteStorageFile, uploadStorageFile } from "../../../../../lib/bunny/storage";
import { createBunnyStoragePath } from "../../../../../lib/media/paths";
import { processImage } from "../../../../../lib/media/image";
import { mediaDescriptorSchema, mediaErrorMessage, imageMimeTypes, extensionForMime, resolveVerifiedMimeType, validateDescriptor } from "../../../../../lib/media/validation";
import { mediaJson, verifyMediaRelations } from "../../../../../lib/media/permissions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeTenant("media.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  let storagePath: string | undefined;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, message: "اختر ملفًا صالحًا" }, { status: 400 });
    const parsed = mediaDescriptorSchema.safeParse({
      fileName: file.name, mimeType: file.type, fileSize: file.size, resourceType: form.get("resourceType"),
      title: form.get("title") || undefined, altText: form.get("altText") || undefined,
      courseId: form.get("courseId") || undefined, lessonId: form.get("lessonId") || undefined,
    });
    if (!parsed.success) return NextResponse.json({ ok: false, message: "بيانات الملف غير صالحة" }, { status: 400 });
    let descriptor = validateDescriptor(parsed.data);
    if (descriptor.resourceType === "video") return NextResponse.json({ ok: false, message: "استخدم رافع الفيديو للفيديوهات" }, { status: 400 });
    const tenantId = auth.context.membership.tenantId;
    await verifyMediaRelations(tenantId, descriptor.courseId, descriptor.lessonId);
    const originalBytes = new Uint8Array(await file.arrayBuffer());
    const verifiedMimeType = resolveVerifiedMimeType(originalBytes, descriptor.mimeType);
    if (verifiedMimeType !== descriptor.mimeType) {
      const verifiedExtension = extensionForMime[verifiedMimeType];
      if (!verifiedExtension) throw new Error("UNSUPPORTED_FILE");
      descriptor = { ...descriptor, mimeType: verifiedMimeType, extension: verifiedExtension };
    }
    let bytes: Uint8Array<ArrayBufferLike> = originalBytes;
    let mimeType = descriptor.mimeType;
    let extension = descriptor.extension;
    let width: number | null = null;
    let height: number | null = null;
    if (imageMimeTypes.has(descriptor.mimeType)) {
      const processed = await processImage(originalBytes, descriptor.mimeType, descriptor.resourceType);
      bytes = processed.bytes; mimeType = processed.mimeType; extension = processed.extension; width = processed.width; height = processed.height;
      descriptor = { ...descriptor, extension };
    }
    storagePath = createBunnyStoragePath(tenantId, descriptor.resourceType, extension, descriptor.courseId);
    const publicUrl = await uploadStorageFile(storagePath, bytes);
    const asset = await prisma.$transaction(async (tx) => {
      const created = await tx.mediaAsset.create({ data: {
        tenantId, uploadedById: auth.context.user.id, courseId: descriptor.courseId, lessonId: descriptor.lessonId,
        resourceType: descriptor.resourceType, provider: "BUNNY_STORAGE", originalFileName: descriptor.fileName,
        storedFileName: storagePath!.split("/").pop(), mimeType, fileExtension: extension, fileSizeBytes: BigInt(bytes.byteLength),
        title: descriptor.title, altText: descriptor.altText, bunnyStoragePath: storagePath, publicUrl,
        uploadStatus: "COMPLETED", processingStatus: "READY", uploadProgress: 100, width, height,
        metadata: { originalSizeBytes: descriptor.fileSize, optimized: imageMimeTypes.has(descriptor.mimeType) },
      } });
      if (descriptor.resourceType === "logo") await tx.tenant.update({ where: { id: tenantId }, data: { logoUrl: publicUrl } });
      if (descriptor.resourceType === "hero") await tx.themeSettings.upsert({ where: { tenantId }, create: { tenantId, heroImageUrl: publicUrl }, update: { heroImageUrl: publicUrl } });
      if (descriptor.resourceType === "profile_image") { await tx.user.update({ where: { id: auth.context.user.id }, data: { avatarUrl: publicUrl } }); await tx.themeSettings.upsert({ where: { tenantId }, create: { tenantId, teacherPortraitUrl: publicUrl }, update: { teacherPortraitUrl: publicUrl } }); }
      if (descriptor.resourceType === "course_cover" && descriptor.courseId) await tx.course.updateMany({ where: { id: descriptor.courseId, tenantId }, data: { thumbnailUrl: publicUrl } });
      if (["attachment", "pdf"].includes(descriptor.resourceType) && descriptor.lessonId) await tx.lesson.updateMany({ where: { id: descriptor.lessonId, tenantId }, data: { attachmentUrl: publicUrl } });
      if (descriptor.resourceType === "image" && descriptor.lessonId) await tx.lesson.updateMany({ where: { id: descriptor.lessonId, tenantId }, data: { thumbnailUrl: publicUrl } });
      return created;
    });
    return NextResponse.json({ ok: true, asset: mediaJson(asset) }, { status: 201 });
  } catch (error) {
    if (storagePath) await deleteStorageFile(storagePath).catch(() => undefined);
    const message = error instanceof Error && error.message.startsWith("BUNNY_") ? configurationMessage(error) : mediaErrorMessage(error);
    return NextResponse.json({ ok: false, message }, { status: error instanceof Error && error.name === "BunnyConfigurationError" ? 503 : 400 });
  }
}