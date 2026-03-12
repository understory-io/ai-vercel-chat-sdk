import { NextResponse } from 'next/server';
import { db } from '@/lib/db/queries';
import { mcpAuthCode, mcpRefreshToken } from '@/lib/db/schema';
import { and, eq, isNull, gt } from 'drizzle-orm';
import { signAccessToken } from '@/lib/mcp/jwt';

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://product-documentation-generator.vercel.app';

async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function POST(request: Request) {
  let body: URLSearchParams;
  try {
    const text = await request.text();
    body = new URLSearchParams(text);
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const grantType = body.get('grant_type');

  if (grantType === 'authorization_code') {
    return handleAuthorizationCode(body);
  }
  if (grantType === 'refresh_token') {
    return handleRefreshToken(body);
  }

  return NextResponse.json(
    { error: 'unsupported_grant_type' },
    { status: 400 },
  );
}

async function handleAuthorizationCode(body: URLSearchParams) {
  const code = body.get('code');
  const codeVerifier = body.get('code_verifier');
  const redirectUri = body.get('redirect_uri');

  if (!code || !codeVerifier) {
    return NextResponse.json(
      {
        error: 'invalid_request',
        error_description: 'Missing code or code_verifier',
      },
      { status: 400 },
    );
  }

  // Atomically claim the auth code (prevents TOCTOU race condition)
  const [authCodeRow] = await db
    .update(mcpAuthCode)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(mcpAuthCode.code, code),
        isNull(mcpAuthCode.usedAt),
        gt(mcpAuthCode.expiresAt, new Date()),
      ),
    )
    .returning();

  if (!authCodeRow || !authCodeRow.userId) {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }

  // Validate redirect_uri matches
  if (redirectUri && redirectUri !== authCodeRow.redirectUri) {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }

  // Verify PKCE: SHA256(code_verifier) must match stored code_challenge
  const computedChallenge = await sha256(codeVerifier);
  if (computedChallenge !== authCodeRow.codeChallenge) {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }

  const audience = authCodeRow.resource || `${BASE_URL}/api/mcp`;
  const scope = authCodeRow.scope || 'drafts';

  // Issue access token
  const accessToken = await signAccessToken(
    authCodeRow.userId,
    audience,
    scope,
  );

  // Issue refresh token
  const refreshTokenValue = crypto.randomUUID();
  const refreshTokenHash = await sha256Hex(refreshTokenValue);

  await db.insert(mcpRefreshToken).values({
    tokenHash: refreshTokenHash,
    userId: authCodeRow.userId,
    clientId: authCodeRow.clientId,
    scope,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });

  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: refreshTokenValue,
    scope,
  });
}

async function handleRefreshToken(body: URLSearchParams) {
  const refreshTokenValue = body.get('refresh_token');

  if (!refreshTokenValue) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing refresh_token' },
      { status: 400 },
    );
  }

  const tokenHash = await sha256Hex(refreshTokenValue);

  // Look up the refresh token
  const [tokenRow] = await db
    .select()
    .from(mcpRefreshToken)
    .where(
      and(
        eq(mcpRefreshToken.tokenHash, tokenHash),
        isNull(mcpRefreshToken.revokedAt),
        gt(mcpRefreshToken.expiresAt, new Date()),
      ),
    );

  if (!tokenRow) {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }

  // Revoke the old refresh token (rotation)
  await db
    .update(mcpRefreshToken)
    .set({ revokedAt: new Date() })
    .where(eq(mcpRefreshToken.id, tokenRow.id));

  const audience = `${BASE_URL}/api/mcp`;
  const scope = tokenRow.scope || 'drafts';

  // Issue new access token
  const accessToken = await signAccessToken(tokenRow.userId, audience, scope);

  // Issue new refresh token
  const newRefreshTokenValue = crypto.randomUUID();
  const newRefreshTokenHash = await sha256Hex(newRefreshTokenValue);

  await db.insert(mcpRefreshToken).values({
    tokenHash: newRefreshTokenHash,
    userId: tokenRow.userId,
    clientId: tokenRow.clientId,
    scope,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });

  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: newRefreshTokenValue,
    scope,
  });
}
