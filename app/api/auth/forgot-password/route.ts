import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { hashToken, requestFingerprint } from "../../../../lib/auth";
import { isSameOrigin } from "../../../../lib/api-auth";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const { identifier } = await request.json().catch(() => ({ identifier: "" }));
  if (typeof identifier !== "string" || identifier.length < 3) return NextResponse.json({ ok: false, message: "أدخل بريدًا أو رقم هاتف صحيحًا" }, { status: 400 });
  const { ipHash } = await requestFingerprint();
  const recent = await prisma.loginAttempt.count({ where: { ipHash, identifier: "reset", createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } });
  if (recent < 5) {
    const user = await prisma.user.findFirst({ where: { OR: [{ email: identifier.toLowerCase() }, { phone: identifier }] } });
    if (user) {
      const token = randomBytes(32).toString("base64url");
      await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
      if (process.env.NODE_ENV === "development") console.info("Password reset requested; connect an email/SMS provider to deliver the token.");
    }
    await prisma.loginAttempt.create({ data: { identifier: "reset", ipHash, successful: true } });
  }
  return NextResponse.json({ ok: true, message: "إذا كان الحساب موجودًا فستصلك تعليمات الاستعادة" });
}
