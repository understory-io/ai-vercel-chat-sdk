import { type APIRequestContext, request as playwrightRequest } from '@playwright/test';
import crypto from 'node:crypto';

const baseURL = `http://localhost:${process.env.PORT || 3000}`;

/**
 * Creates a test user directly in the database and generates an API key.
 * Returns the API key plaintext for use in Authorization headers.
 *
 * This bypasses Google OAuth entirely, which is exactly what we need
 * for testing API key authentication end-to-end.
 */
export async function createTestUserWithApiKey(opts: {
  name: string;
  request: APIRequestContext;
}): Promise<{
  userId: string;
  apiKey: string;
  keyId: string;
}> {
  // We use a raw SQL endpoint isn't available, so we seed directly
  // via the postgres client. Import dynamically to avoid 'server-only' issues.
  const postgres = (await import('postgres')).default;
  const sql = postgres(process.env.POSTGRES_URL!);

  try {
    const email = `test-${opts.name}-${Date.now()}@test.playwright.io`;

    // 1. Create user directly in DB
    const [dbUser] = await sql`
      INSERT INTO "User" ("email", "name")
      VALUES (${email}, ${opts.name})
      RETURNING "id"
    `;

    const userId = dbUser.id;

    // 2. Generate an API key
    const randomBytes = crypto.randomBytes(32);
    const plainKey = `sk_${randomBytes.toString('base64url').slice(0, 45)}`;
    const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
    const keyPrefix = plainKey.slice(0, 8);

    // 3. Store hashed key in DB
    const [keyRecord] = await sql`
      INSERT INTO "ApiKey" ("userId", "name", "keyHash", "keyPrefix")
      VALUES (${userId}, ${'test-key'}, ${keyHash}, ${keyPrefix})
      RETURNING "id"
    `;

    return {
      userId,
      apiKey: plainKey,
      keyId: keyRecord.id,
    };
  } finally {
    await sql.end();
  }
}

/**
 * Creates an API request context with an API key in the Authorization header.
 */
export async function createApiContext(apiKey: string): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Creates a revoked API key for a user (for testing revoked key rejection).
 */
export async function createRevokedApiKey(userId: string): Promise<string> {
  const postgres = (await import('postgres')).default;
  const sql = postgres(process.env.POSTGRES_URL!);

  try {
    const randomBytes = crypto.randomBytes(32);
    const plainKey = `sk_${randomBytes.toString('base64url').slice(0, 45)}`;
    const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
    const keyPrefix = plainKey.slice(0, 8);

    await sql`
      INSERT INTO "ApiKey" ("userId", "name", "keyHash", "keyPrefix", "revokedAt")
      VALUES (${userId}, ${'revoked-test-key'}, ${keyHash}, ${keyPrefix}, NOW())
    `;

    return plainKey;
  } finally {
    await sql.end();
  }
}

/**
 * Creates an expired API key for a user (for testing expired key rejection).
 */
export async function createExpiredApiKey(userId: string): Promise<string> {
  const postgres = (await import('postgres')).default;
  const sql = postgres(process.env.POSTGRES_URL!);

  try {
    const randomBytes = crypto.randomBytes(32);
    const plainKey = `sk_${randomBytes.toString('base64url').slice(0, 45)}`;
    const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
    const keyPrefix = plainKey.slice(0, 8);

    await sql`
      INSERT INTO "ApiKey" ("userId", "name", "keyHash", "keyPrefix", "expiresAt")
      VALUES (${userId}, ${'expired-test-key'}, ${keyHash}, ${keyPrefix}, NOW() - INTERVAL '1 day')
    `;

    return plainKey;
  } finally {
    await sql.end();
  }
}

/**
 * Cleans up test data created during tests.
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  const postgres = (await import('postgres')).default;
  const sql = postgres(process.env.POSTGRES_URL!);

  try {
    // Cascade deletes handle ApiKey and ArticleDraft via FK
    await sql`DELETE FROM "ApiKey" WHERE "userId" = ${userId}`;
    await sql`DELETE FROM "ArticleDraft" WHERE "userId" = ${userId}`;
    await sql`DELETE FROM "User" WHERE "id" = ${userId}`;
  } finally {
    await sql.end();
  }
}
