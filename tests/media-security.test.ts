import test from "node:test";
import assert from "node:assert/strict";
import { createBunnyStoragePath } from "../lib/media/paths.ts";
import { validateDescriptor, validateMagicBytes } from "../lib/media/validation.ts";
import { createHmac } from "node:crypto";
import { verifyBunnyWebhookSignature } from "../lib/bunny/webhook.ts";
import { isBunnyStorageUrl, isBunnyVideoUrl } from "../lib/media/trusted-url.ts";

test("media paths remain isolated to the authenticated academy", () => {
  const path = createBunnyStoragePath("tenant-a", "course_cover", "webp", "course-a");
  assert.equal(path.startsWith("academies/tenant-a/course-covers/course-a/"), true);
  assert.equal(path.includes(".."), false);
  assert.throws(() => createBunnyStoragePath("../tenant-b", "logo", "png"));
});

test("media descriptors route videos and reject executables and oversized assets", () => {
  const video = validateDescriptor({ fileName: "lesson.mp4", mimeType: "video/mp4", fileSize: 1024, resourceType: "video", title: "Lesson" });
  assert.equal(video.extension, "mp4");
  assert.throws(() => validateDescriptor({ fileName: "virus.exe", mimeType: "application/x-msdownload", fileSize: 100, resourceType: "attachment", title: "x" }));
  assert.throws(() => validateDescriptor({ fileName: "logo.png", mimeType: "image/png", fileSize: 6 * 1024 * 1024, resourceType: "logo", title: "x" }));
});

test("magic byte validation rejects disguised files and unsafe SVG", () => {
  assert.doesNotThrow(() => validateMagicBytes(new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), "image/png"));
  assert.throws(() => validateMagicBytes(new TextEncoder().encode("<html>not a png</html>"), "image/png"));
  assert.throws(() => validateMagicBytes(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "image/svg+xml"));
});

test("Bunny Stream webhook signatures reject unsigned bodies and accept exact signed bodies", () => {
  const body = JSON.stringify({ VideoGuid: "fake" });
  const secret = "test-only-secret";
  assert.equal(verifyBunnyWebhookSignature(body, new Headers(), secret), false);
  const signature = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  const headers = new Headers({ "x-bunnystream-signature-version": "v1", "x-bunnystream-signature-algorithm": "hmac-sha256", "x-bunnystream-signature": signature });
  assert.equal(verifyBunnyWebhookSignature(body, headers, secret), true);
  assert.equal(verifyBunnyWebhookSignature(body + " ", headers, secret), false);
});
test("teacher-authored media URLs only accept Bunny delivery hosts", () => {
  const previousStorage = process.env.BUNNY_STORAGE_CDN_HOSTNAME;
  const previousStream = process.env.BUNNY_STREAM_CDN_HOSTNAME;
  process.env.BUNNY_STORAGE_CDN_HOSTNAME = "skoola.b-cdn.net";
  process.env.BUNNY_STREAM_CDN_HOSTNAME = "vz-example.b-cdn.net";
  assert.equal(isBunnyStorageUrl("https://skoola.b-cdn.net/academies/a/image.webp"), true);
  assert.equal(isBunnyStorageUrl("https://example.com/image.webp"), false);
  assert.equal(isBunnyVideoUrl("https://iframe.mediadelivery.net/embed/123/video-id"), true);
  assert.equal(isBunnyVideoUrl("https://youtube.com/watch?v=test"), false);
  if (previousStorage === undefined) delete process.env.BUNNY_STORAGE_CDN_HOSTNAME; else process.env.BUNNY_STORAGE_CDN_HOSTNAME = previousStorage;
  if (previousStream === undefined) delete process.env.BUNNY_STREAM_CDN_HOSTNAME; else process.env.BUNNY_STREAM_CDN_HOSTNAME = previousStream;
});