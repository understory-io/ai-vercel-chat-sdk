-- Add new fields for better autosave management
ALTER TABLE "Document" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "Document" ADD COLUMN "isAutosave" boolean DEFAULT true NOT NULL;
ALTER TABLE "Document" ADD COLUMN "versionType" varchar DEFAULT 'autosave' NOT NULL;

-- Add check constraint for versionType
ALTER TABLE "Document" ADD CONSTRAINT "versionType_check" CHECK ("versionType" IN ('autosave', 'explicit', 'ai_update'));