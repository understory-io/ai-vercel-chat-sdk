export const DEFAULT_CHAT_MODEL: string = 'gpt41-model';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

// All models kept for easy future deployment - only GPT-4.1 exposed via entitlements
export const chatModels: Array<ChatModel> = [
  {
    id: 'claude-sonnet-model',
    name: 'Claude Sonnet 4',
    description: 'Fast, capable, and reliable - best balance of speed and quality',
  },
  {
    id: 'gpt41-model',
    name: 'GPT-4.1',
    description: 'OpenAI\'s flagship model with vision, 1M context window, and generous rate limits',
  },
  {
    id: 'claude-chat-model',
    name: 'Claude Opus 4.1',
    description: 'Anthropic\'s most powerful model - highest quality but may hit capacity limits',
  },
  {
    id: 'chat-model',
    name: 'GPT-5 (Beta)',
    description: 'OpenAI\'s reasoning model - first messages work, multi-turn has issues',
  },
];
