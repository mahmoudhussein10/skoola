import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyBunnyWebhookSignature(rawBody: string, headers: Headers, secret: string) {
  if (headers.get("x-bunnystream-signature-version") !== "v1") return false;
  if (headers.get("x-bunnystream-signature-algorithm") !== "hmac-sha256") return false;
  const received = headers.get("x-bunnystream-signature") ?? "";
  if (!/^[0-9a-f]{64}$/.test(received) || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return timingSafeEqual(Buffer.from(received, "utf8"), Buffer.from(expected, "utf8"));
}