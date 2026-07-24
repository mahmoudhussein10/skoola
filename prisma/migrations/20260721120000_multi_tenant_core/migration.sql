-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'DISABLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ActivationCodeStatus" AS ENUM ('ACTIVE', 'EXHAUSTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'GRADED', 'RETURNED');

-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL_TEACHERS', 'SELECTED_TENANTS', 'TEACHERS_ONLY', 'ALL_USERS');

-- CreateEnum
CREATE TYPE "AnnouncementSeverity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL');

-- DropIndex
DROP INDEX "Course_createdById_idx";

-- DropIndex
DROP INDEX "Course_slug_key";

-- DropIndex
DROP INDEX "Course_status_grade_idx";

-- DropIndex
DROP INDEX "Enrollment_courseId_status_idx";

-- DropIndex
DROP INDEX "Enrollment_studentId_courseId_key";

-- DropIndex
DROP INDEX "Enrollment_studentId_status_idx";

-- DropIndex
DROP INDEX "Exam_courseId_status_idx";

-- DropIndex
DROP INDEX "ExamAttempt_examId_status_idx";

-- DropIndex
DROP INDEX "ExamAttempt_studentId_startedAt_idx";

-- DropIndex
DROP INDEX "Lesson_sectionId_status_idx";

-- DropIndex
DROP INDEX "Notification_userId_isRead_createdAt_idx";

-- DropIndex
DROP INDEX "Payment_status_createdAt_idx";

-- DropIndex
DROP INDEX "Payment_studentId_idx";

-- DropIndex
DROP INDEX "Section_courseId_idx";

-- DropIndex
DROP INDEX "StudentProfile_governorate_idx";

-- DropIndex
DROP INDEX "StudentProfile_grade_idx";

-- DropIndex
DROP INDEX "StudentProfile_userId_key";

-- DropIndex
DROP INDEX "VideoProgress_studentId_lessonId_key";

-- DropIndex
DROP INDEX "VideoProgress_studentId_updatedAt_idx";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "after" JSONB,
ADD COLUMN     "before" JSONB,
ADD COLUMN     "ipHash" TEXT,
ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "AuthSession" ADD COLUMN     "activeTenantId" TEXT;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "ExamAttempt" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "allowedUploadTypes" JSONB,
ADD COLUMN     "defaultTenantStatus" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
ADD COLUMN     "maxUploadSizeMb" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "supportEmail" TEXT,
ADD COLUMN     "teacherRegistrationEnabled" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "platformName" SET DEFAULT 'منصة تعليم';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "VideoProgress" ADD COLUMN     "tenantId" TEXT;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "ownerId" TEXT,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "description" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "subject" TEXT,
    "onboardingStep" INTEGER NOT NULL DEFAULT 1,
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "suspendedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "permissions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivationCode" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "courseId" TEXT,
    "codeHash" TEXT NOT NULL,
    "label" TEXT,
    "status" "ActivationCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lessonId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "content" TEXT,
    "fileUrl" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "score" DECIMAL(6,2),
    "feedback" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemeSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#ff6b00',
    "secondaryColor" TEXT NOT NULL DEFAULT '#171411',
    "accentColor" TEXT NOT NULL DEFAULT '#ff922d',
    "backgroundColor" TEXT NOT NULL DEFAULT '#fbfaf8',
    "surfaceColor" TEXT NOT NULL DEFAULT '#ffffff',
    "textColor" TEXT NOT NULL DEFAULT '#171411',
    "mutedColor" TEXT NOT NULL DEFAULT '#6d6761',
    "primaryForeground" TEXT NOT NULL DEFAULT '#ffffff',
    "borderRadius" INTEGER NOT NULL DEFAULT 16,
    "buttonRadius" INTEGER NOT NULL DEFAULT 14,
    "fontFamily" TEXT NOT NULL DEFAULT 'Tajawal',
    "loginCoverUrl" TEXT,
    "preset" TEXT NOT NULL DEFAULT 'CLEAN_ORANGE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThemeSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "platformName" TEXT NOT NULL,
    "heroTitle" TEXT,
    "description" TEXT,
    "supportPhone" TEXT,
    "supportEmail" TEXT,
    "socialLinks" JSONB,
    "locale" TEXT NOT NULL DEFAULT 'ar-EG',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Cairo',
    "publicPageLive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffInvitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "permissions" JSONB,
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "StaffInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "AnnouncementSeverity" NOT NULL DEFAULT 'INFO',
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL_TEACHERS',
    "tenantIds" JSONB,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "dismissible" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemAnnouncement_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_status_createdAt_idx" ON "Tenant"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Tenant_ownerId_idx" ON "Tenant"("ownerId");

-- CreateIndex
CREATE INDEX "TenantMember_tenantId_role_status_idx" ON "TenantMember"("tenantId", "role", "status");

-- CreateIndex
CREATE INDEX "TenantMember_userId_status_idx" ON "TenantMember"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMember_tenantId_userId_key" ON "TenantMember"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivationCode_codeHash_key" ON "ActivationCode"("codeHash");

-- CreateIndex
CREATE INDEX "ActivationCode_tenantId_status_createdAt_idx" ON "ActivationCode"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ActivationCode_tenantId_courseId_idx" ON "ActivationCode"("tenantId", "courseId");

-- CreateIndex
CREATE INDEX "Assignment_tenantId_courseId_status_idx" ON "Assignment"("tenantId", "courseId", "status");

-- CreateIndex
CREATE INDEX "Assignment_tenantId_dueAt_idx" ON "Assignment"("tenantId", "dueAt");

-- CreateIndex
CREATE INDEX "Submission_tenantId_status_submittedAt_idx" ON "Submission"("tenantId", "status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_tenantId_assignmentId_studentId_key" ON "Submission"("tenantId", "assignmentId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ThemeSettings_tenantId_key" ON "ThemeSettings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSettings_tenantId_key" ON "TenantSettings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffInvitation_tokenHash_key" ON "StaffInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffInvitation_tenantId_status_createdAt_idx" ON "StaffInvitation"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffInvitation_tenantId_email_status_key" ON "StaffInvitation"("tenantId", "email", "status");

-- CreateIndex
CREATE INDEX "ActivityLog_tenantId_createdAt_idx" ON "ActivityLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_tenantId_action_idx" ON "ActivityLog"("tenantId", "action");

-- CreateIndex
CREATE INDEX "SystemAnnouncement_active_startsAt_endsAt_idx" ON "SystemAnnouncement"("active", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthSession_activeTenantId_idx" ON "AuthSession"("activeTenantId");

-- CreateIndex
CREATE INDEX "Course_tenantId_status_grade_idx" ON "Course"("tenantId", "status", "grade");

-- CreateIndex
CREATE INDEX "Course_tenantId_createdAt_idx" ON "Course"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Course_tenantId_createdById_idx" ON "Course"("tenantId", "createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Course_tenantId_slug_key" ON "Course"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "Enrollment_tenantId_studentId_status_idx" ON "Enrollment"("tenantId", "studentId", "status");

-- CreateIndex
CREATE INDEX "Enrollment_tenantId_courseId_status_idx" ON "Enrollment"("tenantId", "courseId", "status");

-- CreateIndex
CREATE INDEX "Enrollment_tenantId_enrolledAt_idx" ON "Enrollment"("tenantId", "enrolledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_tenantId_studentId_courseId_key" ON "Enrollment"("tenantId", "studentId", "courseId");

-- CreateIndex
CREATE INDEX "Exam_tenantId_courseId_status_idx" ON "Exam"("tenantId", "courseId", "status");

-- CreateIndex
CREATE INDEX "ExamAttempt_tenantId_studentId_startedAt_idx" ON "ExamAttempt"("tenantId", "studentId", "startedAt");

-- CreateIndex
CREATE INDEX "ExamAttempt_tenantId_examId_status_idx" ON "ExamAttempt"("tenantId", "examId", "status");

-- CreateIndex
CREATE INDEX "Lesson_tenantId_sectionId_status_idx" ON "Lesson"("tenantId", "sectionId", "status");

-- CreateIndex
CREATE INDEX "Lesson_tenantId_createdAt_idx" ON "Lesson"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_userId_isRead_createdAt_idx" ON "Notification"("tenantId", "userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_tenantId_status_createdAt_idx" ON "Payment"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_tenantId_studentId_idx" ON "Payment"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "Question_tenantId_examId_idx" ON "Question"("tenantId", "examId");

-- CreateIndex
CREATE INDEX "Section_tenantId_courseId_idx" ON "Section"("tenantId", "courseId");

-- CreateIndex
CREATE INDEX "StudentProfile_tenantId_grade_idx" ON "StudentProfile"("tenantId", "grade");

-- CreateIndex
CREATE INDEX "StudentProfile_tenantId_governorate_idx" ON "StudentProfile"("tenantId", "governorate");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_tenantId_userId_key" ON "StudentProfile"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "VideoProgress_tenantId_studentId_updatedAt_idx" ON "VideoProgress"("tenantId", "studentId", "updatedAt");

-- CreateIndex
CREATE INDEX "VideoProgress_tenantId_completed_idx" ON "VideoProgress"("tenantId", "completed");

-- CreateIndex
CREATE UNIQUE INDEX "VideoProgress_tenantId_studentId_lessonId_key" ON "VideoProgress"("tenantId", "studentId", "lessonId");

-- Safe data migration for the original single-teacher installation.
INSERT INTO "Tenant" ("id","name","slug","status","ownerId","description","subject","onboardingStep","onboardingDone","createdAt","updatedAt")
VALUES (
  'tenant_default_abdelrahman','منصة د. عبد الرحمن حسان','abdelrahman-hassan','ACTIVE',
  COALESCE(
    (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "createdAt" LIMIT 1),
    (SELECT "createdById" FROM "Course" ORDER BY "createdAt" LIMIT 1)
  ),
  'منصة الكيمياء لطلاب الثانوية العامة','الكيمياء',9,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "Course" SET "tenantId"='tenant_default_abdelrahman' WHERE "tenantId" IS NULL;
UPDATE "Section" s SET "tenantId"=c."tenantId" FROM "Course" c WHERE s."courseId"=c."id" AND s."tenantId" IS NULL;
UPDATE "Lesson" l SET "tenantId"=s."tenantId" FROM "Section" s WHERE l."sectionId"=s."id" AND l."tenantId" IS NULL;
UPDATE "Enrollment" e SET "tenantId"=c."tenantId" FROM "Course" c WHERE e."courseId"=c."id" AND e."tenantId" IS NULL;
UPDATE "VideoProgress" v SET "tenantId"=l."tenantId" FROM "Lesson" l WHERE v."lessonId"=l."id" AND v."tenantId" IS NULL;
UPDATE "Exam" e SET "tenantId"=c."tenantId" FROM "Course" c WHERE e."courseId"=c."id" AND e."tenantId" IS NULL;
UPDATE "Question" q SET "tenantId"=e."tenantId" FROM "Exam" e WHERE q."examId"=e."id" AND q."tenantId" IS NULL;
UPDATE "ExamAttempt" a SET "tenantId"=e."tenantId" FROM "Exam" e WHERE a."examId"=e."id" AND a."tenantId" IS NULL;
UPDATE "Payment" p SET "tenantId"=c."tenantId" FROM "Course" c WHERE p."courseId"=c."id" AND p."tenantId" IS NULL;
UPDATE "StudentProfile" SET "tenantId"='tenant_default_abdelrahman' WHERE "tenantId" IS NULL;
UPDATE "Notification" SET "tenantId"='tenant_default_abdelrahman' WHERE "tenantId" IS NULL;

UPDATE "User" SET "role"='TEACHER_OWNER'
WHERE "role"='ADMIN' AND "id"=(SELECT "ownerId" FROM "Tenant" WHERE "id"='tenant_default_abdelrahman');

INSERT INTO "TenantMember" ("id","tenantId","userId","role","status","createdAt","updatedAt")
SELECT 'default-owner-'||u."id",'tenant_default_abdelrahman',u."id",'TEACHER_OWNER','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM "User" u WHERE u."id"=(SELECT "ownerId" FROM "Tenant" WHERE "id"='tenant_default_abdelrahman')
ON CONFLICT ("tenantId","userId") DO NOTHING;

INSERT INTO "TenantMember" ("id","tenantId","userId","role","status","createdAt","updatedAt")
SELECT 'default-student-'||u."id",'tenant_default_abdelrahman',u."id",'STUDENT','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM "User" u WHERE u."role"='STUDENT'
ON CONFLICT ("tenantId","userId") DO NOTHING;

INSERT INTO "ThemeSettings" ("id","tenantId","createdAt","updatedAt")
VALUES ('theme_default_abdelrahman','tenant_default_abdelrahman',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId") DO NOTHING;

INSERT INTO "TenantSettings" ("id","tenantId","platformName","heroTitle","description","publicPageLive","createdAt","updatedAt")
VALUES ('settings_default_abdelrahman','tenant_default_abdelrahman','منصة د. عبد الرحمن حسان','الكيمياء مش حفظ، الكيمياء حكاية هتفهمها.','شرح وتدريب ومتابعة لطلاب الثانوية العامة.',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId") DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (
      SELECT "tenantId" FROM "Course"
      UNION ALL SELECT "tenantId" FROM "Section"
      UNION ALL SELECT "tenantId" FROM "Lesson"
      UNION ALL SELECT "tenantId" FROM "Enrollment"
      UNION ALL SELECT "tenantId" FROM "VideoProgress"
      UNION ALL SELECT "tenantId" FROM "Exam"
      UNION ALL SELECT "tenantId" FROM "Question"
      UNION ALL SELECT "tenantId" FROM "ExamAttempt"
      UNION ALL SELECT "tenantId" FROM "Payment"
      UNION ALL SELECT "tenantId" FROM "StudentProfile"
      UNION ALL SELECT "tenantId" FROM "Notification"
    ) tenant_rows WHERE "tenantId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Tenant backfill validation failed; migration aborted';
  END IF;
END $$;

ALTER TABLE "Course" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Section" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Lesson" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Enrollment" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "VideoProgress" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Exam" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Question" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "ExamAttempt" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "StudentProfile" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Notification" ALTER COLUMN "tenantId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMember" ADD CONSTRAINT "TenantMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMember" ADD CONSTRAINT "TenantMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoProgress" ADD CONSTRAINT "VideoProgress_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationCode" ADD CONSTRAINT "ActivationCode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationCode" ADD CONSTRAINT "ActivationCode_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeSettings" ADD CONSTRAINT "ThemeSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSettings" ADD CONSTRAINT "TenantSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
