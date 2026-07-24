CREATE TABLE "SupportSession" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupportSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportSession_tokenHash_key" ON "SupportSession"("tokenHash");
CREATE INDEX "SupportSession_actorUserId_expiresAt_endedAt_idx" ON "SupportSession"("actorUserId", "expiresAt", "endedAt");
CREATE INDEX "SupportSession_tenantId_createdAt_idx" ON "SupportSession"("tenantId", "createdAt");

ALTER TABLE "SupportSession"
  ADD CONSTRAINT "SupportSession_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportSession"
  ADD CONSTRAINT "SupportSession_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;