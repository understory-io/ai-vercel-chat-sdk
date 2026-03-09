import type { ChatModel } from './models';

interface Entitlements {
  maxMessagesPerDay: number;
  availableChatModelIds: Array<ChatModel['id']>;
}

const regularEntitlements: Entitlements = {
  maxMessagesPerDay: 999999,
  availableChatModelIds: ['gpt41-model', 'claude-opus45-model'],
};

export function getEntitlements(userType: string): Entitlements {
  // All users get regular entitlements. Fallback handles cached 'guest' JWTs
  // from before the Google OAuth migration.
  return regularEntitlements;
}
