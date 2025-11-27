export const DEFAULT_CHAT_MODEL: string = 'gpt41-model';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'gpt41-model',
    name: 'GPT-4.1',
    description: 'OpenAI\'s flagship model - fast, reliable with 1M context window',
  },
  {
    id: 'claude-opus45-model',
    name: 'Claude Opus 4.5',
    description: 'Anthropic\'s best model - industry-leading coding & documentation quality',
  },
];
