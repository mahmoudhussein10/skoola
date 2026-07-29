import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_PRICING_POLICY,
  activeStudentLimitReached,
  addDaysUtc,
  calculatePolicyPrice,
  quotePlanChange,
  resolveLifecycle,
  storageLimitReached,
} from "../lib/subscription-policy.ts";

const requested = { id: "growth", monthlyPrice: 750, activeStudentLimit: 200, storageLimitGb: 80 };

test("pricing applies monthly, 3-month, 6-month and annual rules", () => {
  assert.equal(calculatePolicyPrice(350, "MONTHLY").amountEgp, 350);
  assert.equal(calculatePolicyPrice(350, "QUARTERLY").amountEgp, 997.5);
  assert.equal(calculatePolicyPrice(750, "SEMIANNUAL").amountEgp, 4050);
  const annual = calculatePolicyPrice(1300, "ANNUAL");
  assert.equal(annual.originalAmountEgp, 15600);
  assert.equal(annual.amountEgp, 13000);
  assert.equal(annual.discountAmountEgp, 2600);
});

test("pricing policy is configurable without client-side constants", () => {
  const policy = { quarterlyDiscountPercent: 8, semiannualDiscountPercent: 12, annualBilledMonths: 9 };
  assert.equal(calculatePolicyPrice(100, "QUARTERLY", policy).amountEgp, 276);
  assert.equal(calculatePolicyPrice(100, "SEMIANNUAL", policy).amountEgp, 528);
  assert.equal(calculatePolicyPrice(100, "ANNUAL", policy).amountEgp, 900);
});

test("expired and trial accounts start from approval time", () => {
  const now = new Date("2026-07-29T12:00:00.000Z");
  const quote = quotePlanChange({ current: { status: "EXPIRED", planId: "starter", baseMonthlyPrice: 350, currentPeriodStart: null, currentPeriodEnd: null }, requested, cycle: "MONTHLY", policy: DEFAULT_PRICING_POLICY, now });
  assert.equal(quote.changeType, "NEW_SUBSCRIPTION");
  assert.equal(quote.periodStart.toISOString(), now.toISOString());
  assert.equal(quote.periodEnd.toISOString(), "2026-08-29T12:00:00.000Z");
});

test("early renewal extends from current expiry", () => {
  const now = new Date("2026-07-10T00:00:00.000Z");
  const expiry = new Date("2026-08-01T00:00:00.000Z");
  const quote = quotePlanChange({ current: { status: "ACTIVE", planId: "growth", baseMonthlyPrice: 750, currentPeriodStart: new Date("2026-07-01T00:00:00.000Z"), currentPeriodEnd: expiry }, requested, cycle: "ANNUAL", now });
  assert.equal(quote.changeType, "RENEWAL");
  assert.equal(quote.periodStart.toISOString(), expiry.toISOString());
  assert.equal(quote.periodEnd.toISOString(), "2027-08-01T00:00:00.000Z");
});

test("upgrade is immediate and prorated while downgrade waits", () => {
  const now = new Date("2026-07-15T00:00:00.000Z");
  const expiry = new Date("2026-08-01T00:00:00.000Z");
  const upgrade = quotePlanChange({ current: { status: "ACTIVE", planId: "starter", baseMonthlyPrice: 350, currentPeriodStart: new Date("2026-07-01T00:00:00.000Z"), currentPeriodEnd: expiry }, requested, cycle: "MONTHLY", now });
  assert.equal(upgrade.changeType, "UPGRADE");
  assert.equal(upgrade.effectiveAt.toISOString(), now.toISOString());
  assert.equal(upgrade.periodEnd.toISOString(), expiry.toISOString());
  assert.ok(upgrade.prorationCreditEgp > 0);
  assert.ok(upgrade.amountEgp > 0 && upgrade.amountEgp < 750);
  const downgrade = quotePlanChange({ current: { status: "ACTIVE", planId: "pro", baseMonthlyPrice: 1300, currentPeriodStart: new Date("2026-07-01T00:00:00.000Z"), currentPeriodEnd: expiry }, requested: { ...requested, id: "starter", monthlyPrice: 350 }, cycle: "MONTHLY", now });
  assert.equal(downgrade.changeType, "DOWNGRADE");
  assert.equal(downgrade.effectiveAt.toISOString(), expiry.toISOString());
});

test("lifecycle covers trial expiry, grace and post-grace blocking", () => {
  const now = new Date("2026-07-29T12:00:00.000Z");
  assert.equal(resolveLifecycle({ status: "TRIALING", trialEndsAt: new Date("2026-07-29T11:00:00.000Z"), currentPeriodEnd: null, gracePeriodEndsAt: null }, 7, now).status, "EXPIRED");
  const expiredAt = addDaysUtc(now, -2);
  const grace = resolveLifecycle({ status: "ACTIVE", trialEndsAt: now, currentPeriodEnd: expiredAt, gracePeriodEndsAt: null }, 7, now);
  assert.equal(grace.status, "GRACE_PERIOD");
  assert.equal(grace.gracePeriodEndsAt?.toISOString(), addDaysUtc(expiredAt, 7).toISOString());
  assert.equal(resolveLifecycle({ status: "GRACE_PERIOD", trialEndsAt: now, currentPeriodEnd: addDaysUtc(now, -8), gracePeriodEndsAt: addDaysUtc(now, -1) }, 7, now).status, "EXPIRED");
});

test("student and storage limits fail closed without locking existing use", () => {
  assert.equal(activeStudentLimitReached(60, 60, false), true);
  assert.equal(activeStudentLimitReached(60, 60, true), false);
  assert.equal(activeStudentLimitReached(999, null, false), false);
  const gb = BigInt(1024) * BigInt(1024) * BigInt(1024);
  assert.equal(storageLimitReached(BigInt(29) * gb, BigInt(2) * gb, 30), true);
  assert.equal(storageLimitReached(BigInt(29) * gb, BigInt(1) * gb, 30), false);
  assert.equal(storageLimitReached(BigInt(999) * gb, BigInt(1), null), false);
});

test("payment approval is locked, idempotent and tenant-scoped", () => {
  const service = readFileSync(new URL("../lib/subscriptions.ts", import.meta.url), "utf8");
  assert.match(service, /pg_advisory_xact_lock/);
  assert.match(service, /request\.status === "APPROVED" && input\.status === "APPROVED"/);
  assert.match(service, /where: \{ tenantId \}/);
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
});

test("RLS policies isolate all subscription tenant tables", () => {
  const sql = readFileSync(new URL("../prisma/migrations/20260729090000_subscription_foundation/migration.sql", import.meta.url), "utf8");
  for (const table of ["TenantSubscription", "SubscriptionPaymentRequest", "SubscriptionEvent"]) {
    assert.match(sql, new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`));
  }
  assert.match(sql, /tenant_subscription_isolation/);
  assert.match(sql, /subscription_payment_isolation/);
  assert.match(sql, /subscription_event_isolation/);
});

test("limit enforcement is server-side at signup, approval and upload boundaries", () => {
  const files = ["../app/api/auth/signup/route.ts", "../app/api/teacher/payments/[id]/approve/route.ts", "../app/api/media/file/upload/route.ts", "../app/api/media/video/create-upload/route.ts"];
  const source = files.map(file => readFileSync(new URL(file, import.meta.url), "utf8")).join("\n");
  assert.match(source, /assertCanAddActiveStudent/);
  assert.match(source, /assertTenantStorageCapacity/);
});

