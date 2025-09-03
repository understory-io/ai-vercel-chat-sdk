DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Document' AND column_name = 'text') THEN
    ALTER TABLE "Document" ADD COLUMN "text" varchar DEFAULT 'text' NOT NULL;
  END IF;
END $$;