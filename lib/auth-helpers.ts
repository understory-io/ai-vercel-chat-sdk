import 'server-only';

import { auth } from '@/app/(auth)/auth';
import { headers } from 'next/headers';

/**
 * Get the authenticated user ID from either NextAuth session or API key.
 * The API key user ID is injected by middleware via x-api-key-user-id header.
 */
export async function getAuthenticatedUser(): Promise<{
  userId: string;
  authMethod: 'session' | 'api-key';
} | null> {
  // Check for API key auth (set by middleware)
  const headerStore = await headers();
  const apiKeyUserId = headerStore.get('x-api-key-user-id');
  if (apiKeyUserId) {
    return { userId: apiKeyUserId, authMethod: 'api-key' };
  }

  // Fall back to NextAuth session
  const session = await auth();
  if (session?.user?.id) {
    return { userId: session.user.id, authMethod: 'session' };
  }

  return null;
}
