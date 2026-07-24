import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeSuperAdmin, isSameOrigin } from "@/lib/api-auth";
import { requestFingerprint } from "@/lib/auth";

const updateTenantSchema = z.object({
  name: z.string().min(2).optional(),
  subject: z.string().optional().nullable(),
  status: z.enum(["TRIAL", "ACTIVE", "SUSPENDED", "DISABLED", "ARCHIVED"]).optional(),
  fullName: z.string().min(2).optional(),
  phone: z.string().min(8).optional(),
  email: z.string().optional().nullable(),
  pricePerStudent: z.number().min(0).optional(),
  studentLimit: z.number().min(1).optional(),
  subscriptionStart: z.string().optional().nullable(),
  subscriptionEnd: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
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
      billingSettings: true,
      billingStatements: { orderBy: { createdAt: "desc" }, take: 20 },
      teacherPayments: { orderBy: { paymentDate: "desc" }, take: 20 },
      members: { take: 10, include: { user: { select: { id: true, fullName: true, email: true } } } },
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

  // Billing statistics
  const pricePerStudent = Number(tenant.billingSettings?.pricePerStudent ?? 0);
  const calculatedAmountDue = activeStudents * pricePerStudent;
  const totalPaid = tenant.teacherPayments.reduce((acc, p) => acc + Number(p.amount), 0);

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
    financial: {
      pricePerStudent,
      activeStudents,
      calculatedAmountDue,
      totalPaid,
      outstandingBalance: Math.max(0, calculatedAmountDue - totalPaid),
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
    if (data.name !== undefined || data.subject !== undefined || data.status !== undefined) {
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.subject !== undefined ? { subject: data.subject } : {}),
          ...(data.status ? { status: data.status, suspendedAt: data.status === "SUSPENDED" ? new Date() : null } : {}),
        },
      });
    }

    // 2. Update Owner user info
    if (tenant.ownerId && (data.fullName || data.phone || data.email !== undefined)) {
      await tx.user.update({
        where: { id: tenant.ownerId },
        data: {
          ...(data.fullName ? { fullName: data.fullName } : {}),
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

    // 4. Update Billing Settings
    if (
      data.pricePerStudent !== undefined ||
      data.studentLimit !== undefined ||
      data.subscriptionStart !== undefined ||
      data.subscriptionEnd !== undefined ||
      data.internalNotes !== undefined
    ) {
      await tx.teacherBillingSettings.upsert({
        where: { tenantId },
        create: {
          tenantId,
          pricePerStudent: data.pricePerStudent ?? 0,
          studentLimit: data.studentLimit ?? 100,
          subscriptionStart: data.subscriptionStart ? new Date(data.subscriptionStart) : new Date(),
          subscriptionEnd: data.subscriptionEnd ? new Date(data.subscriptionEnd) : null,
          internalNotes: data.internalNotes || null,
        },
        update: {
          ...(data.pricePerStudent !== undefined ? { pricePerStudent: data.pricePerStudent } : {}),
          ...(data.studentLimit !== undefined ? { studentLimit: data.studentLimit } : {}),
          ...(data.subscriptionStart ? { subscriptionStart: new Date(data.subscriptionStart) } : {}),
          ...(data.subscriptionEnd !== undefined ? { subscriptionEnd: data.subscriptionEnd ? new Date(data.subscriptionEnd) : null } : {}),
          ...(data.internalNotes !== undefined ? { internalNotes: data.internalNotes } : {}),
        },
      });
    }

    // 5. Audit Log
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
