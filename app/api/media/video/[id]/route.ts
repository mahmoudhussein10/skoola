import { NextResponse } from "next/server";
import { authorizeTenant, isSameOrigin } from "../../../../../lib/api-auth";
import { prisma } from "../../../../../lib/prisma";
import { configurationMessage } from "../../../../../lib/bunny/config";
import { deleteStreamVideo, getStreamVideo, mapStreamState, streamEmbedUrl, streamPlaybackUrl, streamThumbnailUrl } from "../../../../../lib/bunny/stream";
import { getMediaUsage, mediaJson } from "../../../../../lib/media/permissions";

async function ownedAsset(id: string, tenantId: string) {
  return prisma.mediaAsset.findFirst({ where: { id, tenantId, provider: "BUNNY_STREAM", deletedAt: null } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeTenant("media.manage");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const asset = await ownedAsset(id, auth.context.membership.tenantId);
  if (!asset?.bunnyVideoId) return NextResponse.json({ ok: false, message: "الفيديو غير موجود" }, { status: 404 });
  try {
    const video = await getStreamVideo(asset.bunnyVideoId);
    const state = mapStreamState(video.status);
    const thumbnailUrl = streamThumbnailUrl(video.guid, video.thumbnailFileName || "thumbnail.jpg");
    const embedUrl = streamEmbedUrl(video.guid);
    const playbackUrl = streamPlaybackUrl(video.guid);
    const updated = await prisma.$transaction(async (tx) => {
      const media = await tx.mediaAsset.update({ where: { id: asset.id }, data: {
        ...state, uploadProgress: state.processingStatus === "READY" ? 100 : Math.min(99, Math.max(0, video.encodeProgress ?? 0)),
        durationSeconds: video.length ? Math.round(video.length) : asset.durationSeconds,
        width: video.width ?? asset.width, height: video.height ?? asset.height, thumbnailUrl, embedUrl, playbackUrl,
        errorMessage: state.processingStatus === "FAILED" ? "فشل Bunny في تجهيز الفيديو" : null,
      } });
      if (asset.lessonId && state.processingStatus === "READY") {
        await tx.lesson.updateMany({ where: { id: asset.lessonId, tenantId: asset.tenantId }, data: { videoId: null, videoUrl: embedUrl, videoProvider: "BUNNY_STREAM", thumbnailUrl, duration: video.length ? Math.max(1, Math.ceil(video.length / 60)) : undefined } });
      }
      return media;
    });
    return NextResponse.json({ ok: true, asset: mediaJson(updated) });
  } catch (error) {
    return NextResponse.json({ ok: false, message: configurationMessage(error) }, { status: 502 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeTenant("media.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const { id } = await params;
  const asset = await ownedAsset(id, auth.context.membership.tenantId);
  if (!asset) return NextResponse.json({ ok: false, message: "الفيديو غير موجود" }, { status: 404 });
  const updated = await prisma.mediaAsset.update({ where: { id: asset.id }, data: { uploadStatus: "COMPLETED", processingStatus: "PROCESSING", uploadProgress: 100, errorMessage: null } });
  return NextResponse.json({ ok: true, asset: mediaJson(updated) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeTenant("media.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const { id } = await params;
  const asset = await ownedAsset(id, auth.context.membership.tenantId);
  if (!asset?.bunnyVideoId) return NextResponse.json({ ok: false, message: "الفيديو غير موجود" }, { status: 404 });
  const usage = await getMediaUsage(asset.tenantId, asset);
  if (usage.length) return NextResponse.json({ ok: false, message: "الفيديو مستخدم حاليًا. أزل ارتباطه من الدرس أولًا.", usage }, { status: 409 });
  try {
    await deleteStreamVideo(asset.bunnyVideoId);
    await prisma.mediaAsset.update({ where: { id: asset.id }, data: { deletedAt: new Date(), uploadStatus: "CANCELLED" } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, message: configurationMessage(error) }, { status: 502 });
  }
}