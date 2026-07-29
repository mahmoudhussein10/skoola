import { NextResponse } from "next/server";
import { authorizeTeacherSubscription, isSameOrigin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const auth = await authorizeTeacherSubscription();
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const tenantId = auth.context.membership.tenantId;
  const subscription = await prisma.tenantSubscription.findUnique({ where: { tenantId }, select: { id: true, status: true } });
  if (!subscription || subscription.status !== "TRIALING") return NextResponse.json({ ok: false, message: "التجربة المجانية غير نشطة" }, { status: 409 });
  await prisma.tenantSubscription.update({ where: { id: subscription.id }, data: { trialOfferDismissedAt: new Date() } });
  return NextResponse.json({ ok: true });
}