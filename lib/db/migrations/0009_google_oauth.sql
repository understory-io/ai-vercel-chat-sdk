-- Add new columns to User table for OAuth support
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" varchar(255);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" timestamp;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "image" text;

-- Create Account table for OAuth provider links
CREATE TABLE IF NOT EXISTS "Account" (
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "type" varchar(255) NOT NULL,
  "provider" varchar(255) NOT NULL,
  "providerAccountId" varchar(255) NOT NULL,
  "refresh_token" text,
  "access_token" text,
  "expires_at" integer,
  "token_type" varchar(255),
  "scope" varchar(255),
  "id_token" text,
  "session_state" varchar(255),
  CONSTRAINT "Account_provider_providerAccountId_pk" PRIMARY KEY("provider", "providerAccountId")
);
