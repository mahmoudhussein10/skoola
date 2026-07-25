ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "bunnyStreamCollectionId" TEXT;
CREATE TABLE IF NOT EXISTS "MediaAsset" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "uploadedById" TEXT NOT NULL, "courseId" TEXT, "lessonId" TEXT,
  "resourceType" TEXT NOT NULL, "provider" TEXT NOT NULL, "originalFileName" TEXT NOT NULL, "storedFileName" TEXT,
  "mimeType" TEXT NOT NULL, "fileExtension" TEXT NOT NULL, "fileSizeBytes" BIGINT NOT NULL, "title" TEXT, "altText" TEXT,
  "bunnyVideoId" TEXT, "bunnyCollectionId" TEXT, "bunnyStoragePath" TEXT, "publicUrl" TEXT, "thumbnailUrl" TEXT,
  "playbackUrl" TEXT, "embedUrl" TEXT, "uploadStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "processingStatus" TEXT NOT NULL DEFAULT 'WAITING', "uploadProgress" INTEGER NOT NULL DEFAULT 0,
  "width" INTEGER, "height" INTEGER, "durationSeconds" INTEGER, "errorMessage" TEXT, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3),
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MediaAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MediaAsset_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "MediaAsset_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "MediaAsset_bunnyVideoId_key" ON "MediaAsset"("bunnyVideoId");
CREATE INDEX IF NOT EXISTS "MediaAsset_tenantId_resourceType_createdAt_idx" ON "MediaAsset"("tenantId", "resourceType", "createdAt");
CREATE INDEX IF NOT EXISTS "MediaAsset_tenantId_provider_processingStatus_idx" ON "MediaAsset"("tenantId", "provider", "processingStatus");
CREATE INDEX IF NOT EXISTS "MediaAsset_tenantId_courseId_idx" ON "MediaAsset"("tenantId", "courseId");
CREATE INDEX IF NOT EXISTS "MediaAsset_uploadedById_createdAt_idx" ON "MediaAsset"("uploadedById", "createdAt");