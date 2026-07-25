import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../../lib/prisma";
import { getBunnyStreamConfig, getBunnyWebhookSecret } from "../../../../lib/bunny/config";
import { mapStreamState, streamEmbedUrl, streamPlaybackUrl, streamThumbnailUrl } from "../../../../lib/bunny/stream";
import { verifyBunnyWebhookSignature } from "../../../../lib/bunny/webhook";

export const runtime = "nodejs";

function value(record: Record<string, unknown>, ...keys: string[]) { for (const key of keys) if (record[key] !== undefined) return record[key]; }

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    if (!verifyBunnyWebhookSignature(rawBody, request.headers, getBunnyWebhookSecret())) return NextResponse.json({ ok: false }, { status: 401 });
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const videoId = String(value(payload, "VideoGuid", "videoGuid", "Guid", "guid") ?? "");
    const libraryId = String(value(payload, "VideoLibraryId", "videoLibraryId", "LibraryId", "libraryId") ?? "");
    const config = getBunnyStreamConfig();
    if (!videoId || libraryId !== config.libraryId) return NextResponse.json({ ok: false }, { status: 400 });
    const asset = await prisma.mediaAsset.findUnique({ where: { bunnyVideoId: videoId } });
    if (!asset || asset.deletedAt) return NextResponse.json({ ok: true }, { status: 202 });
    const status = Number(value(payload, "Status", "status"));
    const state = mapStreamState(Number.isFinite(status) ? status : undefined);
    const thumbnailName = String(value(payload, "ThumbnailFileName", "thumbnailFileName") ?? "thumbnail.jpg");
    const embedUrl = streamEmbedUrl(videoId); const playbackUrl = streamPlaybackUrl(videoId); const thumbnailUrl = streamThumbnailUrl(videoId, thumbnailName);
    const duration = Number(value(payload, "Length", "length")); const width = Number(value(payload, "Width", "width")); const height = Number(value(payload, "Height", "height"));
    await prisma.$transaction(async (tx) => {
      await tx.mediaAsset.update({ where: { id: asset.id }, data: {
        ...state, uploadProgress: state.processingStatus === "READY" ? 100 : asset.uploadProgress,
        durationSeconds: Number.isFinite(duration) ? Math.round(duration) : asset.durationSeconds,
        width: Number.isFinite(width) ? width : asset.width, height: Number.isFinite(height) ? height : asset.height,
        embedUrl, playbackUrl, thumbnailUrl, errorMessage: state.processingStatus === "FAILED" ? "فشل ترميز الفيديو" : null,
        metadata: payload as Prisma.InputJsonValue,
      } });
      if (asset.lessonId && state.processingStatus === "READY") await tx.lesson.updateMany({ where: { id: asset.lessonId, tenantId: asset.tenantId }, data: { videoId: null, videoUrl: embedUrl, videoProvider: "BUNNY_STREAM", thumbnailUrl, duration: Number.isFinite(duration) ? Math.round(duration) : undefined } });
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}