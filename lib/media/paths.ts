import { randomUUID } from "node:crypto";
import type { MediaResourceType } from "../bunny/types.ts";

const folders: Record<MediaResourceType, string> = {
  video: "videos", image: "images", logo: "logos", hero: "heroes", course_cover: "course-covers",
  profile_image: "profiles", pdf: "documents", attachment: "attachments",
};
function safeId(value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error("INVALID_MEDIA_PATH");
  return value;
}
export function createBunnyStoragePath(tenantId: string, resourceType: MediaResourceType, extension: string, courseId?: string) {
  const date = new Date().toISOString().slice(0, 10);
  const course = courseId ? `/${safeId(courseId)}` : "";
  return `academies/${safeId(tenantId)}/${folders[resourceType]}${course}/${date}/${randomUUID()}.${extension}`;
}
export function encodeStoragePath(path: string) { return path.split("/").map(encodeURIComponent).join("/"); }