import Link from "next/link";
import { Banknote, Clock3, CreditCard, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { DashboardShell } from "@/app/dashboard-shell";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminSubscriptionControls } from "./admin-controls";
import { SubscriptionReviewActions } from "./review-actions";
import styles from "./subscriptions.module.css";

const labels: Record<string, string> = {
  PENDING: "قيد المراجعة", NEEDS_REVIEW: "مطلوب إيصال أوضح", APPROVED: "مقبول", REJECTED: "مرفوض", CANCELLED: "ملغي", EXPIRED: "منتهي",
  TRIALING: "تجربة مجانية", ACTIVE: "اشتراك نشط", GRACE_PERIOD: "فترة سماح", PAST_DUE: "متأخر",
  MONTHLY: "شهري", QUARTERLY: "3 شهور", SEMIANNUAL: "6 شهور", ANNUAL: "سنوي", CUSTOM: "مخصص",
  VODAFONE_CASH: "فودافون كاش", INSTAPAY: "إنستا باي", NEW_SUBSCRIPTION: "اشتراك جديد", RENEWAL: "تجديد", UPGRADE: "ترقية فورية", DOWNGRADE: "تخفيض لاحق",
};
const filters = [["ALL", "الكل"], ["TRIALING", "التجارب"], ["EXPIRED_TRIALS", "تجارب منتهية"], ["ACTIVE", "نشطة"], ["GRACE_PERIOD", "فترة السماح"], ["EXPIRED_ACCOUNTS", "منتهية"], ["PENDING_PAYMENTS", "مدفوعات معلقة"]] as const;
type Filter = (typeof filters)[number][0];
const formatDate = (value: Date | null) => value?.toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }) ?? "—";

export default async function SuperAdminSubscriptionsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireSuperAdmin();
  const params = await searchParams;
  const selected: Filter = filters.some(([value]) => value === params.filter) ? params.filter as Filter : "ALL";
  const subscriptionWhere = selected === "TRIALING" || selected === "ACTIVE" || selected === "GRACE_PERIOD" ? { status: selected } : selected === "EXPIRED_TRIALS" ? { status: "EXPIRED" as const, currentPeriodStart: null } : selected === "EXPIRED_ACCOUNTS" ? { status: "EXPIRED" as const, currentPeriodStart: { not: null } } : {};
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [subscriptions, requests, settings, plans, tenants, activeCount, trialCount, graceCount, expiredCount, pendingCount, revenue] = await Promise.all([
    selected === "PENDING_PAYMENTS" ? Promise.resolve([]) : prisma.tenantSubscription.findMany({ where: subscriptionWhere, include: { plan: { select: { name: true, code: true } }, pendingPlan: { select: { name: true } }, tenant: { select: { name: true, slug: true, status: true, owner: { select: { fullName: true, phone: true } } } } }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.subscriptionPaymentRequest.findMany({ where: selected === "PENDING_PAYMENTS" ? { status: { in: ["PENDING", "NEEDS_REVIEW"] } } : undefined, include: { tenant: { select: { name: true, slug: true, owner: { select: { fullName: true, phone: true } } } }, requestedPlan: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.platformSettings.upsert({ where: { id: "default" }, update: {}, create: {} }),
    prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.tenant.findMany({ where: { owner: { isNot: null } }, select: { id: true, name: true, owner: { select: { fullName: true } } }, orderBy: { name: "asc" } }),
    prisma.tenantSubscription.count({ where: { status: "ACTIVE" } }), prisma.tenantSubscription.count({ where: { status: "TRIALING" } }), prisma.tenantSubscription.count({ where: { status: "GRACE_PERIOD" } }), prisma.tenantSubscription.count({ where: { status: "EXPIRED" } }),
    prisma.subscriptionPaymentRequest.count({ where: { status: { in: ["PENDING", "NEEDS_REVIEW"] } } }),
    prisma.subscriptionPaymentRequest.aggregate({ where: { status: "APPROVED", reviewedAt: { gte: monthStart } }, _sum: { amount: true } }),
  ]);
  const config = { billingVodafoneCashEnabled: settings.billingVodafoneCashEnabled, billingVodafoneCashNumber: settings.billingVodafoneCashNumber ?? "", billingInstaPayEnabled: settings.billingInstaPayEnabled, billingInstaPayAddress: settings.billingInstaPayAddress ?? "", billingAccountName: settings.billingAccountName ?? "", billingPaymentInstructions: settings.billingPaymentInstructions ?? "", subscriptionTrialHours: settings.subscriptionTrialHours, subscriptionGraceDays: settings.subscriptionGraceDays, subscriptionQuarterlyDiscount: Number(settings.subscriptionQuarterlyDiscount), subscriptionSemiannualDiscount: Number(settings.subscriptionSemiannualDiscount), subscriptionAnnualBilledMonths: settings.subscriptionAnnualBilledMonths };

  return <DashboardShell kind="super" title="اشتراكات المدرسين" subtitle="متابعة دورة الاشتراك والتحويلات وحدود الخطط من مكان واحد" userName={user.fullName}>
    <section className={styles.summary} aria-label="ملخص الاشتراكات والإيرادات">
      <SummaryCard icon={<ShieldCheck />} label="اشتراكات نشطة" value={activeCount} tone="green"/><SummaryCard icon={<Clock3 />} label="تجارب جارية" value={trialCount} tone="blue"/><SummaryCard icon={<TriangleAlert />} label="فترة السماح" value={graceCount} tone="amber"/><SummaryCard icon={<Users />} label="حسابات منتهية" value={expiredCount} tone="red"/><SummaryCard icon={<CreditCard />} label="مدفوعات تنتظر" value={pendingCount} tone="violet"/><SummaryCard icon={<Banknote />} label="إيراد الشهر المعتمد" value={`${Number(revenue._sum.amount ?? 0).toLocaleString("ar-EG")} ج.م`} tone="navy"/>
    </section>
    <nav className={styles.filters} aria-label="تصفية الاشتراكات">{filters.map(([value, label]) => <Link key={value} href={value === "ALL" ? "/super-admin/subscriptions" : `/super-admin/subscriptions?filter=${value}`} className={selected === value ? styles.activeFilter : undefined}>{label}</Link>)}</nav>
    <AdminSubscriptionControls config={config} plans={plans.map(plan => ({ id: plan.id, code: plan.code, name: plan.name, monthlyPrice: plan.monthlyPrice == null ? null : Number(plan.monthlyPrice), activeStudentLimit: plan.activeStudentLimit, storageLimitGb: plan.storageLimitGb, isActive: plan.isActive, isCustom: plan.isCustom }))} tenants={tenants.map(tenant => ({ id: tenant.id, name: tenant.name, ownerName: tenant.owner?.fullName ?? "بدون مالك" }))}/>
    {selected !== "PENDING_PAYMENTS" ? <section className={`saasPanel pagePanel ${styles.panel}`}><div className="panelTitle"><h3>حالات الأكاديميات</h3><span>{subscriptions.length.toLocaleString("ar-EG")} أكاديمية</span></div>{subscriptions.length ? <div className={styles.accountList}>{subscriptions.map(subscription => <article key={subscription.id}><header><div><b>{subscription.tenant.name}</b><small>{subscription.tenant.owner?.fullName ?? "بدون مالك"} · /{subscription.tenant.slug}</small></div><span className={`${styles.status} ${styles[subscription.status.toLowerCase()]}`}>{labels[subscription.status] ?? subscription.status}</span></header><dl><div><dt>الخطة</dt><dd>{subscription.plan.name}</dd></div><div><dt>دورة الدفع</dt><dd>{labels[subscription.billingCycle] ?? subscription.billingCycle}</dd></div><div><dt>بداية الاشتراك</dt><dd>{formatDate(subscription.currentPeriodStart ?? subscription.trialStartedAt)}</dd></div><div><dt>نهاية الاشتراك</dt><dd>{formatDate(subscription.currentPeriodEnd ?? subscription.trialEndsAt)}</dd></div></dl>{subscription.status === "GRACE_PERIOD" ? <p className={styles.warning}>تنتهي فترة السماح: {formatDate(subscription.gracePeriodEndsAt)}</p> : null}{subscription.pendingPlan ? <p className={styles.info}>تخفيض مجدول إلى {subscription.pendingPlan.name} في {formatDate(subscription.pendingDowngradeAt)}</p> : null}<Link className={styles.detailsLink} href={`/super-admin/teachers/${subscription.tenantId}`}>فتح بيانات المدرس</Link></article>)}</div> : <div className="compactEmpty">لا توجد أكاديميات مطابقة لهذا الفلتر.</div>}</section> : null}
    <section className={`saasPanel pagePanel ${styles.panel}`}><div className="panelTitle"><h3>طلبات دفع الاشتراكات</h3><span>{requests.length.toLocaleString("ar-EG")} طلب</span></div>{requests.length ? <div className={styles.list}>{requests.map(request => <article key={request.id}><header><div><b>{request.tenant.name}</b><small>{request.tenant.owner?.fullName ?? "بدون مالك"} · {request.tenant.owner?.phone ?? request.tenant.slug}</small></div><span className={`${styles.status} ${styles[request.status.toLowerCase()]}`}>{labels[request.status] ?? request.status}</span></header><dl><div><dt>الخطة والمدة</dt><dd>{request.requestedPlan.name} · {labels[request.billingCycle]}</dd></div><div><dt>نوع الطلب</dt><dd>{labels[request.changeType] ?? request.changeType}</dd></div><div><dt>المبلغ النهائي</dt><dd>{Number(request.amount).toLocaleString("ar-EG")} ج.م</dd></div><div><dt>وسيلة الدفع</dt><dd>{request.paymentMethod ? labels[request.paymentMethod] : "غير محدد"}</dd></div><div><dt>من</dt><dd>{formatDate(request.periodStart)}</dd></div><div><dt>إلى</dt><dd>{formatDate(request.periodEnd)}</dd></div><div><dt>تاريخ الطلب</dt><dd>{formatDate(request.createdAt)}</dd></div></dl>{request.referenceNumber ? <p>رقم العملية: <b dir="ltr">{request.referenceNumber}</b></p> : null}{request.proofUrl ? <a className={styles.receipt} href={request.proofUrl} target="_blank" rel="noreferrer">عرض إيصال التحويل</a> : null}{request.rejectionReason ? <p className={styles.reason}>{request.rejectionReason}</p> : null}<SubscriptionReviewActions requestId={request.id} status={request.status}/></article>)}</div> : <div className="compactEmpty">لا توجد طلبات اشتراك مطابقة.</div>}</section>
  </DashboardShell>;
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: string }) { return <article className={styles[tone]}><span>{icon}</span><div><small>{label}</small><strong>{typeof value === "number" ? value.toLocaleString("ar-EG") : value}</strong></div></article>; }
