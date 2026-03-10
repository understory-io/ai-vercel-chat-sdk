CREATE TABLE IF NOT EXISTS "ArticleDraft" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "description" varchar(255),
  "status" varchar DEFAULT 'draft' NOT NULL,
  "intercomArticleId" varchar(255),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ArticleDraft_userId_idx" ON "ArticleDraft" ("userId");
CREATE INDEX IF NOT EXISTS "ArticleDraft_status_idx" ON "ArticleDraft" ("status");
