import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorizeSuperAdmin, isSameOrigin } from "@/lib/api-auth";
import { requestFingerprint } from "@/lib/auth";

const updateTenantSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  subject: z.string().optional().nullable(),
  status: z.enum(["TRIAL", "ACTIVE", "SUSPENDED", "DISABLED", "ARCHIVED"]).optional(),
  fullName: z.string().min(2).optional(),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/).optional(),
  phone: z.string().min(8).optional(),
  email: z.string().optional().nullable(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;

  const { tenantId } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      owner: { select: { id: true, fullName: true, username: true, email: true, phone: true, lastLoginAt: true, createdAt: true } },
      theme: true,
      settings: true,
      billingSettings: true,      members: { take: 10, include: { user: { select: { id: true, fullName: true, email: true } } } },
      auditLogs: { include: { actor: { select: { fullName: true } } }, orderBy: { createdAt: "desc" }, take: 10 },
      _count: {
        select: {
          members: true,
          courses: true,
          lessons: true,
          exams: true,
          assignments: true,
          activationCodes: true,
          enrollments: true,
        },
      },
    },
  });

  if (!tenant) return NextResponse.json({ ok: false, message: "المنصة غير موجودة" }, { status: 404 });

  // Calculate student statistics
  const [totalStudents, activeStudents, inactiveStudents, totalVideos, usedCodes, availableCodes] = await Promise.all([
    prisma.tenantMember.count({ where: { tenantId, role: "STUDENT" } }),
    prisma.tenantMember.count({ where: { tenantId, role: "STUDENT", status: "ACTIVE" } }),
    prisma.tenantMember.count({ where: { tenantId, role: "STUDENT", status: { not: "ACTIVE" } } }),
    prisma.lesson.count({ where: { tenantId, videoId: { not: null } } }),
    prisma.activationCode.count({ where: { tenantId, usedCount: { gt: 0 } } }),
    prisma.activationCode.count({ where: { tenantId, status: "ACTIVE" } }),
  ]);


  return NextResponse.json({
    ok: true,
    tenant,
    stats: {
      totalStudents,
      activeStudents,
      inactiveStudents,
      totalCourses: tenant._count.courses,
      totalLessons: tenant._count.lessons,
      totalVideos,
      totalExams: tenant._count.exams,
      totalAssignments: tenant._count.assignments,
      totalActivationCodes: tenant._count.activationCodes,
      usedCodes,
      availableCodes,
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });

  const { tenantId } = await params;
  const json = await request.json().catch(() => null);
  const parsed = updateTenantSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "بيانات غير صالحة" }, { status: 400 });

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { owner: true } });
  if (!tenant) return NextResponse.json({ ok: false, message: "المنصة غير موجودة" }, { status: 404 });

  const data = parsed.data;
  const { ipHash } = await requestFingerprint();

  await prisma.$transaction(async (tx) => {
    // 1. Update Tenant basic info
    if (data.name !== undefined || data.slug !== undefined || data.subject !== undefined || data.status !== undefined) {
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.slug ? { slug: data.slug } : {}),
          ...(data.subject !== undefined ? { subject: data.subject } : {}),
          ...(data.status ? { status: data.status, suspendedAt: data.status === "SUSPENDED" ? new Date() : null } : {}),
        },
      });
    }

    // 2. Update Owner user info
    if (tenant.ownerId && (data.fullName || data.username || data.phone || data.email !== undefined)) {
      await tx.user.update({
        where: { id: tenant.ownerId },
        data: {
          ...(data.fullName ? { fullName: data.fullName } : {}),
          ...(data.username ? { username: data.username } : {}),
          ...(data.phone ? { phone: data.phone } : {}),
          ...(data.email !== undefined ? { email: data.email || null } : {}),
        },
      });
    }

    // 3. Update Theme
    if (data.primaryColor || data.secondaryColor) {
      await tx.themeSettings.upsert({
        where: { tenantId },
        create: {
          tenantId,
          primaryColor: data.primaryColor ?? "#1565f5",
          secondaryColor: data.secondaryColor ?? "#081b3a",
        },
        update: {
          ...(data.primaryColor ? { primaryColor: data.primaryColor } : {}),
          ...(data.secondaryColor ? { secondaryColor: data.secondaryColor } : {}),
        },
      });
    }


    // Audit Log
    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: auth.context.user.id,
        action: "TENANT_UPDATED_BY_SUPER_ADMIN",
        entityType: "Tenant",
        entityId: tenantId,
        metadata: JSON.parse(JSON.stringify(data)),
        ipHash,
      },
    });
  });

  return NextResponse.json({ ok: true, message: "تم تحديث بيانات المنصة والمالك بنجاح" });
}


const deleteTenantSchema = z.object({
  confirmSlug: z.string(),
  confirmText: z.literal("حذف نهائي"),
});

export async function DELETE(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const parsed = deleteTenantSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "اكتب رابط المنصة وعبارة حذف نهائي للتأكيد" }, { status: 400 });
  const { tenantId } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { owner: { select: { id: true, fullName: true, role: true } }, _count: { select: { members: true, courses: true } } },
  });
  if (!tenant) return NextResponse.json({ ok: false, message: "المنصة غير موجودة" }, { status: 404 });
  if (parsed.data.confirmSlug !== tenant.slug) return NextResponse.json({ ok: false, message: "رابط المنصة غير مطابق" }, { status: 400 });
  const { ipHash } = await requestFingerprint();
  const ownerId = tenant.owner?.id ?? null;
  try {
    const teacherDeleted = await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({ data: {
        actorId: auth.context.user.id,
        action: "TENANT_PERMANENTLY_DELETED",
        entityType: "Tenant",
        entityId: tenant.id,
        metadata: { tenantName: tenant.name, slug: tenant.slug, teacherName: tenant.owner?.fullName, members: tenant._count.members, courses: tenant._count.courses },
        ipHash,
      } });
      await tx.tenant.delete({ where: { id: tenant.id } });
      if (!ownerId || tenant.owner?.role !== "TEACHER_OWNER") return false;
      const linkedElsewhere = await tx.tenantMember.count({ where: { userId: ownerId } });
      const ownsAnotherTenant = await tx.tenant.count({ where: { ownerId } });
      if (linkedElsewhere || ownsAnotherTenant) return false;
      await tx.user.delete({ where: { id: ownerId } });
      return true;
    });
    return NextResponse.json({ ok: true, teacherDeleted });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) console.error("Teacher deletion failed:", error.code);
    return NextResponse.json({ ok: false, message: "تعذر الحذف النهائي بسبب بيانات مرتبطة. لم يتم حذف أي جزء." }, { status: 409 });
  }
}
