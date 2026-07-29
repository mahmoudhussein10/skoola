CREATE TYPE "SubscriptionBillingCycle" AS ENUM ('MONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL','CUSTOM');
CREATE TYPE "TenantSubscriptionStatus" AS ENUM ('TRIALING','ACTIVE','GRACE_PERIOD','PAST_DUE','CANCELLED','EXPIRED');
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED','EXPIRED');
CREATE TYPE "SubscriptionEventType" AS ENUM ('CREATED','TRIAL_STARTED','TRIAL_ENDED','ACTIVATED','RENEWED','PAYMENT_REQUESTED','PAYMENT_APPROVED','PAYMENT_REJECTED','GRACE_STARTED','GRACE_ENDED','DOWNGRADE_SCHEDULED','DOWNGRADE_APPLIED','PLAN_CHANGED','LIMIT_REACHED','CANCELLED','EXPIRED');

ALTER TABLE "PlatformSettings" DROP COLUMN IF EXISTS "defaultTeacherPricePerStudent", DROP COLUMN IF EXISTS "teacherBillingDueDay";
ALTER TABLE "TeacherBillingSettings" DROP COLUMN IF EXISTS "pricePerStudent", DROP COLUMN IF EXISTS "billingCycle", DROP COLUMN IF EXISTS "studentLimit", DROP COLUMN IF EXISTS "subscriptionStart", DROP COLUMN IF EXISTS "subscriptionEnd", DROP COLUMN IF EXISTS "internalNotes", DROP COLUMN IF EXISTS "openingFeeAmount", DROP COLUMN IF EXISTS "openingFeeDueAt", DROP COLUMN IF EXISTS "openingFeeStatus", DROP COLUMN IF EXISTS "openingFeeActivatedAt";
DROP TABLE IF EXISTS "TeacherBillingPaymentSubmission" CASCADE;
DROP TABLE IF EXISTS "TeacherPaymentRecord" CASCADE;
DROP TABLE IF EXISTS "BillingStatement" CASCADE;

CREATE TABLE "SubscriptionPlan" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "monthlyPrice" DECIMAL(10,2),
  "activeStudentLimit" INTEGER, "storageLimitGb" INTEGER, "isCustom" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "sortOrder" INTEGER NOT NULL DEFAULT 0, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionPlan_code_key" ON "SubscriptionPlan"("code");
CREATE INDEX "SubscriptionPlan_isActive_sortOrder_idx" ON "SubscriptionPlan"("isActive","sortOrder");

INSERT INTO "SubscriptionPlan" ("id","code","name","monthlyPrice","activeStudentLimit","storageLimitGb","isCustom","sortOrder") VALUES
('plan_starter','STARTER','Starter',350,60,30,false,10),
('plan_growth','GROWTH','Growth',750,200,80,false,20),
('plan_pro','PRO','Pro',1300,400,150,false,30),
('plan_enterprise','ENTERPRISE','Enterprise',NULL,NULL,NULL,true,40);

CREATE TABLE "TenantSubscription" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "planId" TEXT NOT NULL, "status" "TenantSubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
  "billingCycle" "SubscriptionBillingCycle" NOT NULL DEFAULT 'MONTHLY', "currency" TEXT NOT NULL DEFAULT 'EGP',
  "baseMonthlyPrice" DECIMAL(10,2) NOT NULL, "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "billedAmount" DECIMAL(10,2) NOT NULL, "activeStudentLimit" INTEGER, "storageLimitGb" INTEGER,
  "trialStartedAt" TIMESTAMP(3) NOT NULL, "trialEndsAt" TIMESTAMP(3) NOT NULL, "currentPeriodStart" TIMESTAMP(3), "currentPeriodEnd" TIMESTAMP(3),
  "gracePeriodEndsAt" TIMESTAMP(3), "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false, "cancelledAt" TIMESTAMP(3),
  "pendingPlanId" TEXT, "pendingBillingCycle" "SubscriptionBillingCycle", "pendingDowngradeAt" TIMESTAMP(3), "metadata" JSONB,
  "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TenantSubscription_tenantId_key" ON "TenantSubscription"("tenantId");
CREATE INDEX "TenantSubscription_status_trialEndsAt_idx" ON "TenantSubscription"("status","trialEndsAt");
CREATE INDEX "TenantSubscription_status_currentPeriodEnd_idx" ON "TenantSubscription"("status","currentPeriodEnd");
CREATE INDEX "TenantSubscription_pendingPlanId_pendingDowngradeAt_idx" ON "TenantSubscription"("pendingPlanId","pendingDowngradeAt");
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_pendingPlanId_fkey" FOREIGN KEY ("pendingPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SubscriptionPaymentRequest" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "subscriptionId" TEXT NOT NULL, "amount" DECIMAL(10,2) NOT NULL, "currency" TEXT NOT NULL DEFAULT 'EGP',
  "paymentMethod" "PaymentMethod", "referenceNumber" TEXT, "proofUrl" TEXT, "notes" TEXT, "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL, "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3), "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionPaymentRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SubscriptionPaymentRequest_tenantId_status_createdAt_idx" ON "SubscriptionPaymentRequest"("tenantId","status","createdAt");
CREATE INDEX "SubscriptionPaymentRequest_subscriptionId_status_periodStart_idx" ON "SubscriptionPaymentRequest"("subscriptionId","status","periodStart");
ALTER TABLE "SubscriptionPaymentRequest" ADD CONSTRAINT "SubscriptionPaymentRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPaymentRequest" ADD CONSTRAINT "SubscriptionPaymentRequest_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "TenantSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPaymentRequest" ADD CONSTRAINT "SubscriptionPaymentRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SubscriptionEvent" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "subscriptionId" TEXT NOT NULL, "actorUserId" TEXT, "type" "SubscriptionEventType" NOT NULL,
  "payload" JSONB, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SubscriptionEvent_tenantId_occurredAt_idx" ON "SubscriptionEvent"("tenantId","occurredAt");
CREATE INDEX "SubscriptionEvent_subscriptionId_type_occurredAt_idx" ON "SubscriptionEvent"("subscriptionId","type","occurredAt");
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "TenantSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "TenantSubscription" ("id","tenantId","planId","status","baseMonthlyPrice","billedAmount","activeStudentLimit","storageLimitGb","trialStartedAt","trialEndsAt","currentPeriodStart","currentPeriodEnd")
SELECT 'sub_' || md5(t."id"), t."id", 'plan_starter',
  CASE WHEN t."status"='TRIAL' THEN 'TRIALING'::"TenantSubscriptionStatus" WHEN t."status"='ACTIVE' THEN 'ACTIVE'::"TenantSubscriptionStatus" WHEN t."status"='SUSPENDED' THEN 'PAST_DUE'::"TenantSubscriptionStatus" ELSE 'CANCELLED'::"TenantSubscriptionStatus" END,
  350,350,60,30,t."createdAt",t."createdAt" + INTERVAL '24 hours',
  CASE WHEN t."status"='ACTIVE' THEN CURRENT_TIMESTAMP ELSE NULL END,
  CASE WHEN t."status"='ACTIVE' THEN CURRENT_TIMESTAMP + INTERVAL '1 month' ELSE NULL END
FROM "Tenant" t ON CONFLICT ("tenantId") DO NOTHING;

INSERT INTO "SubscriptionEvent" ("id","tenantId","subscriptionId","type","payload","occurredAt")
SELECT 'evt_' || md5(s."id" || ':migration'), s."tenantId", s."id", 'CREATED', '{"source":"legacy_migration"}'::jsonb, s."createdAt" FROM "TenantSubscription" s;

ALTER TABLE "SubscriptionPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionPaymentRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_read" ON "SubscriptionPlan" FOR SELECT USING ("isActive" OR current_setting('app.is_super_admin', true)='true');
CREATE POLICY "tenant_subscription_isolation" ON "TenantSubscription" FOR ALL USING ("tenantId"=current_setting('app.current_tenant_id',true) OR current_setting('app.is_super_admin',true)='true') WITH CHECK ("tenantId"=current_setting('app.current_tenant_id',true) OR current_setting('app.is_super_admin',true)='true');
CREATE POLICY "subscription_payment_isolation" ON "SubscriptionPaymentRequest" FOR ALL USING ("tenantId"=current_setting('app.current_tenant_id',true) OR current_setting('app.is_super_admin',true)='true') WITH CHECK ("tenantId"=current_setting('app.current_tenant_id',true) OR current_setting('app.is_super_admin',true)='true');
CREATE POLICY "subscription_event_isolation" ON "SubscriptionEvent" FOR ALL USING ("tenantId"=current_setting('app.current_tenant_id',true) OR current_setting('app.is_super_admin',true)='true') WITH CHECK ("tenantId"=current_setting('app.current_tenant_id',true) OR current_setting('app.is_super_admin',true)='true');