ALTER TYPE "SubscriptionPaymentStatus" ADD VALUE IF NOT EXISTS 'NEEDS_REVIEW' AFTER 'PENDING';

ALTER TABLE "TenantSubscription"
  ADD COLUMN IF NOT EXISTS "trialOfferDismissedAt" TIMESTAMP(3);

ALTER TABLE "SubscriptionPaymentRequest"
  ADD COLUMN IF NOT EXISTS "requestedPlanId" TEXT,
  ADD COLUMN IF NOT EXISTS "billingCycle" "SubscriptionBillingCycle",
  ADD COLUMN IF NOT EXISTS "originalAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE "SubscriptionPaymentRequest" request
SET
  "requestedPlanId" = subscription."planId",
  "billingCycle" = subscription."billingCycle",
  "originalAmount" = request."amount"
FROM "TenantSubscription" subscription
WHERE request."subscriptionId" = subscription."id"
  AND (request."requestedPlanId" IS NULL OR request."billingCycle" IS NULL OR request."originalAmount" IS NULL);

ALTER TABLE "SubscriptionPaymentRequest"
  ALTER COLUMN "requestedPlanId" SET NOT NULL,
  ALTER COLUMN "billingCycle" SET NOT NULL,
  ALTER COLUMN "originalAmount" SET NOT NULL;

ALTER TABLE "SubscriptionPaymentRequest"
  ADD CONSTRAINT "SubscriptionPaymentRequest_requestedPlanId_fkey"
  FOREIGN KEY ("requestedPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "SubscriptionPaymentRequest_requestedPlanId_createdAt_idx"
  ON "SubscriptionPaymentRequest"("requestedPlanId", "createdAt");