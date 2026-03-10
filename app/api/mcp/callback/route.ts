import { NextResponse } from 'next/server';
import { db } from '@/lib/db/queries';
import { mcpAuthCode, user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://product-documentation-generator.vercel.app';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const googleCode = url.searchParams.get('code');
  const pendingId = url.searchParams.get('state');

  if (!googleCode || !pendingId) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  // Verify cookie matches
  const cookieStore = await cookies();
  const cookiePendingId = cookieStore.get('mcp_auth_pending')?.value;
  if (cookiePendingId !== pendingId) {
    return NextResponse.json({ error: 'State mismatch' }, { status: 400 });
  }

  // Clear the cookie
  cookieStore.delete('mcp_auth_pending');

  // Look up the pending auth code row
  const [pendingAuth] = await db
    .select()
    .from(mcpAuthCode)
    .where(eq(mcpAuthCode.id, pendingId));

  if (!pendingAuth || pendingAuth.usedAt) {
    return NextResponse.json({ error: 'Invalid or expired auth request' }, { status: 400 });
  }

  if (new Date() > pendingAuth.expiresAt) {
    return NextResponse.json({ error: 'Auth request expired' }, { status: 400 });
  }

  // Exchange Google code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    // biome-ignore lint: Forbidden non-null assertion.
    body: new URLSearchParams({
      code: googleCode,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${BASE_URL}/api/mcp/callback`,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.json({ error: 'Google token exchange failed' }, { status: 502 });
  }

  const tokenData = await tokenRes.json();

  // Get user info from Google
  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userInfoRes.ok) {
    return NextResponse.json({ error: 'Failed to get user info' }, { status: 502 });
  }

  const userInfo = await userInfoRes.json();

  // Verify @understory.io domain
  if (!userInfo.email?.endsWith('@understory.io')) {
    return NextResponse.json({ error: 'Only @understory.io accounts are allowed' }, { status: 403 });
  }

  // Look up or create user
  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, userInfo.email));

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    const [newUser] = await db
      .insert(user)
      .values({
        email: userInfo.email,
        name: userInfo.name,
        image: userInfo.picture,
      })
      .returning();
    userId = newUser.id;
  }

  // Generate the actual authorization code
  const authCode = crypto.randomUUID();

  // Update the pending row with the real code and userId
  await db
    .update(mcpAuthCode)
    .set({
      code: authCode,
      userId,
    })
    .where(eq(mcpAuthCode.id, pendingId));

  // Redirect back to Claude Code's redirect_uri
  const redirectUrl = new URL(pendingAuth.redirectUri);
  redirectUrl.searchParams.set('code', authCode);
  if (pendingAuth.state) {
    redirectUrl.searchParams.set('state', pendingAuth.state);
  }

  return NextResponse.redirect(redirectUrl.toString());
}
