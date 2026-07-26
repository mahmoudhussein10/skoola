import { DashboardShell } from "../../dashboard-shell";
import { requireTenantMember } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { ensureTenantMonthlyStatement } from "../../../lib/platform-billing";
import { TeacherBillingClient } from "./teacher-billing-client";

export const metadata = { title: "فواتير اشتراك المنصة" };
export const dynamic = "force-dynamic";

export default async function TeacherBillingPage() {
  const context = await requireTenantMember(["TEACHER_OWNER", "TEACHER_ADMIN"]);
  const tenantId = context.membership.tenantId;
  await ensureTenantMonthlyStatement(tenantId);
  const [platform, statements] = await Promise.all([
    prisma.platformSettings.upsert({ where: { id: "default" }, update: {}, create: {} }),
    prisma.billingStatement.findMany({
      where: { tenantId },
      include: {
        payments: { orderBy: { paymentDate: "desc" } },
        paymentSubmissions: { orderBy: { createdAt: "desc" } },
      },
      orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
      take: 24,
    }),
  ]);

  const serialized = statements.map((statement) => ({
    id: statement.id,
    statementNumber: statement.statementNumber,
    periodStart: statement.periodStart.toISOString(),
    periodEnd: statement.periodEnd.toISOString(),
    billableStudents: statement.billableStudents,
    pricePerStudent: Number(statement.pricePerStudent),
    finalAmount: Number(statement.finalAmount),
    paidAmount: Number(statement.paidAmount),
    status: statement.status,
    dueDate: statement.dueDate.toISOString(),
    submissions: statement.paymentSubmissions.map((submission) => ({
      id: submission.id,
      amount: Number(submission.amount),
      paymentMethod: submission.paymentMethod,
      referenceNumber: submission.referenceNumber,
      status: submission.status,
      rejectionReason: submission.rejectionReason,
      createdAt: submission.createdAt.toISOString(),
    })),
  }));

  return <DashboardShell kind="teacher" title="فواتير اشتراك المنصة" subtitle="تابع الفاتورة الشهرية وسجّل تحويلك إلى إدارة Skoola" userName={context.user.fullName} tenantSlug={context.membership.tenant.slug} supportMode={context.supportMode}>
    <TeacherBillingClient
      canSubmit={context.membership.role === "TEACHER_OWNER"}
      platform={{
        pricePerStudent: Number(platform.defaultTeacherPricePerStudent),
        vodafoneEnabled: platform.billingVodafoneCashEnabled,
        vodafoneNumber: platform.billingVodafoneCashNumber,
        instaPayEnabled: platform.billingInstaPayEnabled,
        instaPayAddress: platform.billingInstaPayAddress,
        accountName: platform.billingAccountName,
        instructions: platform.billingPaymentInstructions,
      }}
      statements={serialized}
    />
  </DashboardShell>;
}