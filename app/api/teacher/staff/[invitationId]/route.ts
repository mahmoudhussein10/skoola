import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { authorizeTenant, isSameOrigin } from "../../../../../lib/api-auth";

export async function DELETE(request: Request, { params }: { params: Promise<{ invitationId: string }> }) {
  const auth = await authorizeTenant("staff.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const { invitationId } = await params;
  const result = await prisma.staffInvitation.updateMany({ where: { id: invitationId, tenantId: auth.context.membership.tenantId, status: "PENDING" }, data: { status: "REVOKED" } });
  if (!result.count) return NextResponse.json({ ok: false, message: "الدعوة غير موجودة" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
