import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeTenant, isSameOrigin } from "../../../../../lib/api-auth";
import { requestFingerprint } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { tenantStoragePath } from "../../../../../lib/tenant-security";

const allowedImages = new Set(["image/jpeg", "image/png", "image/webp"]);
const brandAssets = new Set(["logo", "hero", "portrait"]);

export async function POST(request: Request) {
  const auth = await authorizeTenant("tenant.branding.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const rawAsset = form?.get("asset");
  const asset = typeof rawAsset === "string" ? rawAsset : "logo";
  if (!(file instanceof File) || !allowedImages.has(file.type)) return NextResponse.json({ ok: false, message: "ارفع صورة JPEG أو PNG أو WebP" }, { status: 400 });
  if (!brandAssets.has(asset)) return NextResponse.json({ ok: false, message: "نوع ملف الهوية غير صالح" }, { status: 400 });
  const platform = await prisma.platformSettings.upsert({ where: { id: "default" }, update: {}, create: {} });
  const maxBytes = Math.min(platform.maxUploadSizeMb, 5) * 1024 * 1024;
  if (file.size <= 0 || file.size > maxBytes) return NextResponse.json({ ok: false, message: "حجم الصورة يتجاوز الحد المسموح" }, { status: 400 });
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "tenant-assets";
  if (!baseUrl || !serviceKey) return NextResponse.json({ ok: false, message: "خدمة رفع الملفات غير مهيأة على الخادم" }, { status: 503 });

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const tenantId = auth.context.membership.tenantId;
  const storagePath = tenantStoragePath(tenantId, `branding/${asset}`, `${randomBytes(16).toString("hex")}.${extension}`);
  const upload = await fetch(`${baseUrl}/storage/v1/object/${bucket}/${storagePath}`, {
    method: "POST",
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": file.type, "x-upsert": "false" },
    body: await file.arrayBuffer(),
  });
  if (!upload.ok) return NextResponse.json({ ok: false, message: "تعذر رفع الصورة إلى التخزين" }, { status: 502 });
  const assetUrl = `${baseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;
  const before = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { logoUrl: true, theme: { select: { heroImageUrl: true, teacherPortraitUrl: true } } } });
  const { ipHash } = await requestFingerprint();
  await prisma.$transaction(async (tx) => {
    if (asset === "logo") await tx.tenant.update({ where: { id: tenantId }, data: { logoUrl: assetUrl } });
    else await tx.themeSettings.upsert({ where: { tenantId }, create: { tenantId, [asset === "hero" ? "heroImageUrl" : "teacherPortraitUrl"]: assetUrl }, update: { [asset === "hero" ? "heroImageUrl" : "teacherPortraitUrl"]: assetUrl } });
    await tx.auditLog.create({ data: { tenantId, actorId: auth.context.user.id, action: `TENANT_${asset.toUpperCase()}_UPDATED`, entityType: asset === "logo" ? "Tenant" : "ThemeSettings", entityId: tenantId, before: asset === "logo" ? { logoUrl: before?.logoUrl ?? "" } : before?.theme ?? undefined, after: { assetUrl, storagePath, asset }, ipHash } });
  });
  return NextResponse.json({ ok: true, assetUrl });
}