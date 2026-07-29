import { NextResponse } from "next/server";
import { authorizeTenant, isSameOrigin } from "../../../../../lib/api-auth";
import { prisma } from "../../../../../lib/prisma";
import { configurationMessage } from "../../../../../lib/bunny/config";
import { createStreamVideo, createTusCredentials, deleteStreamVideo, ensureAcademyCollection, streamEmbedUrl, streamPlaybackUrl, streamThumbnailUrl } from "../../../../../lib/bunny/stream";
import { mediaDescriptorSchema, mediaErrorMessage, validateDescriptor } from "../../../../../lib/media/validation";
import { mediaJson, verifyMediaRelations } from "../../../../../lib/media/permissions";
import { assertTenantStorageCapacity } from "../../../../../lib/subscriptions";

export async function POST(request: Request) {
  const auth = await authorizeTenant("media.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const parsed = mediaDescriptorSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "بيانات الفيديو غير صالحة" }, { status: 400 });
  let videoId: string | undefined;
  try {
    const descriptor = validateDescriptor(parsed.data);
    if (descriptor.resourceType !== "video") return NextResponse.json({ ok: false, message: "هذا المسار مخصص للفيديو فقط" }, { status: 400 });
    const tenantId = auth.context.membership.tenantId;
    await verifyMediaRelations(tenantId, descriptor.courseId, descriptor.lessonId);
    await assertTenantStorageCapacity(tenantId, descriptor.fileSize);
    const collectionId = await ensureAcademyCollection(tenantId, auth.context.membership.tenant.name);
    const video = await createStreamVideo(descriptor.title, collectionId);
    videoId = video.guid;
    const asset = await prisma.mediaAsset.create({ data: {
      tenantId, uploadedById: auth.context.user.id, courseId: descriptor.courseId, lessonId: descriptor.lessonId,
      resourceType: "video", provider: "BUNNY_STREAM", originalFileName: descriptor.fileName,
      mimeType: descriptor.mimeType, fileExtension: descriptor.extension, fileSizeBytes: BigInt(descriptor.fileSize), title: descriptor.title,
      bunnyVideoId: video.guid, bunnyCollectionId: collectionId, uploadStatus: "UPLOADING", processingStatus: "WAITING",
      embedUrl: streamEmbedUrl(video.guid), playbackUrl: streamPlaybackUrl(video.guid), thumbnailUrl: streamThumbnailUrl(video.guid),
      metadata: { courseId: descriptor.courseId ?? null, lessonId: descriptor.lessonId ?? null },
    } });
    return NextResponse.json({ ok: true, upload: createTusCredentials(asset.id, video.guid), asset: mediaJson(asset) }, { status: 201 });
  } catch (error) {
    if (videoId) await deleteStreamVideo(videoId).catch(() => undefined);
    const message = error instanceof Error && error.message === "STORAGE_LIMIT_REACHED" ? "وصلت للحد الأقصى للمساحة. رقِّ الخطة قبل رفع ملف جديد." : error instanceof Error && (error.message.startsWith("BUNNY_") || error.name === "BunnyConfigurationError") ? configurationMessage(error) : mediaErrorMessage(error);
    const status = error instanceof Error && error.name === "BunnyConfigurationError" ? 503 : 400;
    return NextResponse.json({ ok: false, message }, { status });
  }
}