ALTER TYPE "SubscriptionEventType" ADD VALUE IF NOT EXISTS 'EXPIRY_WARNING_SENT' AFTER 'PAYMENT_REJECTED';

CREATE TYPE "SubscriptionChangeType" AS ENUM ('NEW_SUBSCRIPTION','RENEWAL','UPGRADE','DOWNGRADE','CUSTOM');

ALTER TABLE "PlatformSettings"
  ADD COLUMN "subscriptionTrialHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "subscriptionGraceDays" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN "subscriptionQuarterlyDiscount" DECIMAL(5,2) NOT NULL DEFAULT 5,
  ADD COLUMN "subscriptionSemiannualDiscount" DECIMAL(5,2) NOT NULL DEFAULT 10,
  ADD COLUMN "subscriptionAnnualBilledMonths" INTEGER NOT NULL DEFAULT 10;

ALTER TABLE "TenantSubscription"
  ADD COLUMN "pendingPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "pendingBaseMonthlyPrice" DECIMAL(10,2),
  ADD COLUMN "pendingDiscountPercent" DECIMAL(5,2),
  ADD COLUMN "pendingBilledAmount" DECIMAL(10,2),
  ADD COLUMN "pendingActiveStudentLimit" INTEGER,
  ADD COLUMN "pendingStorageLimitGb" INTEGER;

ALTER TABLE "SubscriptionPaymentRequest"
  ADD COLUMN "changeType" "SubscriptionChangeType" NOT NULL DEFAULT 'NEW_SUBSCRIPTION',
  ADD COLUMN "prorationCredit" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "SubscriptionEvent" ADD COLUMN "key" TEXT;
CREATE UNIQUE INDEX "SubscriptionEvent_key_key" ON "SubscriptionEvent"("key");
CREATE INDEX "SubscriptionPaymentRequest_changeType_status_createdAt_idx" ON "SubscriptionPaymentRequest"("changeType","status","createdAt");