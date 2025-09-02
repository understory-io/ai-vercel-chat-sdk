import type { UserType } from '@/app/(auth)/auth';
import type { ChatModel } from './models';

interface Entitlements {
  maxMessagesPerDay: number;
  availableChatModelIds: Array<ChatModel['id']>;
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 999999,
    availableChatModelIds: ['gpt41-model'], // V1: Only GPT-4.1 available
    // Future: Add back ['claude-sonnet-model', 'gpt41-model', 'claude-chat-model', 'chat-model']
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 100,
    availableChatModelIds: ['gpt41-model'], // V1: Only GPT-4.1 available
    // Future: Add back ['claude-sonnet-model', 'gpt41-model', 'claude-chat-model', 'chat-model']
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};
