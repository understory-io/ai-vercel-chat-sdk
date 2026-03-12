import { NextResponse } from 'next/server';
import { db } from '@/lib/db/queries';
import { mcpOAuthClient } from '@/lib/db/schema';

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://product-documentation-generator.vercel.app';

/**
 * Returns the set of allowed origins for redirect URIs.
 * Includes the configured app URL and, for Vercel preview deployments,
 * the VERCEL_URL if available.
 */
function getAllowedOrigins(): URL[] {
  const origins: URL[] = [new URL(BASE_URL)];

  // In local development, also allow localhost variants
  if (BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1')) {
    try {
      const localUrl = new URL(BASE_URL);
      if (localUrl.protocol === 'http:') {
        origins.push(new URL(`https://${localUrl.host}`));
      }
    } catch {
      // ignore parse errors
    }
  }

  // Support Vercel preview deployment URLs
  if (process.env.VERCEL_URL) {
    try {
      origins.push(new URL(`https://${process.env.VERCEL_URL}`));
    } catch {
      // ignore parse errors
    }
  }

  return origins;
}

/**
 * Validates that a redirect URI's origin matches one of the allowed app origins.
 * This prevents attackers from registering clients that redirect to external domains.
 */
function isAllowedRedirectUri(uri: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }

  // Only allow http/https schemes
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.some(
    (allowed) =>
      parsed.hostname === allowed.hostname && parsed.port === allowed.port,
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_client_metadata' },
      { status: 400 },
    );
  }

  const clientName = (body.client_name as string) || 'Unknown Client';
  const redirectUris = (body.redirect_uris as string[]) || [];
  const grantTypes = (body.grant_types as string[]) || ['authorization_code'];

  // Validate that all redirect URIs point to this application's domain.
  // This prevents attackers from registering clients with external redirect URIs
  // that could be used to steal authorization codes.
  if (redirectUris.length === 0) {
    return NextResponse.json(
      {
        error: 'invalid_client_metadata',
        error_description: 'At least one redirect_uri is required',
      },
      { status: 400 },
    );
  }

  const invalidUris = redirectUris.filter((uri) => !isAllowedRedirectUri(uri));
  if (invalidUris.length > 0) {
    return NextResponse.json(
      {
        error: 'invalid_redirect_uri',
        error_description: `redirect_uris must point to this application's domain (${new URL(BASE_URL).hostname}). Invalid URIs: ${invalidUris.join(', ')}`,
      },
      { status: 400 },
    );
  }

  // Generate a random client_id
  const clientId = crypto.randomUUID();

  try {
    await db.insert(mcpOAuthClient).values({
      clientId,
      clientName,
      redirectUris,
      grantTypes,
    });
  } catch (error) {
    console.error('MCP register error:', error);
    return NextResponse.json(
      { error: 'registration_failed', details: String(error) },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      client_id: clientId,
      client_name: clientName,
      redirect_uris: redirectUris,
      grant_types: grantTypes,
      token_endpoint_auth_method: 'none',
    },
    { status: 201 },
  );
}
