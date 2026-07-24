-- Allow a teacher to attach an optional image to an exam question.
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
