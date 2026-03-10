import 'server-only';

import { auth } from '@/app/(auth)/auth';
import { headers } from 'next/headers';
import { verifyAccessToken } from '@/lib/mcp/jwt';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://product-documentation-generator.vercel.app';

/**
 * Get the authenticated user ID from NextAuth session or MCP JWT Bearer token.
 */
export async function getAuthenticatedUser(): Promise<{
  userId: string;
  authMethod: 'session' | 'mcp-jwt';
} | null> {
  // Try NextAuth session first
  const session = await auth();
  if (session?.user?.id) {
    return { userId: session.user.id, authMethod: 'session' };
  }

  // Fall back to MCP JWT Bearer token
  const headerStore = await headers();
  const authHeader = headerStore.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const payload = await verifyAccessToken(token, `${BASE_URL}/api/mcp`);
      return { userId: payload.sub, authMethod: 'mcp-jwt' };
    } catch {
      // Invalid token — fall through to null
    }
  }

  return null;
}
