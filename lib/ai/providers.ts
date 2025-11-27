import { customProvider } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { chatModel, titleModel } from './models.test';
import { isTestEnvironment } from '../constants';

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        // Shared utility model for titles (cheap & fast)
        'title-model': titleModel,
        // User-selectable chat models
        'gpt41-model': chatModel,
        'claude-opus45-model': chatModel,
      },
    })
  : customProvider({
      languageModels: {
        // Shared utility model for titles (cheap & fast)
        'title-model': openai('gpt-4o-mini'),
        // User-selectable chat models
        'gpt41-model': openai('gpt-4.1-2025-04-14'),
        'claude-opus45-model': anthropic('claude-opus-4-5-20251101'),
      },
      imageModels: {
        'small-model': openai.image('dall-e-3'),
      },
    });
