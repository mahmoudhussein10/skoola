import sharp from "sharp";
import type { MediaResourceType } from "../bunny/types";

const maxDimensions: Partial<Record<MediaResourceType, { width: number; height: number }>> = {
  logo: { width: 1024, height: 1024 }, profile_image: { width: 1600, height: 1600 },
  course_cover: { width: 1920, height: 1080 }, hero: { width: 2560, height: 1800 }, image: { width: 2560, height: 2560 },
};

export async function processImage(bytes: Uint8Array, mimeType: string, resourceType: MediaResourceType) {
  if (mimeType === "image/svg+xml") return { bytes, mimeType, extension: "svg", width: null, height: null };
  const input = sharp(bytes, { failOn: "error", limitInputPixels: 50_000_000 }).rotate();
  const metadata = await input.metadata();
  if (!metadata.width || !metadata.height) throw new Error("INVALID_IMAGE_DIMENSIONS");
  const limit = maxDimensions[resourceType] ?? maxDimensions.image!;
  const output = await input.resize({ width: limit.width, height: limit.height, fit: "inside", withoutEnlargement: true }).webp({ quality: resourceType === "logo" ? 92 : 84, alphaQuality: 92, effort: 4 }).toBuffer({ resolveWithObject: true });
  return { bytes: new Uint8Array(output.data), mimeType: "image/webp", extension: "webp", width: output.info.width, height: output.info.height };
}