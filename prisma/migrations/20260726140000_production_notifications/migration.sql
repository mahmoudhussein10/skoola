CREATE TYPE "PushPermissionState" AS ENUM ('DEFAULT','GRANTED','DENIED','UNSUPPORTED');
CREATE TYPE "NotificationPriority" AS ENUM ('LOW','NORMAL','HIGH','URGENT');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP','PUSH');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING','SENT','FAILED','SKIPPED','INVALID_TOKEN');
CREATE TYPE "NotificationCategory" AS ENUM ('COURSE_CONTENT','EXAMS','RESULTS','ENROLLMENTS','PAYMENTS','ADMINISTRATIVE');

ALTER TABLE "Lesson" ADD COLUMN "publishVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Exam" ADD COLUMN "publishVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ExamAttempt" ADD COLUMN "resultVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Payment" ADD COLUMN "notificationVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Notification"
  ADD COLUMN "category" "NotificationCategory" NOT NULL DEFAULT 'ADMINISTRATIVE',
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "NotificationRecipient" (
  "id" TEXT NOT NULL, "notificationId" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false, "isSeen" BOOLEAN NOT NULL DEFAULT false, "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TIMESTAMP(3), "seenAt" TIMESTAMP(3), "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);
INSERT INTO "NotificationRecipient" ("id","notificationId","tenantId","userId","isRead","isSeen","readAt","seenAt","createdAt","updatedAt")
SELECT 'legacy-' || md5("id" || ':' || "userId"), "id", "tenantId", "userId", "isRead", "isRead",
       CASE WHEN "isRead" THEN "createdAt" ELSE NULL END, CASE WHEN "isRead" THEN "createdAt" ELSE NULL END,
       "createdAt", CURRENT_TIMESTAMP
FROM "Notification" WHERE "userId" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;
ALTER TABLE "Notification" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Notification" ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE TABLE "PushDevice" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "userId" TEXT NOT NULL, "installationId" TEXT NOT NULL, "token" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true, "permissionState" "PushPermissionState" NOT NULL DEFAULT 'DEFAULT',
  "browser" TEXT, "platform" TEXT, "userAgentSummary" TEXT, "promptCount" INTEGER NOT NULL DEFAULT 0,
  "lastPromptedAt" TIMESTAMP(3), "promptDismissedAt" TIMESTAMP(3), "lastFailureCode" TEXT, "lastFailureAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL, "notificationId" TEXT NOT NULL, "recipientId" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "deviceId" TEXT, "channel" "NotificationChannel" NOT NULL, "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "providerMessageId" TEXT, "errorCode" TEXT, "attemptCount" INTEGER NOT NULL DEFAULT 0, "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "userId" TEXT NOT NULL, "category" "NotificationCategory" NOT NULL,
  "inApp" BOOLEAN NOT NULL DEFAULT true, "push" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationRecipient_tenantId_userId_isArchived_createdAt_idx" ON "NotificationRecipient"("tenantId","userId","isArchived","createdAt");
CREATE INDEX "NotificationRecipient_tenantId_userId_isRead_createdAt_idx" ON "NotificationRecipient"("tenantId","userId","isRead","createdAt");
CREATE UNIQUE INDEX "NotificationRecipient_notificationId_userId_key" ON "NotificationRecipient"("notificationId","userId");
CREATE UNIQUE INDEX "PushDevice_token_key" ON "PushDevice"("token");
CREATE INDEX "PushDevice_tenantId_enabled_updatedAt_idx" ON "PushDevice"("tenantId","enabled","updatedAt");
CREATE INDEX "PushDevice_userId_enabled_idx" ON "PushDevice"("userId","enabled");
CREATE UNIQUE INDEX "PushDevice_tenantId_userId_installationId_key" ON "PushDevice"("tenantId","userId","installationId");
CREATE INDEX "NotificationDelivery_tenantId_status_createdAt_idx" ON "NotificationDelivery"("tenantId","status","createdAt");
CREATE INDEX "NotificationDelivery_deviceId_status_idx" ON "NotificationDelivery"("deviceId","status");
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_userId_deviceId_channel_key" ON "NotificationDelivery"("notificationId","userId","deviceId","channel");
CREATE INDEX "NotificationPreference_tenantId_userId_idx" ON "NotificationPreference"("tenantId","userId");
CREATE UNIQUE INDEX "NotificationPreference_tenantId_userId_category_key" ON "NotificationPreference"("tenantId","userId","category");
CREATE INDEX "Notification_tenantId_type_createdAt_idx" ON "Notification"("tenantId","type","createdAt");
CREATE UNIQUE INDEX "Notification_tenantId_idempotencyKey_key" ON "Notification"("tenantId","idempotencyKey");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "NotificationRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "PushDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
