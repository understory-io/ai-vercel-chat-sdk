import { NextResponse } from 'next/server';
import { db } from '@/lib/db/queries';
import { mcpOAuthClient, mcpAuthCode } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://product-documentation-generator.vercel.app';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get('client_id');
  const redirectUri = url.searchParams.get('redirect_uri');
  const codeChallenge = url.searchParams.get('code_challenge');
  const codeChallengeMethod = url.searchParams.get('code_challenge_method');
  const state = url.searchParams.get('state');
  const scope = url.searchParams.get('scope') || 'drafts';
  const resource = url.searchParams.get('resource') || `${BASE_URL}/api/mcp`;

  if (!clientId || !redirectUri || !codeChallenge || !state) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing required parameters' },
      { status: 400 },
    );
  }

  if (codeChallengeMethod !== 'S256') {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Only S256 code_challenge_method is supported' },
      { status: 400 },
    );
  }

  // Validate client
  const [client] = await db
    .select()
    .from(mcpOAuthClient)
    .where(eq(mcpOAuthClient.clientId, clientId));

  if (!client) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Unknown client_id' },
      { status: 400 },
    );
  }

  // Create a pending auth code row (no user yet — populated after Google callback)
  const pendingId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await db.insert(mcpAuthCode).values({
    id: pendingId,
    code: `pending_${pendingId}`,
    clientId,
    redirectUri,
    codeChallenge,
    resource,
    scope,
    state,
    expiresAt,
  });

  // Set cookie linking browser session to this pending auth
  const cookieStore = await cookies();
  cookieStore.set('mcp_auth_pending', pendingId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300, // 5 minutes
    path: '/',
  });

  // Redirect to Google OAuth
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  // biome-ignore lint: Forbidden non-null assertion.
  googleAuthUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
  googleAuthUrl.searchParams.set('redirect_uri', `${BASE_URL}/api/mcp/callback`);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('hd', 'understory.io');
  googleAuthUrl.searchParams.set('state', pendingId);
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'consent');

  return NextResponse.redirect(googleAuthUrl.toString());
}
