export const PUBLIC_BILLING_CYCLES = ["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"] as const;
export type PublicBillingCycle = (typeof PUBLIC_BILLING_CYCLES)[number];
export type PricingPolicy = { quarterlyDiscountPercent: number; semiannualDiscountPercent: number; annualBilledMonths: number };
export const DEFAULT_PRICING_POLICY: PricingPolicy = { quarterlyDiscountPercent: 5, semiannualDiscountPercent: 10, annualBilledMonths: 10 };

export function cycleTerms(cycle: PublicBillingCycle, policy: PricingPolicy = DEFAULT_PRICING_POLICY) {
  if (cycle === "MONTHLY") return { months: 1, discountPercent: 0, billedMonths: 1 };
  if (cycle === "QUARTERLY") return { months: 3, discountPercent: policy.quarterlyDiscountPercent, billedMonths: 3 * (1 - policy.quarterlyDiscountPercent / 100) };
  if (cycle === "SEMIANNUAL") return { months: 6, discountPercent: policy.semiannualDiscountPercent, billedMonths: 6 * (1 - policy.semiannualDiscountPercent / 100) };
  return { months: 12, discountPercent: 100 * (1 - policy.annualBilledMonths / 12), billedMonths: policy.annualBilledMonths };
}

export function calculatePolicyPrice(monthlyPriceEgp: number, cycle: PublicBillingCycle, policy: PricingPolicy = DEFAULT_PRICING_POLICY) {
  if (!Number.isFinite(monthlyPriceEgp) || monthlyPriceEgp < 0) throw new Error("INVALID_MONTHLY_PRICE");
  const terms = cycleTerms(cycle, policy);
  const originalMinor = Math.round(monthlyPriceEgp * terms.months * 100);
  const amountMinor = Math.round(monthlyPriceEgp * terms.billedMonths * 100);
  return { originalAmountEgp: originalMinor / 100, discountAmountEgp: (originalMinor - amountMinor) / 100, prorationCreditEgp: 0, amountEgp: amountMinor / 100, amountMinor, months: terms.months, discountPercent: terms.discountPercent };
}

export function addMonthsUtc(date: Date, months: number) {
  const result = new Date(date); const day = result.getUTCDate(); result.setUTCDate(1); result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate(); result.setUTCDate(Math.min(day, lastDay)); return result;
}
export function addDaysUtc(date: Date, days: number) { return new Date(date.getTime() + days * 86_400_000); }

export type LifecycleInput = { status: "TRIALING" | "ACTIVE" | "GRACE_PERIOD" | "PAST_DUE" | "CANCELLED" | "EXPIRED"; trialEndsAt: Date; currentPeriodEnd: Date | null; gracePeriodEndsAt: Date | null };
export function resolveLifecycle(input: LifecycleInput, graceDays = 7, now = new Date()) {
  if (input.status === "TRIALING") return input.trialEndsAt > now ? { status: "TRIALING" as const, gracePeriodEndsAt: null } : { status: "EXPIRED" as const, gracePeriodEndsAt: null };
  if (input.status === "CANCELLED") return { status: "CANCELLED" as const, gracePeriodEndsAt: input.gracePeriodEndsAt };
  if (input.status === "EXPIRED") return { status: "EXPIRED" as const, gracePeriodEndsAt: input.gracePeriodEndsAt };
  if (!input.currentPeriodEnd || input.currentPeriodEnd > now) return { status: "ACTIVE" as const, gracePeriodEndsAt: null };
  const graceEnd = input.gracePeriodEndsAt ?? addDaysUtc(input.currentPeriodEnd, graceDays);
  return graceEnd > now ? { status: "GRACE_PERIOD" as const, gracePeriodEndsAt: graceEnd } : { status: "EXPIRED" as const, gracePeriodEndsAt: graceEnd };
}

export type PlanSnapshot = { id: string; monthlyPrice: number; activeStudentLimit: number | null; storageLimitGb: number | null };
export type SubscriptionSnapshotForQuote = { status: LifecycleInput["status"]; planId: string; baseMonthlyPrice: number; currentPeriodStart: Date | null; currentPeriodEnd: Date | null };
export function quotePlanChange(input: { current: SubscriptionSnapshotForQuote; requested: PlanSnapshot; cycle: PublicBillingCycle; policy?: PricingPolicy; now?: Date }) {
  const now = input.now ?? new Date(); const currentActive = ["ACTIVE", "GRACE_PERIOD"].includes(input.current.status) && Boolean(input.current.currentPeriodEnd && input.current.currentPeriodEnd > now);
  const standard = calculatePolicyPrice(input.requested.monthlyPrice, input.cycle, input.policy);
  if (!currentActive) return { ...standard, changeType: "NEW_SUBSCRIPTION" as const, effectiveAt: now, periodStart: now, periodEnd: addMonthsUtc(now, standard.months) };
  const expiry = input.current.currentPeriodEnd!;
  if (input.requested.id === input.current.planId) return { ...standard, changeType: "RENEWAL" as const, effectiveAt: expiry, periodStart: expiry, periodEnd: addMonthsUtc(expiry, standard.months) };
  if (input.requested.monthlyPrice > input.current.baseMonthlyPrice) {
    const remainingMonths = Math.max(0, expiry.getTime() - now.getTime()) / (365.2425 / 12 * 86_400_000);
    const originalAmountEgp = Math.round(input.requested.monthlyPrice * remainingMonths * 100) / 100;
    const prorationCreditEgp = Math.round(input.current.baseMonthlyPrice * remainingMonths * 100) / 100;
    const amountEgp = Math.max(0, Math.round((originalAmountEgp - prorationCreditEgp) * 100) / 100);
    return { originalAmountEgp, discountAmountEgp: 0, prorationCreditEgp, amountEgp, amountMinor: Math.round(amountEgp * 100), months: 0, discountPercent: 0, changeType: "UPGRADE" as const, effectiveAt: now, periodStart: now, periodEnd: expiry };
  }
  return { ...standard, changeType: "DOWNGRADE" as const, effectiveAt: expiry, periodStart: expiry, periodEnd: addMonthsUtc(expiry, standard.months) };
}

export function activeStudentLimitReached(activeStudents: number, limit: number | null, studentAlreadyActive = false) { return !studentAlreadyActive && limit != null && activeStudents >= limit; }
export function storageLimitReached(currentBytes: bigint, incomingBytes: bigint, limitGb: number | null) { return limitGb != null && currentBytes + incomingBytes > BigInt(limitGb) * BigInt(1024) * BigInt(1024) * BigInt(1024); }
