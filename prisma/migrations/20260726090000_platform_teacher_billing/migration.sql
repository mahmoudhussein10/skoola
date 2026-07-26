ALTER TABLE "PlatformSettings"
  ADD COLUMN "billingAccountName" TEXT,
  ADD COLUMN "billingInstaPayAddress" TEXT,
  ADD COLUMN "billingInstaPayEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "billingPaymentInstructions" TEXT,
  ADD COLUMN "billingVodafoneCashEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "billingVodafoneCashNumber" TEXT,
  ADD COLUMN "defaultTeacherPricePerStudent" DECIMAL(10,2) NOT NULL DEFAULT 15,
  ADD COLUMN "teacherBillingDueDay" INTEGER NOT NULL DEFAULT 10;

ALTER TABLE "TeacherBillingSettings" ALTER COLUMN "pricePerStudent" SET DEFAULT 15;
UPDATE "TeacherBillingSettings" SET "pricePerStudent" = 15 WHERE "pricePerStudent" <= 0;

CREATE TABLE "TeacherBillingPaymentSubmission" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "statementId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "referenceNumber" TEXT,
  "notes" TEXT,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherBillingPaymentSubmission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TeacherBillingPaymentSubmission_tenantId_status_createdAt_idx" ON "TeacherBillingPaymentSubmission"("tenantId","status","createdAt");
CREATE INDEX "TeacherBillingPaymentSubmission_statementId_status_idx" ON "TeacherBillingPaymentSubmission"("statementId","status");
ALTER TABLE "TeacherBillingPaymentSubmission" ADD CONSTRAINT "TeacherBillingPaymentSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherBillingPaymentSubmission" ADD CONSTRAINT "TeacherBillingPaymentSubmission_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "BillingStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
