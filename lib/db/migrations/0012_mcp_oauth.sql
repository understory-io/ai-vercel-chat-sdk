-- Drop the ApiKey table (replaced by MCP OAuth)
DROP TABLE IF EXISTS "ApiKey";

-- MCP OAuth Client Registration
CREATE TABLE IF NOT EXISTS "McpOAuthClient" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clientId" varchar(255) NOT NULL UNIQUE,
  "clientName" varchar(255) NOT NULL,
  "redirectUris" json DEFAULT '[]'::json NOT NULL,
  "grantTypes" json DEFAULT '["authorization_code"]'::json NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

-- MCP Authorization Codes (short-lived, single-use)
CREATE TABLE IF NOT EXISTS "McpAuthCode" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(255) NOT NULL UNIQUE,
  "clientId" varchar(255) NOT NULL,
  "userId" uuid REFERENCES "User"("id"),
  "redirectUri" text NOT NULL,
  "codeChallenge" text NOT NULL,
  "resource" text,
  "scope" varchar(255),
  "state" text,
  "expiresAt" timestamp NOT NULL,
  "usedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

-- MCP Refresh Tokens (long-lived, rotated on use)
CREATE TABLE IF NOT EXISTS "McpRefreshToken" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tokenHash" varchar(64) NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "clientId" varchar(255) NOT NULL,
  "scope" varchar(255),
  "expiresAt" timestamp NOT NULL,
  "revokedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
