-- Add review workflow columns to ArticleDraft
-- status already uses varchar (not enum), so 'pending_review' works without migration
ALTER TABLE "ArticleDraft" ADD COLUMN IF NOT EXISTS "submittedAt" timestamp;
ALTER TABLE "ArticleDraft" ADD COLUMN IF NOT EXISTS "reviewedBy" uuid REFERENCES "User"("id");
ALTER TABLE "ArticleDraft" ADD COLUMN IF NOT EXISTS "reviewedAt" timestamp;
