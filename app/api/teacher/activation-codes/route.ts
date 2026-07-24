import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeTenant, isSameOrigin } from "../../../../lib/api-auth";
import { hashToken, requestFingerprint } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

const schema = z.object({ label: z.string().trim().max(80), courseId: z.string().min(1).nullable(), count: z.number().int().min(1).max(50), maxUses: z.number().int().min(1).max(1000), expiresAt: z.coerce.date().nullable() });

function rawCode() {
  return randomBytes(9).toString("base64url").toUpperCase().match(/.{1,4}/g)!.join("-");
}

export async function POST(request: Request) {
  const auth = await authorizeTenant("activationCodes.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (parsed.data.expiresAt && parsed.data.expiresAt <= new Date())) return NextResponse.json({ ok: false, message: "تحقق من بيانات الأكواد وتاريخ الانتهاء" }, { status: 400 });
  const tenantId = auth.context.membership.tenantId;
  if (parsed.data.courseId) {
    const owned = await prisma.course.findFirst({ where: { id: parsed.data.courseId, tenantId }, select: { id: true } });
    if (!owned) return NextResponse.json({ ok: false, message: "الكورس غير موجود داخل منصتك" }, { status: 404 });
  }
  const codes = Array.from({ length: parsed.data.count }, rawCode);
  const { ipHash } = await requestFingerprint();
  await prisma.$transaction(async (tx) => {
    await tx.activationCode.createMany({ data: codes.map((code) => ({ tenantId, courseId: parsed.data.courseId, codeHash: hashToken(code), label: parsed.data.label || null, maxUses: parsed.data.maxUses, expiresAt: parsed.data.expiresAt })) });
    await tx.auditLog.create({ data: { tenantId, actorId: auth.context.user.id, action: "ACTIVATION_CODES_CREATED", entityType: "ActivationCode", metadata: { count: codes.length, courseId: parsed.data.courseId, expiresAt: parsed.data.expiresAt?.toISOString() }, ipHash } });
  });
  return NextResponse.json({ ok: true, codes }, { status: 201 });
}