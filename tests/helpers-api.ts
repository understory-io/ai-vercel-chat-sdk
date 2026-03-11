import {
  type APIRequestContext,
  request as playwrightRequest,
} from '@playwright/test';
import { SignJWT } from 'jose';

const baseURL = `http://localhost:${process.env.PORT || 3000}`;

function getSigningKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not set for tests');
  return new TextEncoder().encode(secret);
}

/**
 * Creates a test user directly in the database and generates a JWT access token.
 * Returns the JWT for use in Authorization headers.
 */
export async function createTestUserWithToken(opts: {
  name: string;
  email?: string;
  request: APIRequestContext;
}): Promise<{
  userId: string;
  token: string;
}> {
  const postgres = (await import('postgres')).default;
  // biome-ignore lint: Forbidden non-null assertion.
  const sql = postgres(process.env.POSTGRES_URL!);

  try {
    const email =
      opts.email || `test-${opts.name}-${Date.now()}@test.playwright.io`;

    // Create user directly in DB
    const [dbUser] = await sql`
      INSERT INTO "User" ("email", "name")
      VALUES (${email}, ${opts.name})
      RETURNING "id"
    `;

    const userId = dbUser.id;

    // Generate a JWT access token for MCP auth
    const token = await new SignJWT({ scope: 'drafts' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(baseURL)
      .setAudience(`${baseURL}/api/mcp`)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(getSigningKey());

    return { userId, token };
  } finally {
    await sql.end();
  }
}

/**
 * Creates an API request context with a JWT in the Authorization header.
 */
export async function createApiContext(
  token: string,
): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Cleans up test data created during tests.
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  const postgres = (await import('postgres')).default;
  // biome-ignore lint: Forbidden non-null assertion.
  const sql = postgres(process.env.POSTGRES_URL!);

  try {
    await sql`DELETE FROM "ArticleDraft" WHERE "userId" = ${userId}`;
    await sql`DELETE FROM "User" WHERE "id" = ${userId}`;
  } finally {
    await sql.end();
  }
}
