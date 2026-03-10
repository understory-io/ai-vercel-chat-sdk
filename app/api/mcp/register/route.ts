import { NextResponse } from 'next/server';
import { db } from '@/lib/db/queries';
import { mcpOAuthClient } from '@/lib/db/schema';

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
