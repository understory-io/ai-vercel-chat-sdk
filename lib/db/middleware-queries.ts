import { sql } from '@vercel/postgres';

export async function validateApiKeyFromDb(keyHash: string) {
  try {
    const { rows } = await sql`
      SELECT "id", "userId" FROM "ApiKey"
      WHERE "keyHash" = ${keyHash}
        AND "revokedAt" IS NULL
        AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
      LIMIT 1
    `;
    return rows[0] ? { id: rows[0].id, userId: rows[0].userId } : null;
  } catch (error) {
    console.error('[middleware-queries] validateApiKeyFromDb error:', error);
    return null;
  }
}
