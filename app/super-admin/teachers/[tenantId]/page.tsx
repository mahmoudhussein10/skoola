import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/prisma";
import { requireSuperAdmin } from "../../../../lib/auth";
import { DashboardShell } from "../../../dashboard-shell";
import { TeacherDetailClient } from "./teacher-detail-client";
import { TeacherAccountManager } from "./teacher-account-manager";

export default async function TenantDetails({ params }: { params: Promise<{ tenantId: string }> }) {
  const user = await requireSuperAdmin();
  const { tenantId } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      owner: { select: { id: true, fullName: true, email: true, username: true, phone: true, lastLoginAt: true, createdAt: true } },
      theme: true,
      settings: true,
      billingSettings: true,
      billingStatements: {
        include: { payments: true },
        orderBy: { createdAt: "desc" },
      },
      teacherPayments: {
        orderBy: { paymentDate: "desc" },
      },
      members: {
        take: 10,
        include: { user: { select: { id: true, fullName: true, email: true, phone: true } } },
      },
      auditLogs: {
        include: { actor: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
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

  if (!tenant) notFound();

  // Aggregate stats
  const [totalStudents, activeStudents, inactiveStudents, totalVideos, usedCodes, availableCodes] = await Promise.all([
    prisma.tenantMember.count({ where: { tenantId, role: "STUDENT" } }),
    prisma.tenantMember.count({ where: { tenantId, role: "STUDENT", status: "ACTIVE" } }),
    prisma.tenantMember.count({ where: { tenantId, role: "STUDENT", status: { not: "ACTIVE" } } }),
    prisma.lesson.count({ where: { tenantId, videoId: { not: null } } }),
    prisma.activationCode.count({ where: { tenantId, usedCount: { gt: 0 } } }),
    prisma.activationCode.count({ where: { tenantId, status: "ACTIVE" } }),
  ]);

  const pricePerStudent = Number(tenant.billingSettings?.pricePerStudent ?? 15);
  const calculatedAmountDue = activeStudents * pricePerStudent;
  const totalPaid = tenant.billingStatements.reduce((acc, statement) => acc + Number(statement.paidAmount), 0);
  const outstandingBalance = tenant.billingStatements.reduce(
    (acc, statement) => acc + Math.max(0, Number(statement.finalAmount) - Number(statement.paidAmount)),
    0,
  );

  const stats = {
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
  };

  const financial = {
    pricePerStudent,
    activeStudents,
    calculatedAmountDue,
    totalPaid,
    outstandingBalance,
  };

  const serializableTenant = JSON.parse(JSON.stringify(tenant));

  return (
    <DashboardShell kind="super" title={`منصة ${tenant.name}`} subtitle={`الملف الشامل للمدرس والمنصة · /t/${tenant.slug}`} userName={user.fullName}>
      <TeacherAccountManager tenant={serializableTenant} />
      <TeacherDetailClient tenant={serializableTenant} stats={stats} financial={financial} />
    </DashboardShell>
  );
}
