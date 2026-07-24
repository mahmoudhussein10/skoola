import { requirePermission } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { DashboardShell } from "../../dashboard-shell";
import { TeacherPaymentsClient } from "./teacher-payments-client";

export default async function TeacherPaymentsPage() {
  const context = await requirePermission("students.view");
  const tenantId = context.membership.tenantId;

  const [payments, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    prisma.payment.findMany({
      where: { tenantId },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            studentProfiles: {
              where: { tenantId },
              select: { grade: true, parentPhone: true },
            },
          },
        },
        course: { select: { id: true, title: true, price: true, slug: true } },
        reviewedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.payment.count({ where: { tenantId, status: "PENDING" } }),
    prisma.payment.count({ where: { tenantId, status: "APPROVED" } }),
    prisma.payment.count({ where: { tenantId, status: "REJECTED" } }),
  ]);

  const formattedPayments = payments.map((p) => ({
    id: p.id,
    studentName: p.student.fullName,
    studentPhone: p.student.phone,
    grade: p.student.studentProfiles[0]?.grade ?? "—",
    courseId: p.course.id,
    courseTitle: p.course.title,
    amount: Number(p.amount),
    paymentMethod: p.paymentMethod,
    referenceNumber: p.referenceNumber,
    proofUrl: p.proofUrl,
    status: p.status,
    rejectionReason: p.rejectionReason,
    reviewerName: p.reviewedBy?.fullName ?? null,
    createdAt: p.createdAt.toISOString(),
    reviewedAt: p.reviewedAt?.toISOString() ?? null,
  }));

  return (
    <DashboardShell
      kind="teacher"
      title="طلبات الدفع والاشتراكات"
      subtitle="مراجعة واعتماد عمليات تحويل فودافون كاش وإنستاباي والتحويل البنكي"
      userName={context.user.fullName}
      tenantSlug={context.membership.tenant.slug}
      supportMode={context.supportMode}
    >
      <TeacherPaymentsClient
        initialPayments={formattedPayments}
        stats={{
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
        }}
      />
    </DashboardShell>
  );
}
