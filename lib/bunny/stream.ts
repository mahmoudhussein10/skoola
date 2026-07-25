import { createHash } from "node:crypto";
import { prisma } from "../prisma";
import { getBunnyStreamConfig } from "./config";
import type { BunnyStreamCollection, BunnyStreamVideo, TusUploadCredentials } from "./types";

async function streamRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getBunnyStreamConfig();
  const response = await fetch(`${config.apiBase}${path}`, {
    ...init,
    headers: { AccessKey: config.apiKey, Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`BUNNY_STREAM_API_ERROR:${response.status}`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function ensureAcademyCollection(tenantId: string, tenantName: string) {
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId }, select: { bunnyStreamCollectionId: true } });
  if (settings?.bunnyStreamCollectionId) return settings.bunnyStreamCollectionId;
  const config = getBunnyStreamConfig();
  const collectionName = `academy-${tenantId}`;
  const existing = await streamRequest<{ items?: BunnyStreamCollection[] }>(`/library/${config.libraryId}/collections?search=${encodeURIComponent(collectionName)}&itemsPerPage=100`);
  let collectionId = existing.items?.find((item) => item.name === collectionName)?.guid;
  if (!collectionId) {
    const created = await streamRequest<BunnyStreamCollection>(`/library/${config.libraryId}/collections`, { method: "POST", body: JSON.stringify({ name: collectionName }) });
    collectionId = created.guid;
  }
  await prisma.tenantSettings.upsert({
    where: { tenantId },
    update: { bunnyStreamCollectionId: collectionId },
    create: { tenantId, platformName: tenantName, bunnyStreamCollectionId: collectionId },
  });
  return collectionId;
}

export async function createStreamVideo(title: string, collectionId?: string) {
  const config = getBunnyStreamConfig();
  return streamRequest<BunnyStreamVideo>(`/library/${config.libraryId}/videos`, {
    method: "POST",
    body: JSON.stringify({ title, ...(collectionId ? { collectionId } : {}) }),
  });
}

export function createTusCredentials(mediaId: string, videoId: string): TusUploadCredentials {
  const config = getBunnyStreamConfig();
  const expirationTime = Math.floor(Date.now() / 1000) + 6 * 60 * 60;
  const signature = createHash("sha256").update(`${config.libraryId}${config.apiKey}${expirationTime}${videoId}`).digest("hex");
  return { mediaId, endpoint: config.tusEndpoint, videoId, libraryId: config.libraryId, expirationTime, signature, embedUrl: streamEmbedUrl(videoId) };
}

export async function getStreamVideo(videoId: string) {
  const config = getBunnyStreamConfig();
  return streamRequest<BunnyStreamVideo>(`/library/${config.libraryId}/videos/${encodeURIComponent(videoId)}`);
}

export async function deleteStreamVideo(videoId: string) {
  const config = getBunnyStreamConfig();
  await streamRequest<void>(`/library/${config.libraryId}/videos/${encodeURIComponent(videoId)}`, { method: "DELETE" });
}

export function streamEmbedUrl(videoId: string) {
  const config = getBunnyStreamConfig();
  return `https://iframe.mediadelivery.net/embed/${config.libraryId}/${videoId}`;
}
export function streamPlaybackUrl(videoId: string) {
  return `https://${getBunnyStreamConfig().cdnHostname}/${videoId}/playlist.m3u8`;
}
export function streamThumbnailUrl(videoId: string, fileName = "thumbnail.jpg") {
  return `https://${getBunnyStreamConfig().cdnHostname}/${videoId}/${encodeURIComponent(fileName)}`;
}

export function mapStreamState(status?: number) {
  if (status === 4) return { processingStatus: "READY", uploadStatus: "COMPLETED" } as const;
  if (status === 5) return { processingStatus: "FAILED", uploadStatus: "FAILED" } as const;
  return { processingStatus: "PROCESSING", uploadStatus: "COMPLETED" } as const;
}