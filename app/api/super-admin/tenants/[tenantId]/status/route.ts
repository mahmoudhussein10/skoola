import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../../lib/prisma";
import { authorizeSuperAdmin, isSameOrigin } from "../../../../../../lib/api-auth";
import { requestFingerprint } from "../../../../../../lib/auth";

const schema = z.object({ status: z.enum(["TRIAL", "ACTIVE", "SUSPENDED", "DISABLED"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "حالة غير صحيحة" }, { status: 400 });
  const { tenantId } = await params;
  const before = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, status: true } });
  if (!before) return NextResponse.json({ ok: false, message: "المنصة غير موجودة" }, { status: 404 });
  const { ipHash } = await requestFingerprint();
  const tenant = await prisma.$transaction(async (tx) => {
    const updated = await tx.tenant.update({
      where: { id: tenantId },
      data: { status: parsed.data.status, suspendedAt: parsed.data.status === "SUSPENDED" ? new Date() : null },
    });
    if (parsed.data.status === "ACTIVE") await tx.teacherBillingSettings.updateMany({ where: { tenantId, openingFeeStatus: { in: ["PENDING", "SUBMITTED"] } }, data: { openingFeeStatus: "WAIVED", openingFeeActivatedAt: new Date() } });
    await tx.auditLog.create({
      data: { tenantId, actorId: auth.context.user.id, action: "TENANT_STATUS_CHANGED", entityType: "Tenant", entityId: tenantId, before, after: { status: parsed.data.status }, ipHash },
    });
    return updated;
  });
  return NextResponse.json({ ok: true, status: tenant.status });
}
