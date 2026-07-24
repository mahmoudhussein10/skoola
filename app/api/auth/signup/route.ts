import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { createSession, requestFingerprint } from "../../../../lib/auth";
import { signupSchema } from "../../../../lib/validation";
import { isSameOrigin } from "../../../../lib/api-auth";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "تحقق من البيانات", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (!parsed.data.tenantSlug) {
    return NextResponse.json({ ok: false, message: "رابط المدرس مطلوب لإتمام التسجيل. يرجى الحصول على رابط التسجيل من مدرسك." }, { status: 400 });
  }

  const settings = await prisma.platformSettings.upsert({ where: { id: "default" }, update: {}, create: {} });
  if (!settings.registrationEnabled) return NextResponse.json({ ok: false, message: "التسجيل مغلق حاليًا" }, { status: 403 });

  const tenant = await prisma.tenant.findUnique({
    where: { slug: parsed.data.tenantSlug },
    select: { id: true, slug: true, status: true },
  });
  if (!tenant || tenant.status === "SUSPENDED" || tenant.status === "DISABLED" || tenant.status === "ARCHIVED") {
    return NextResponse.json({ ok: false, message: "المدرس غير موجود أو حسابه غير متاح حاليًا" }, { status: 404 });
  }

  const { ipHash } = await requestFingerprint();
  const recent = await prisma.loginAttempt.count({ where: { ipHash, identifier: "signup", createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } });
  if (recent >= 5) return NextResponse.json({ ok: false, message: "تم تجاوز عدد محاولات التسجيل المسموح" }, { status: 429 });
  await prisma.loginAttempt.create({ data: { identifier: "signup", ipHash, successful: true } });

  try {
    const passwordHash = await hash(parsed.data.password, 12);
    const user = await prisma.$transaction(async (tx) => {
      return tx.user.create({
        data: {
          fullName: parsed.data.fullName,
          username: parsed.data.username,
          email: parsed.data.email || null,
          phone: parsed.data.phone,
          passwordHash,
          role: "STUDENT",
          status: settings.requireAdminApproval ? "PENDING" : "ACTIVE",
          memberships: { create: { tenantId: tenant.id, role: "STUDENT", status: "ACTIVE" } },
          studentProfiles: {
            create: {
              tenantId: tenant.id,
              parentPhone: parsed.data.parentPhone,
              grade: parsed.data.grade,
              governorate: parsed.data.governorate,
            },
          },
        },
      });
    });

    if (user.status === "ACTIVE") await createSession(user.id, false, tenant.id);
    return NextResponse.json({ ok: true, pending: user.status === "PENDING", redirectTo: user.status === "ACTIVE" ? `/t/${tenant.slug}` : "/login" });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: false, message: "اسم المستخدم أو البريد أو الهاتف مسجل بالفعل" }, { status: 409 });
    }
    throw error;
  }
}
