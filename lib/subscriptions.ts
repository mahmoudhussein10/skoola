import "server-only";

import { Prisma, type SubscriptionBillingCycle, type SubscriptionPaymentStatus, type TenantSubscriptionStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { DEFAULT_PRICING_POLICY, PUBLIC_BILLING_CYCLES, activeStudentLimitReached, addMonthsUtc, calculatePolicyPrice, quotePlanChange, resolveLifecycle, storageLimitReached, type PricingPolicy, type PublicBillingCycle } from "./subscription-policy";

export const TRIAL_HOURS = 24;
export const PLAN_CODES = ["STARTER", "GROWTH", "PRO", "ENTERPRISE"] as const;
export const BILLING_CYCLES = PUBLIC_BILLING_CYCLES;
export type PlanCode = (typeof PLAN_CODES)[number];
export type { PublicBillingCycle, PricingPolicy };

export function calculateSubscriptionPrice(monthlyPriceEgp: number, billingCycle: SubscriptionBillingCycle, policy: PricingPolicy = DEFAULT_PRICING_POLICY) {
  if (billingCycle === "CUSTOM") throw new Error("CUSTOM_PRICE_REQUIRED");
  return calculatePolicyPrice(monthlyPriceEgp, billingCycle, policy);
}
export const addUtcMonths = addMonthsUtc;
export function subscriptionPeriod(start: Date, billingCycle: SubscriptionBillingCycle, policy: PricingPolicy = DEFAULT_PRICING_POLICY) {
  if (billingCycle === "CUSTOM") throw new Error("CUSTOM_PERIOD_REQUIRED");
  return { start, end: addMonthsUtc(start, calculatePolicyPrice(0, billingCycle, policy).months) };
}
export function trialWindow(start = new Date(), hours = TRIAL_HOURS) { return { trialStartedAt: start, trialEndsAt: new Date(start.getTime() + hours * 3_600_000) }; }

export async function getSubscriptionPolicy() {
  const settings = await prisma.platformSettings.upsert({ where: { id: "default" }, update: {}, create: {} });
  return { trialHours: settings.subscriptionTrialHours, graceDays: settings.subscriptionGraceDays, pricing: { quarterlyDiscountPercent: Number(settings.subscriptionQuarterlyDiscount), semiannualDiscountPercent: Number(settings.subscriptionSemiannualDiscount), annualBilledMonths: settings.subscriptionAnnualBilledMonths } satisfies PricingPolicy };
}

export function resolveSubscriptionStatus(input: { status: TenantSubscriptionStatus; trialEndsAt: Date; currentPeriodEnd: Date | null; gracePeriodEndsAt: Date | null }, now = new Date(), graceDays = 7): TenantSubscriptionStatus {
  return resolveLifecycle(input, graceDays, now).status;
}
export function subscriptionAllowsDashboard(status: TenantSubscriptionStatus) { return status === "TRIALING" || status === "ACTIVE" || status === "GRACE_PERIOD"; }

async function applyPendingDowngrade(tenantId: string, now: Date) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`);
    const subscription = await tx.tenantSubscription.findUnique({ where: { tenantId } });
    if (!subscription?.pendingPlanId || !subscription.pendingDowngradeAt || subscription.pendingDowngradeAt > now || !subscription.pendingPeriodEnd) return null;
    const updated = await tx.tenantSubscription.update({ where: { id: subscription.id }, data: {
      planId: subscription.pendingPlanId, billingCycle: subscription.pendingBillingCycle ?? subscription.billingCycle,
      baseMonthlyPrice: subscription.pendingBaseMonthlyPrice ?? subscription.baseMonthlyPrice,
      discountPercent: subscription.pendingDiscountPercent ?? subscription.discountPercent,
      billedAmount: subscription.pendingBilledAmount ?? subscription.billedAmount,
      activeStudentLimit: subscription.pendingActiveStudentLimit, storageLimitGb: subscription.pendingStorageLimitGb,
      currentPeriodStart: subscription.pendingDowngradeAt, currentPeriodEnd: subscription.pendingPeriodEnd,
      status: "ACTIVE", gracePeriodEndsAt: null, pendingPlanId: null, pendingBillingCycle: null, pendingDowngradeAt: null,
      pendingPeriodEnd: null, pendingBaseMonthlyPrice: null, pendingDiscountPercent: null, pendingBilledAmount: null,
      pendingActiveStudentLimit: null, pendingStorageLimitGb: null, version: { increment: 1 },
    } });
    await tx.subscriptionEvent.create({ data: { tenantId, subscriptionId: subscription.id, type: "DOWNGRADE_APPLIED", key: `downgrade-applied:${subscription.id}:${subscription.pendingDowngradeAt.toISOString()}`, payload: { appliedAt: now.toISOString(), planId: subscription.pendingPlanId } } }).catch(() => undefined);
    await tx.auditLog.create({ data: { tenantId, action: "SUBSCRIPTION_DOWNGRADE_APPLIED", entityType: "TenantSubscription", entityId: subscription.id, before: { planId: subscription.planId }, after: { planId: subscription.pendingPlanId, currentPeriodEnd: subscription.pendingPeriodEnd } } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function syncTenantSubscriptionState(tenantId: string, now = new Date()) {
  await applyPendingDowngrade(tenantId, now);
  const [current, policy] = await Promise.all([prisma.tenantSubscription.findUnique({ where: { tenantId }, include: { tenant: { select: { status: true } } } }), getSubscriptionPolicy()]);
  if (!current) return null;
  const lifecycle = resolveLifecycle(current, policy.graceDays, now);
  const graceChanged = lifecycle.gracePeriodEndsAt?.getTime() !== current.gracePeriodEndsAt?.getTime();
  if (lifecycle.status === current.status && !graceChanged) return { subscription: current, effectiveStatus: lifecycle.status, tenantStatus: current.tenant.status };
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`);
    const fresh = await tx.tenantSubscription.findUniqueOrThrow({ where: { tenantId }, include: { tenant: { select: { status: true } } } });
    const next = resolveLifecycle(fresh, policy.graceDays, now);
    const freshGraceChanged = next.gracePeriodEndsAt?.getTime() !== fresh.gracePeriodEndsAt?.getTime();
    if (next.status === fresh.status && !freshGraceChanged) return { subscription: fresh, effectiveStatus: next.status, tenantStatus: fresh.tenant.status };
    const subscription = await tx.tenantSubscription.update({ where: { id: fresh.id }, data: { status: next.status, gracePeriodEndsAt: next.gracePeriodEndsAt, version: { increment: 1 } } });
    const shouldSuspend = !subscriptionAllowsDashboard(next.status) && fresh.tenant.status !== "ARCHIVED" && fresh.tenant.status !== "DISABLED";
    let tenantStatus = fresh.tenant.status;
    if (shouldSuspend && fresh.tenant.status !== "SUSPENDED") tenantStatus = (await tx.tenant.update({ where: { id: tenantId }, data: { status: "SUSPENDED", suspendedAt: now } })).status;
    if (next.status === "GRACE_PERIOD" && fresh.tenant.status === "SUSPENDED") tenantStatus = (await tx.tenant.update({ where: { id: tenantId }, data: { status: "ACTIVE", suspendedAt: null } })).status;
    const eventType = fresh.status === "TRIALING" && next.status === "EXPIRED" ? "TRIAL_ENDED" : next.status === "GRACE_PERIOD" ? "GRACE_STARTED" : next.status === "EXPIRED" ? "GRACE_ENDED" : "PLAN_CHANGED";
    const key = `lifecycle:${fresh.id}:${eventType}:${(next.gracePeriodEndsAt ?? fresh.trialEndsAt).toISOString()}`;
    await tx.subscriptionEvent.create({ data: { tenantId, subscriptionId: fresh.id, type: eventType, key, payload: { previousStatus: fresh.status, status: next.status, effectiveAt: now.toISOString() } } }).catch(() => undefined);
    await tx.auditLog.create({ data: { tenantId, action: `SUBSCRIPTION_${eventType}`, entityType: "TenantSubscription", entityId: fresh.id, before: { status: fresh.status }, after: { status: next.status, gracePeriodEndsAt: next.gracePeriodEndsAt } } });
    return { subscription: { ...subscription, tenant: fresh.tenant }, effectiveStatus: next.status, tenantStatus };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createTenantTrial(tenantId: string, actorUserId?: string) {
  const policy = await getSubscriptionPolicy();
  return prisma.$transaction(async (tx) => {
    const plan = await tx.subscriptionPlan.findUniqueOrThrow({ where: { code: "STARTER" } }); const window = trialWindow(new Date(), policy.trialHours); const pricing = calculatePolicyPrice(Number(plan.monthlyPrice), "MONTHLY", policy.pricing);
    const subscription = await tx.tenantSubscription.create({ data: { tenantId, planId: plan.id, status: "TRIALING", billingCycle: "MONTHLY", baseMonthlyPrice: plan.monthlyPrice!, billedAmount: pricing.amountEgp, discountPercent: pricing.discountPercent, activeStudentLimit: plan.activeStudentLimit, storageLimitGb: plan.storageLimitGb, ...window } });
    await tx.subscriptionEvent.create({ data: { tenantId, subscriptionId: subscription.id, actorUserId, type: "TRIAL_STARTED", key: `trial-started:${subscription.id}`, payload: { trialHours: policy.trialHours, planCode: plan.code } } }); return subscription;
  });
}

export async function getActiveStudentsLast30Days(tenantId: string, now = new Date()) {
  const cutoff = new Date(now.getTime() - 30 * 86_400_000);
  return prisma.studentProfile.count({ where: { tenantId, user: { status: "ACTIVE", lastLoginAt: { gte: cutoff } } } });
}
export async function isStudentActiveLast30Days(tenantId: string, userId: string, now = new Date()) { const cutoff = new Date(now.getTime() - 30 * 86_400_000); return Boolean(await prisma.studentProfile.findFirst({ where: { tenantId, userId, user: { status: "ACTIVE", lastLoginAt: { gte: cutoff } } }, select: { id: true } })); }

export async function getTenantSubscriptionSnapshot(tenantId: string, now = new Date()) {
  await syncTenantSubscriptionState(tenantId, now); const subscription = await prisma.tenantSubscription.findUnique({ where: { tenantId }, include: { plan: true, pendingPlan: true } }); if (!subscription) return null;
  const [activeStudents, storage] = await Promise.all([getActiveStudentsLast30Days(tenantId, now), prisma.mediaAsset.aggregate({ where: { tenantId, uploadStatus: "COMPLETED", deletedAt: null }, _sum: { fileSizeBytes: true } })]);
  const storageBytes = storage._sum.fileSizeBytes ?? BigInt(0); const storageLimitBytes = subscription.storageLimitGb == null ? null : BigInt(subscription.storageLimitGb) * BigInt(1024) * BigInt(1024) * BigInt(1024);
  const effectiveStatus = resolveSubscriptionStatus(subscription, now);
  return { subscription, effectiveStatus, usage: { activeStudents, storageBytes }, limits: { activeStudents: subscription.activeStudentLimit, storageBytes: storageLimitBytes }, exceeded: { activeStudents: subscription.activeStudentLimit != null && activeStudents >= subscription.activeStudentLimit, storage: storageLimitBytes != null && storageBytes >= storageLimitBytes } };
}

export async function getSubscriptionPlansWithQuotes(tenantId?: string, now = new Date()) {
  const [plans, policy, current] = await Promise.all([prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }), getSubscriptionPolicy(), tenantId ? prisma.tenantSubscription.findUnique({ where: { tenantId } }) : null]);
  return plans.map((plan) => ({ id: plan.id, code: plan.code, name: plan.name, monthlyPrice: plan.monthlyPrice == null ? null : Number(plan.monthlyPrice), activeStudentLimit: plan.activeStudentLimit, storageLimitGb: plan.storageLimitGb, isCustom: plan.isCustom,
    quotes: plan.monthlyPrice == null ? [] : BILLING_CYCLES.map((billingCycle) => ({ billingCycle, ...(current ? quotePlanChange({ current: { status: current.status, planId: current.planId, baseMonthlyPrice: Number(current.baseMonthlyPrice), currentPeriodStart: current.currentPeriodStart, currentPeriodEnd: current.currentPeriodEnd }, requested: { id: plan.id, monthlyPrice: Number(plan.monthlyPrice), activeStudentLimit: plan.activeStudentLimit, storageLimitGb: plan.storageLimitGb }, cycle: billingCycle, policy: policy.pricing, now }) : calculatePolicyPrice(Number(plan.monthlyPrice), billingCycle, policy.pricing)) })) }));
}

export async function assertCanAddActiveStudent(tenantId: string, studentId?: string) { const snapshot = await getTenantSubscriptionSnapshot(tenantId); if (!snapshot || !subscriptionAllowsDashboard(snapshot.effectiveStatus)) throw new Error("SUBSCRIPTION_INACTIVE"); const alreadyActive = studentId ? await isStudentActiveLast30Days(tenantId, studentId) : false; if (activeStudentLimitReached(snapshot.usage.activeStudents, snapshot.subscription.activeStudentLimit, alreadyActive)) throw new Error("ACTIVE_STUDENT_LIMIT_REACHED"); return snapshot; }
export async function assertTenantStorageCapacity(tenantId: string, incomingBytes: number | bigint) { const snapshot = await getTenantSubscriptionSnapshot(tenantId); if (!snapshot || !subscriptionAllowsDashboard(snapshot.effectiveStatus)) throw new Error("SUBSCRIPTION_INACTIVE"); if (storageLimitReached(snapshot.usage.storageBytes, BigInt(incomingBytes), snapshot.subscription.storageLimitGb)) throw new Error("STORAGE_LIMIT_REACHED"); return snapshot; }
export async function assertTenantPlanLimit(tenantId: string, resource: "ACTIVE_STUDENTS" | "STORAGE") { return resource === "ACTIVE_STUDENTS" ? assertCanAddActiveStudent(tenantId) : assertTenantStorageCapacity(tenantId, 1); }

export async function reviewSubscriptionPaymentRequest(input: { requestId: string; reviewerId: string; status: Extract<SubscriptionPaymentStatus, "APPROVED" | "REJECTED" | "NEEDS_REVIEW">; rejectionReason?: string | null }) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${input.requestId}))`);
    const request = await tx.subscriptionPaymentRequest.findUnique({ where: { id: input.requestId }, include: { requestedPlan: true, subscription: true } }); if (!request) throw new Error("PAYMENT_REQUEST_NOT_FOUND");
    if (request.status === "APPROVED" && input.status === "APPROVED") return { paymentRequest: request, idempotent: true, activated: true };
    if (request.status !== "PENDING" && request.status !== "NEEDS_REVIEW") throw new Error("PAYMENT_REQUEST_ALREADY_REVIEWED");
    const reviewedAt = new Date(); const before = { status: request.status, subscriptionStatus: request.subscription.status, planId: request.subscription.planId };
    if (input.status !== "APPROVED") {
      const updated = await tx.subscriptionPaymentRequest.update({ where: { id: request.id }, data: { status: input.status, reviewedById: input.reviewerId, reviewedAt, rejectionReason: input.rejectionReason || (input.status === "REJECTED" ? "لم يتم تأكيد التحويل" : "يرجى رفع إيصال أوضح") } });
      await tx.subscriptionEvent.create({ data: { tenantId: request.tenantId, subscriptionId: request.subscriptionId, actorUserId: input.reviewerId, type: input.status === "REJECTED" ? "PAYMENT_REJECTED" : "PAYMENT_REQUESTED", key: `payment-review:${request.id}:${input.status}`, payload: { requestId: request.id, reason: updated.rejectionReason } } }).catch(() => undefined);
      await tx.auditLog.create({ data: { tenantId: request.tenantId, actorId: input.reviewerId, action: input.status === "REJECTED" ? "SUBSCRIPTION_PAYMENT_REJECTED" : "SUBSCRIPTION_RECEIPT_CLARIFICATION_REQUESTED", entityType: "SubscriptionPaymentRequest", entityId: request.id, before, after: { status: input.status, reason: updated.rejectionReason } } });
      return { paymentRequest: updated, idempotent: false, activated: false };
    }
    const subscription = request.subscription; let periodStart = reviewedAt; let periodEnd = request.periodEnd;
    if (request.changeType === "RENEWAL") { periodStart = subscription.currentPeriodEnd && subscription.currentPeriodEnd > reviewedAt ? subscription.currentPeriodEnd : reviewedAt; periodEnd = addMonthsUtc(periodStart, request.billingCycle === "ANNUAL" ? 12 : request.billingCycle === "SEMIANNUAL" ? 6 : request.billingCycle === "QUARTERLY" ? 3 : 1); }
    if (request.changeType === "NEW_SUBSCRIPTION") { periodStart = reviewedAt; periodEnd = addMonthsUtc(reviewedAt, request.billingCycle === "ANNUAL" ? 12 : request.billingCycle === "SEMIANNUAL" ? 6 : request.billingCycle === "QUARTERLY" ? 3 : 1); }
    const updatedRequest = await tx.subscriptionPaymentRequest.update({ where: { id: request.id }, data: { status: "APPROVED", reviewedById: input.reviewerId, reviewedAt, rejectionReason: null, periodStart, periodEnd } });
    if (request.changeType === "DOWNGRADE" && subscription.currentPeriodEnd && subscription.currentPeriodEnd > reviewedAt) {
      await tx.tenantSubscription.update({ where: { id: subscription.id }, data: { pendingPlanId: request.requestedPlanId, pendingBillingCycle: request.billingCycle, pendingDowngradeAt: subscription.currentPeriodEnd, pendingPeriodEnd: request.periodEnd, pendingBaseMonthlyPrice: request.requestedPlan.monthlyPrice, pendingDiscountPercent: Number(request.discountAmount) > 0 ? Number(request.discountAmount) / Number(request.originalAmount) * 100 : 0, pendingBilledAmount: request.amount, pendingActiveStudentLimit: request.requestedPlan.activeStudentLimit, pendingStorageLimitGb: request.requestedPlan.storageLimitGb, version: { increment: 1 } } });
      await tx.subscriptionEvent.create({ data: { tenantId: request.tenantId, subscriptionId: subscription.id, actorUserId: input.reviewerId, type: "DOWNGRADE_SCHEDULED", key: `downgrade-scheduled:${request.id}`, payload: { requestId: request.id, effectiveAt: subscription.currentPeriodEnd.toISOString() } } });
    } else if (request.changeType === "UPGRADE") {
      await tx.tenantSubscription.update({ where: { id: subscription.id }, data: { planId: request.requestedPlanId, status: "ACTIVE", baseMonthlyPrice: request.requestedPlan.monthlyPrice!, activeStudentLimit: request.requestedPlan.activeStudentLimit, storageLimitGb: request.requestedPlan.storageLimitGb, gracePeriodEndsAt: null, version: { increment: 1 } } });
      await tx.subscriptionEvent.create({ data: { tenantId: request.tenantId, subscriptionId: subscription.id, actorUserId: input.reviewerId, type: "PLAN_CHANGED", key: `upgrade-applied:${request.id}`, payload: { requestId: request.id, immediate: true, prorationCredit: Number(request.prorationCredit) } } });
    } else {
      await tx.tenantSubscription.update({ where: { id: subscription.id }, data: { planId: request.requestedPlanId, status: "ACTIVE", billingCycle: request.billingCycle, baseMonthlyPrice: request.requestedPlan.monthlyPrice!, discountPercent: Number(request.discountAmount) > 0 ? Number(request.discountAmount) / Number(request.originalAmount) * 100 : 0, billedAmount: request.amount, activeStudentLimit: request.requestedPlan.activeStudentLimit, storageLimitGb: request.requestedPlan.storageLimitGb, currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, gracePeriodEndsAt: null, cancelAtPeriodEnd: false, cancelledAt: null, version: { increment: 1 } } });
    }
    await tx.tenant.update({ where: { id: request.tenantId }, data: { status: "ACTIVE", suspendedAt: null } });
    await tx.subscriptionEvent.create({ data: { tenantId: request.tenantId, subscriptionId: subscription.id, actorUserId: input.reviewerId, type: "PAYMENT_APPROVED", key: `payment-approved:${request.id}`, payload: { requestId: request.id, changeType: request.changeType, amount: Number(request.amount), periodEnd: periodEnd.toISOString() } } });
    await tx.auditLog.create({ data: { tenantId: request.tenantId, actorId: input.reviewerId, action: "SUBSCRIPTION_PAYMENT_APPROVED", entityType: "SubscriptionPaymentRequest", entityId: request.id, before, after: { status: "APPROVED", changeType: request.changeType, planId: request.requestedPlanId, amount: Number(request.amount), periodStart, periodEnd } } });
    return { paymentRequest: updatedRequest, idempotent: false, activated: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function processSubscriptionLifecycle(now = new Date()) {
  const policy = await getSubscriptionPolicy(); const subscriptions = await prisma.tenantSubscription.findMany({ select: { id: true, tenantId: true, status: true, trialEndsAt: true, currentPeriodEnd: true, gracePeriodEndsAt: true } }); const notices: Array<{ tenantId: string; subscriptionId: string; kind: "WARNING" | "GRACE" | "EXPIRED" | "TRIAL_EXPIRED"; days?: number; cycleKey: string }> = [];
  for (const subscription of subscriptions) {
    const expiry = subscription.status === "TRIALING" ? subscription.trialEndsAt : subscription.currentPeriodEnd;
    if (expiry && expiry > now && subscription.status !== "TRIALING") { const days = Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000); if ([7,3,1].includes(days)) { const key=`expiry-warning:${subscription.id}:${days}:${expiry.toISOString()}`; const created=await prisma.subscriptionEvent.create({ data: { tenantId: subscription.tenantId, subscriptionId: subscription.id, type: "EXPIRY_WARNING_SENT", key, payload: { days, expiry: expiry.toISOString() } } }).then(()=>true).catch(()=>false); if(created) notices.push({tenantId:subscription.tenantId,subscriptionId:subscription.id,kind:"WARNING",days,cycleKey:expiry.toISOString()}); } }
    const before = subscription.status; const synced = await syncTenantSubscriptionState(subscription.tenantId, now); if (synced && synced.effectiveStatus !== before) notices.push({ tenantId: subscription.tenantId, subscriptionId: subscription.id, kind: before === "TRIALING" ? "TRIAL_EXPIRED" : synced.effectiveStatus === "GRACE_PERIOD" ? "GRACE" : "EXPIRED", cycleKey: (subscription.currentPeriodEnd ?? subscription.trialEndsAt).toISOString() });
  }
  return { processed: subscriptions.length, notices, graceDays: policy.graceDays };
}




