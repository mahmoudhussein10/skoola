import { z } from "zod";
import { mediaResourceTypes, type MediaResourceType } from "../bunny/types.ts";

export const videoMimeTypes = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"]);
export const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/svg+xml"]);
export const documentMimeTypes = new Set(["application/pdf"]);

const limitsMb: Record<MediaResourceType, number> = {
  video: Number(process.env.BUNNY_MAX_VIDEO_SIZE_MB ?? 20480), image: 10, logo: 5, hero: 15,
  course_cover: 10, profile_image: 8, pdf: 50, attachment: 50,
};

export const mediaDescriptorSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().toLowerCase().max(120),
  fileSize: z.number().int().positive(),
  resourceType: z.enum(mediaResourceTypes),
  title: z.string().trim().max(180).optional(),
  altText: z.string().trim().max(300).optional(),
  courseId: z.string().cuid().optional(),
  lessonId: z.string().cuid().optional(),
});

const extensionForMime: Record<string, string> = {
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/x-matroska": "mkv",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

export function sanitizeMediaTitle(value: string) {
  return value.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 180) || "ملف بدون عنوان";
}

export function validateDescriptor(input: z.infer<typeof mediaDescriptorSchema>) {
  const maximum = limitsMb[input.resourceType] * 1024 * 1024;
  if (input.fileSize > maximum) throw new Error(`FILE_TOO_LARGE:${limitsMb[input.resourceType]}`);
  const isVideo = videoMimeTypes.has(input.mimeType);
  const isImage = imageMimeTypes.has(input.mimeType);
  const isDocument = documentMimeTypes.has(input.mimeType);
  if (input.resourceType === "video" && !isVideo) throw new Error("UNSUPPORTED_VIDEO");
  if (["image", "logo", "hero", "course_cover", "profile_image"].includes(input.resourceType) && !isImage) throw new Error("UNSUPPORTED_IMAGE");
  if (["pdf", "attachment"].includes(input.resourceType) && !isDocument && !isImage) throw new Error("UNSUPPORTED_DOCUMENT");
  const extension = extensionForMime[input.mimeType];
  if (!extension) throw new Error("UNSUPPORTED_FILE");
  const suppliedExtension = input.fileName.toLowerCase().split(".").pop();
  if (suppliedExtension && suppliedExtension !== extension && !(input.mimeType === "image/jpeg" && suppliedExtension === "jpeg")) throw new Error("MIME_EXTENSION_MISMATCH");
  return { ...input, extension, maximumBytes: maximum, title: sanitizeMediaTitle(input.title || input.fileName.replace(/\.[^.]+$/, "")) };
}

function startsWith(bytes: Uint8Array, values: number[]) { return values.every((value, index) => bytes[index] === value); }
function ascii(bytes: Uint8Array, start: number, length: number) { return new TextDecoder("ascii").decode(bytes.slice(start, start + length)); }

export function validateMagicBytes(bytes: Uint8Array, mimeType: string) {
  if (!bytes.length) throw new Error("EMPTY_FILE");
  if (mimeType === "image/jpeg" && !startsWith(bytes, [0xff, 0xd8, 0xff])) throw new Error("INVALID_FILE_SIGNATURE");
  if (mimeType === "image/png" && !startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) throw new Error("INVALID_FILE_SIGNATURE");
  if (mimeType === "image/webp" && !(ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP")) throw new Error("INVALID_FILE_SIGNATURE");
  if (mimeType === "image/avif" && !(ascii(bytes, 4, 4) === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 4)))) throw new Error("INVALID_FILE_SIGNATURE");
  if (mimeType === "application/pdf" && ascii(bytes, 0, 5) !== "%PDF-") throw new Error("INVALID_FILE_SIGNATURE");
  if (mimeType === "image/svg+xml") validateSvg(bytes);
}

function validateSvg(bytes: Uint8Array) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).slice(0, 2_000_000);
  const normalized = text.toLowerCase();
  if (!normalized.includes("<svg") || /<script|<foreignobject|<!entity|<!doctype|\son\w+\s*=|javascript:|data:text\/html|https?:\/\//i.test(text)) throw new Error("UNSAFE_SVG");
}

export function mediaErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("FILE_TOO_LARGE:")) return `حجم الملف أكبر من الحد المسموح (${message.split(":")[1]}MB)`;
  const messages: Record<string, string> = {
    UNSUPPORTED_VIDEO: "صيغة الفيديو غير مدعومة", UNSUPPORTED_IMAGE: "صيغة الصورة غير مدعومة",
    UNSUPPORTED_DOCUMENT: "نوع المستند غير مدعوم", UNSUPPORTED_FILE: "نوع الملف غير مدعوم",
    MIME_EXTENSION_MISMATCH: "امتداد الملف لا يطابق محتواه", INVALID_FILE_SIGNATURE: "محتوى الملف لا يطابق نوعه",
    EMPTY_FILE: "الملف فارغ", UNSAFE_SVG: "ملف SVG يحتوي على محتوى غير آمن",
  };
  return messages[message] ?? "تعذر التحقق من الملف";
}