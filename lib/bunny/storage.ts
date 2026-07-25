import { createHash } from "node:crypto";
import { getBunnyStorageConfig } from "./config";
import { encodeStoragePath } from "../media/paths";

function storageUrl(path: string) {
  const config = getBunnyStorageConfig();
  return `https://${config.endpoint}/${encodeURIComponent(config.zoneName)}/${encodeStoragePath(path)}`;
}

export async function uploadStorageFile(path: string, bytes: Uint8Array) {
  const config = getBunnyStorageConfig();
  const checksum = createHash("sha256").update(bytes).digest("hex").toUpperCase();
  const response = await fetch(storageUrl(path), {
    method: "PUT",
    headers: { AccessKey: config.apiKey, "Content-Type": "application/octet-stream", Checksum: checksum },
    body: Buffer.from(bytes),
  });
  if (!response.ok) throw new Error(`BUNNY_STORAGE_API_ERROR:${response.status}`);
  return storagePublicUrl(path);
}

export async function deleteStorageFile(path: string) {
  const config = getBunnyStorageConfig();
  const response = await fetch(storageUrl(path), { method: "DELETE", headers: { AccessKey: config.apiKey } });
  if (!response.ok && response.status !== 404) throw new Error(`BUNNY_STORAGE_DELETE_ERROR:${response.status}`);
}

export function storagePublicUrl(path: string) {
  return `https://${getBunnyStorageConfig().cdnHostname}/${encodeStoragePath(path)}`;
}