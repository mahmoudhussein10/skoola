import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { authorizeTenant, isSameOrigin } from "../../../../lib/api-auth";
import { requestFingerprint } from "../../../../lib/auth";
import { themeSchema } from "../../../../lib/validation";

function luminance(hex: string) {
  const values = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}
function foreground(hex: string) {
  return luminance(hex) > 0.42 ? "#171411" : "#ffffff";
}

export async function PUT(request: Request) {
  const auth = await authorizeTenant("tenant.branding.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const parsed = themeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "تحقق من قيم الألوان والتصميم" }, { status: 400 });
  const tenantId = auth.context.membership.tenantId;
  const before = await prisma.themeSettings.findUnique({ where: { tenantId } });
  const { ipHash } = await requestFingerprint();
  const theme = await prisma.$transaction(async (tx) => {
    const updated = await tx.themeSettings.upsert({ where: { tenantId }, update: { ...parsed.data, primaryForeground: foreground(parsed.data.primaryColor) }, create: { tenantId, ...parsed.data, primaryForeground: foreground(parsed.data.primaryColor) } });
    await tx.auditLog.create({ data: { tenantId, actorId: auth.context.user.id, action: "THEME_UPDATED", entityType: "ThemeSettings", entityId: updated.id, before: before ?? undefined, after: updated, ipHash } });
    return updated;
  });
  return NextResponse.json({ ok: true, theme });
}
