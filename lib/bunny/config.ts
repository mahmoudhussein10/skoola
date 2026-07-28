export class BunnyConfigurationError extends Error {
  constructor(public readonly missing: string[]) {
    super(`BUNNY_CONFIGURATION_MISSING:${missing.join(",")}`);
    this.name = "BunnyConfigurationError";
  }
}

function required(names: string[]) {
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length) throw new BunnyConfigurationError(missing);
}

function hostname(value: string) {
  return value.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export function getBunnyStreamConfig() {
  required(["BUNNY_STREAM_LIBRARY_ID", "BUNNY_STREAM_API_KEY", "BUNNY_STREAM_CDN_HOSTNAME"]);
  return {
    libraryId: process.env.BUNNY_STREAM_LIBRARY_ID!.trim(),
    apiKey: process.env.BUNNY_STREAM_API_KEY!.trim(),
    cdnHostname: hostname(process.env.BUNNY_STREAM_CDN_HOSTNAME!),
    apiBase: "https://video.bunnycdn.com",
    tusEndpoint: "https://video.bunnycdn.com/tusupload",
  };
}

const storageRegions: Record<string, string> = {
  "": "storage.bunnycdn.com", de: "storage.bunnycdn.com", fsn: "storage.bunnycdn.com",
  uk: "uk.storage.bunnycdn.com", ny: "ny.storage.bunnycdn.com", la: "la.storage.bunnycdn.com",
  sg: "sg.storage.bunnycdn.com", se: "se.storage.bunnycdn.com", br: "br.storage.bunnycdn.com",
  jh: "jh.storage.bunnycdn.com", syd: "syd.storage.bunnycdn.com",
};

export function getBunnyStorageConfig() {
  required(["BUNNY_STORAGE_ZONE_NAME", "BUNNY_STORAGE_API_KEY", "BUNNY_STORAGE_CDN_HOSTNAME"]);
  const region = (process.env.BUNNY_STORAGE_REGION ?? "").trim().toLowerCase();
  const endpoint = region.includes(".") ? hostname(region) : storageRegions[region];
  if (!endpoint) throw new BunnyConfigurationError(["BUNNY_STORAGE_REGION"]);
  return {
    zoneName: process.env.BUNNY_STORAGE_ZONE_NAME!.trim(),
    apiKey: process.env.BUNNY_STORAGE_API_KEY!.trim(),
    cdnHostname: hostname(process.env.BUNNY_STORAGE_CDN_HOSTNAME!),
    endpoint,
  };
}

export function getBunnyWebhookSecret() {
  required(["BUNNY_WEBHOOK_SECRET"]);
  return process.env.BUNNY_WEBHOOK_SECRET!.trim();
}

export function configurationMessage(error: unknown) {
  if (error instanceof BunnyConfigurationError) return `خدمة رفع الملفات غير متاحة حاليًا`;
  return "تعذر الاتصال بخدمة الوسائط";
}