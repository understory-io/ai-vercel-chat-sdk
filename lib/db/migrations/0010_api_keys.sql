CREATE TABLE IF NOT EXISTS "ApiKey" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "keyHash" varchar(64) NOT NULL,
  "keyPrefix" varchar(8) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "expiresAt" timestamp,
  "lastUsedAt" timestamp,
  "revokedAt" timestamp
);

CREATE INDEX IF NOT EXISTS "ApiKey_keyHash_idx" ON "ApiKey" ("keyHash");
CREATE INDEX IF NOT EXISTS "ApiKey_userId_idx" ON "ApiKey" ("userId");
