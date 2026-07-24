import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeSuperAdmin, isSameOrigin } from "../../../../lib/api-auth";
import { requestFingerprint } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

const schema = z.object({
  title: z.string().trim().min(3).max(120),
  message: z.string().trim().min(5).max(2000),
  severity: z.enum(["INFO", "SUCCESS", "WARNING", "CRITICAL"]),
  audience: z.enum(["ALL_TEACHERS", "SELECTED_TENANTS", "TEACHERS_ONLY", "ALL_USERS"]),
  tenantIds: z.array(z.string().min(1)).max(200),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable(),
  dismissible: z.boolean(),
  active: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.audience === "SELECTED_TENANTS" && value.tenantIds.length === 0) ctx.addIssue({ code: "custom", path: ["tenantIds"], message: "اختر منصة واحدة على الأقل" });
  if (value.endsAt && value.endsAt <= value.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "تاريخ النهاية يجب أن يكون بعد البداية" });
});

export async function POST(request: Request) {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "تحقق من بيانات الإعلان" }, { status: 400 });
  const tenantIds = parsed.data.audience === "SELECTED_TENANTS" ? [...new Set(parsed.data.tenantIds)] : [];
  if (tenantIds.length) {
    const count = await prisma.tenant.count({ where: { id: { in: tenantIds }, status: { not: "ARCHIVED" } } });
    if (count !== tenantIds.length) return NextResponse.json({ ok: false, message: "إحدى المنصات المحددة غير صالحة" }, { status: 400 });
  }
  const { ipHash } = await requestFingerprint();
  const announcement = await prisma.$transaction(async (tx) => {
    const created = await tx.systemAnnouncement.create({ data: { ...parsed.data, tenantIds } });
    await tx.auditLog.create({ data: { actorId: auth.context.user.id, action: "ANNOUNCEMENT_CREATED", entityType: "SystemAnnouncement", entityId: created.id, after: created, ipHash } });
    return created;
  });
  return NextResponse.json({ ok: true, announcement }, { status: 201 });
}