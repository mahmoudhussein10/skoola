import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { createSession, requestFingerprint } from "../../../../lib/auth";
import { isSameOrigin } from "../../../../lib/api-auth";
import { teacherSignupSchema } from "../../../../lib/validation";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const parsed = teacherSignupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "تحقق من البيانات", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const platform = await prisma.platformSettings.upsert({ where: { id: "default" }, update: {}, create: {} });
  if (!platform.teacherRegistrationEnabled) {
    return NextResponse.json({ ok: false, message: "تسجيل المدرسين مغلق حاليًا" }, { status: 403 });
  }
  const { ipHash } = await requestFingerprint();
  const attempts = await prisma.loginAttempt.count({
    where: { ipHash, identifier: "teacher-signup", createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (attempts >= 3) return NextResponse.json({ ok: false, message: "محاولات كثيرة. حاول لاحقًا" }, { status: 429 });
  const signupAttempt = await prisma.loginAttempt.create({ data: { identifier: "teacher-signup", ipHash, successful: false } });

  try {
    const passwordHash = await hash(parsed.data.password, 12);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: parsed.data.fullName,
          username: parsed.data.username,
          email: parsed.data.email,
          phone: parsed.data.phone,
          passwordHash,
          role: "TEACHER_OWNER",
          status: "ACTIVE",
        },
      });
      const tenant = await tx.tenant.create({
        data: {
          name: parsed.data.platformName,
          slug: parsed.data.slug,
          subject: parsed.data.subject,
          ownerId: user.id,
          status: platform.defaultTenantStatus,
          members: { create: { userId: user.id, role: "TEACHER_OWNER", status: "ACTIVE" } },
          theme: { create: { primaryColor: "#1565f5", secondaryColor: "#081b3a", accentColor: "#7b2ff7", backgroundColor: "#f8fafc", surfaceColor: "#ffffff", textColor: "#0f172a", mutedColor: "#64748b", preset: "SKOOLA" } },
          settings: { create: { platformName: parsed.data.platformName, locale: "ar-EG", timezone: "Africa/Cairo", publicPageLive: true } },
        },
      });
      await tx.auditLog.create({
        data: { tenantId: tenant.id, actorId: user.id, action: "TENANT_CREATED", entityType: "Tenant", entityId: tenant.id, ipHash },
      });
      return { user, tenant };
    });
    await prisma.loginAttempt.update({ where: { id: signupAttempt.id }, data: { successful: true, userId: result.user.id } });
    await createSession(result.user.id, false, result.tenant.id);
    return NextResponse.json({ ok: true, redirectTo: "/teacher/onboarding" }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: false, message: "الرابط أو البريد أو اسم المستخدم أو الهاتف مستخدم بالفعل" }, { status: 409 });
    }
    throw error;
  }
}
