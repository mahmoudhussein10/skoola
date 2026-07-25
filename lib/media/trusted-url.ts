function normalizedHostname(value: string | undefined) {
  if (!value) return "";
  try { return new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase(); }
  catch { return value.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0]; }
}

export function isBunnyStorageUrl(value: string | null | undefined) {
  if (!value) return true;
  try {
    const url = new URL(value);
    const configured = normalizedHostname(process.env.BUNNY_STORAGE_CDN_HOSTNAME);
    return url.protocol === "https:" && Boolean(configured) && url.hostname.toLowerCase() === configured;
  } catch { return false; }
}

export function isBunnyVideoUrl(value: string | null | undefined) {
  if (!value) return true;
  try {
    const url = new URL(value);
    const configured = normalizedHostname(process.env.BUNNY_STREAM_CDN_HOSTNAME);
    return url.protocol === "https:" && (url.hostname.toLowerCase() === "iframe.mediadelivery.net" || Boolean(configured) && url.hostname.toLowerCase() === configured);
  } catch { return false; }
}