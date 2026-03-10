import { NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://product-documentation-generator.vercel.app';

export function GET() {
  return NextResponse.json({
    issuer: BASE_URL,
    authorization_endpoint: `${BASE_URL}/api/mcp/authorize`,
    token_endpoint: `${BASE_URL}/api/mcp/token`,
    registration_endpoint: `${BASE_URL}/api/mcp/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['drafts'],
  });
}
