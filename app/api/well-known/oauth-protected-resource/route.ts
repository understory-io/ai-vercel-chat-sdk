import { NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://product-documentation-generator.vercel.app';

export function GET() {
  return NextResponse.json({
    resource: `${BASE_URL}/api/mcp`,
    authorization_servers: [BASE_URL],
    scopes_supported: ['drafts'],
    bearer_methods_supported: ['header'],
  });
}
