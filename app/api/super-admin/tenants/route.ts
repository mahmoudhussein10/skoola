import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import type { Prisma, TenantStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorizeSuperAdmin, isSameOrigin } from "@/lib/api-auth";
import { requestFingerprint } from "@/lib/auth";

const createTenantSchema = z.object({
  fullName: z.string().min(2, "اسم المدرس مطلوب"),
  phone: z.string().min(8, "رقم الهاتف غير صحيح"),
  emailOrUsername: z.string().min(3, "اسم المستخدم أو البريد مطلوب"),
  tempPassword: z.string().min(6, "كلمة المرور المؤقتة لا تقل عن 6 أحرف"),
  subject: z.string().optional(),
  name: z.string().min(2, "اسم المنصة مطلوب"),
  slug: z.string().min(2, "الرابط الفريد مطلوب").regex(/^[a-z0-9-]+$/, "الرابط يجب أن يحتوي على حروف إنجليزية وأرقام وشرطات فقط"),
  avatarUrl: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  primaryColor: z.string().optional().default("#1565f5"),
  secondaryColor: z.string().optional().default("#081b3a"),
  subscriptionStart: z.string().optional(),
  subscriptionEnd: z.string().optional().nullable(),
  pricePerStudent: z.number().min(0).default(0),
  studentLimit: z.number().min(1).default(100),
  status: z.enum(["TRIAL", "ACTIVE", "SUSPENDED", "DISABLED", "ARCHIVED"]).default("ACTIVE"),
  internalNotes: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const status = url.searchParams.get("status");
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));

  const where: Prisma.TenantWhereInput = {};
  if (status && status !== "ALL") {
    where.status = status as TenantStatus;
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { owner: { fullName: { contains: q, mode: "insensitive" } } },
      { owner: { email: { contains: q, mode: "insensitive" } } },
      { owner: { phone: { contains: q } } },
    ];
  }

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: {
        owner: { select: { id: true, fullName: true, email: true, username: true, phone: true, lastLoginAt: true } },
        billingSettings: true,
        _count: { select: { members: true, courses: true, enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tenant.count({ where }),
  ]);

  return NextResponse.json({
    ok: true,
    tenants,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: Request) {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });

  const json = await request.json().catch(() => null);
  const parsed = createTenantSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ ok: false, message: issue ? `${issue.path.join(".")}: ${issue.message}` : "بيانات غير صالحة" }, { status: 400 });
  }

  const data = parsed.data;
  const slugClean = data.slug.toLowerCase().trim();
  const identifier = data.emailOrUsername.toLowerCase().trim();
  const isEmail = identifier.includes("@");

  const existingSlug = await prisma.tenant.findUnique({ where: { slug: slugClean } });
  if (existingSlug) {
    return NextResponse.json({ ok: false, message: "الرابط الفريد (slug) مستخدم بالفعل منصة أخرى" }, { status: 400 });
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: data.phone },
        ...(isEmail ? [{ email: identifier }] : [{ username: identifier }]),
      ],
    },
  });
  if (existingUser) {
    return NextResponse.json({ ok: false, message: "المدرس (رقم الهاتف أو البريد/اسم المستخدم) مسجل بالفعل" }, { status: 400 });
  }

  const passwordHash = await hash(data.tempPassword, 12);
  const { ipHash } = await requestFingerprint();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create teacher User
      const teacherUser = await tx.user.create({
        data: {
          fullName: data.fullName,
          phone: data.phone,
          email: isEmail ? identifier : null,
          username: isEmail ? identifier.split("@")[0] + "_" + Date.now().toString().slice(-4) : identifier,
          passwordHash,
          role: "TEACHER_OWNER",
          status: "ACTIVE",
          avatarUrl: data.avatarUrl,
        },
      });

      // 2. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: data.name,
          slug: slugClean,
          status: data.status,
          ownerId: teacherUser.id,
          subject: data.subject || null,
          logoUrl: data.logoUrl,
          onboardingDone: true,
        },
      });

      // 3. Connect User as TenantMember
      await tx.tenantMember.create({
        data: {
          tenantId: tenant.id,
          userId: teacherUser.id,
          role: "TEACHER_OWNER",
          status: "ACTIVE",
        },
      });

      // 4. Save Theme Settings
      await tx.themeSettings.create({
        data: {
          tenantId: tenant.id,
          primaryColor: data.primaryColor,
          secondaryColor: data.secondaryColor,
        },
      });

      // 5. Save Tenant Settings
      await tx.tenantSettings.create({
        data: {
          tenantId: tenant.id,
          platformName: data.name,
          publicPageLive: true,
        },
      });

      // 6. Save Billing Settings
      await tx.teacherBillingSettings.create({
        data: {
          tenantId: tenant.id,
          pricePerStudent: data.pricePerStudent,
          studentLimit: data.studentLimit,
          subscriptionStart: data.subscriptionStart ? new Date(data.subscriptionStart) : new Date(),
          subscriptionEnd: data.subscriptionEnd ? new Date(data.subscriptionEnd) : null,
          internalNotes: data.internalNotes || null,
        },
      });

      // 7. Audit Log
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorId: auth.context.user.id,
          action: "TEACHER_PLATFORM_CREATED",
          entityType: "Tenant",
          entityId: tenant.id,
          metadata: {
            teacherName: data.fullName,
            platformName: data.name,
            slug: slugClean,
            username: isEmail ? identifier : data.emailOrUsername,
          },
          ipHash,
        },
      });

      return { tenant, teacherUser };
    });

    const publicUrl = `/t/${result.tenant.slug}`;

    return NextResponse.json({
      ok: true,
      platform: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
        publicUrl,
        username: isEmail ? result.teacherUser.email : result.teacherUser.username,
        tempPassword: data.tempPassword,
        teacherName: result.teacherUser.fullName,
      },
    });
  } catch (err: unknown) {
    console.error("Error creating teacher platform:", err);
    const message = err instanceof Error ? err.message : "حدث خطأ أثناء إنشاء منصة المدرس";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
