import { DashboardShell } from "@/app/dashboard-shell";
import { requireTeacherSubscriptionContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tenantStaffRoles } from "@/lib/permissions";
import { getSubscriptionPlansWithQuotes, getTenantSubscriptionSnapshot, subscriptionAllowsDashboard } from "@/lib/subscriptions";
import { SubscriptionManager, type PaymentSettingsView, type PaymentView, type PlanView, type SubscriptionView } from "./subscription-client";

export default async function TeacherSubscriptionPage() {
  const context = await requireTeacherSubscriptionContext(tenantStaffRoles);
  const tenantId = context.membership.tenantId;
  const [snapshot, plans, payments, settings] = await Promise.all([
    getTenantSubscriptionSnapshot(tenantId),
    getSubscriptionPlansWithQuotes(tenantId),
    prisma.subscriptionPaymentRequest.findMany({ where: { tenantId }, include: { requestedPlan: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 24 }),
    prisma.platformSettings.upsert({ where: { id: "default" }, update: {}, create: {} }),
  ]);
  if (!snapshot) throw new Error("SUBSCRIPTION_NOT_FOUND");
  const blocked = !subscriptionAllowsDashboard(snapshot.effectiveStatus);
  const subscription: SubscriptionView = {
    status: snapshot.effectiveStatus,
    planName: snapshot.subscription.plan.name,
    planCode: snapshot.subscription.plan.code,
    trialEndsAt: snapshot.subscription.trialEndsAt.toISOString(),
    currentPeriodEnd: snapshot.subscription.currentPeriodEnd?.toISOString() ?? null,
    trialOfferDismissedAt: snapshot.subscription.trialOfferDismissedAt?.toISOString() ?? null,
    activeStudents: snapshot.usage.activeStudents,
    activeStudentLimit: snapshot.limits.activeStudents,
    storageGb: Math.round(Number(snapshot.usage.storageBytes) / 1024 / 1024 / 1024 * 100) / 100,
    storageLimitGb: snapshot.subscription.storageLimitGb,
  };
  const planViews: PlanView[] = plans.map((plan) => ({ ...plan, quotes: plan.quotes.map((quote) => ({ ...quote, billingCycle: quote.billingCycle })) })) as PlanView[];
  const paymentViews: PaymentView[] = payments.map((payment) => ({
    id: payment.id, status: payment.status, amount: Number(payment.amount), originalAmount: Number(payment.originalAmount), discountAmount: Number(payment.discountAmount),
    billingCycle: payment.billingCycle, paymentMethod: payment.paymentMethod, createdAt: payment.createdAt.toISOString(), reviewedAt: payment.reviewedAt?.toISOString() ?? null,
    rejectionReason: payment.rejectionReason, planName: payment.requestedPlan.name,
  }));
  const paymentSettings: PaymentSettingsView = {
    vodafoneCashEnabled: settings.billingVodafoneCashEnabled,
    vodafoneCashNumber: settings.billingVodafoneCashNumber,
    instaPayEnabled: settings.billingInstaPayEnabled,
    instaPayAddress: settings.billingInstaPayAddress,
    accountName: settings.billingAccountName,
    instructions: settings.billingPaymentInstructions,
    supportPhone: settings.supportPhone,
    supportWhatsApp: settings.supportWhatsApp,
    supportEmail: settings.supportEmail,
  };
  const manager = <SubscriptionManager subscription={subscription} plans={planViews} payments={paymentViews} paymentSettings={paymentSettings} canManage={context.membership.role === "TEACHER_OWNER" || context.membership.role === "TEACHER_ADMIN"} blocked={blocked} />;
  if (blocked) return manager;
  return <DashboardShell kind="teacher" title="اشتراك Skoola" subtitle="الخطة، الاستخدام، التجديد والمدفوعات" userName={context.user.fullName} tenantSlug={context.membership.tenant.slug} supportMode={context.supportMode}>{manager}</DashboardShell>;
}