ALTER TABLE "TeacherBillingSettings"
  ADD COLUMN "vodafoneCashEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "vodafoneCashNumber" TEXT,
  ADD COLUMN "instaPayEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "instaPayAddress" TEXT,
  ADD COLUMN "accountHolderName" TEXT,
  ADD COLUMN "paymentInstructions" TEXT;