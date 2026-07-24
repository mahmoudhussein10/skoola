import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeTenant, isSameOrigin } from "../../../../lib/api-auth";
import { requestFingerprint } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

const optionalUrl = z.union([z.string().trim().url(), z.literal("")]);
const schema = z.object({ platformName: z.string().trim().min(3).max(100), heroTitle: z.string().trim().max(180), description: z.string().trim().max(1000), supportPhone: z.string().trim().max(30), supportEmail: z.union([z.string().trim().email(), z.literal("")]), facebook: optionalUrl, youtube: optionalUrl, whatsapp: optionalUrl, publicPageLive: z.boolean() });

export async function PUT(request: Request) {
  const auth = await authorizeTenant("tenant.settings.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "تحقق من بيانات المنصة وروابط التواصل" }, { status: 400 });
  const tenantId = auth.context.membership.tenantId;
  const before = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  const socialLinks = { facebook: parsed.data.facebook || null, youtube: parsed.data.youtube || null, whatsapp: parsed.data.whatsapp || null };
  const { ipHash } = await requestFingerprint();
  const settings = await prisma.$transaction(async (tx) => {
    const updated = await tx.tenantSettings.upsert({ where: { tenantId }, create: { tenantId, platformName: parsed.data.platformName, heroTitle: parsed.data.heroTitle || null, description: parsed.data.description || null, supportPhone: parsed.data.supportPhone || null, supportEmail: parsed.data.supportEmail || null, socialLinks, publicPageLive: parsed.data.publicPageLive }, update: { platformName: parsed.data.platformName, heroTitle: parsed.data.heroTitle || null, description: parsed.data.description || null, supportPhone: parsed.data.supportPhone || null, supportEmail: parsed.data.supportEmail || null, socialLinks, publicPageLive: parsed.data.publicPageLive } });
    await tx.auditLog.create({ data: { tenantId, actorId: auth.context.user.id, action: "TENANT_SETTINGS_UPDATED", entityType: "TenantSettings", entityId: updated.id, before: before ?? undefined, after: updated, ipHash } });
    return updated;
  });
  revalidatePath(`/t/${auth.context.membership.tenant.slug}`);
  return NextResponse.json({ ok: true, settings });
}