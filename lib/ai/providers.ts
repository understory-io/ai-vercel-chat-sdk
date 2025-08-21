import { customProvider } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';
import { isTestEnvironment } from '../constants';

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
        'claude-chat-model': chatModel,
        'claude-title-model': titleModel,
        'claude-artifact-model': artifactModel,
        'claude-sonnet-model': chatModel,
        'claude-sonnet-title-model': titleModel,
        'claude-sonnet-artifact-model': artifactModel,
      },
    })
  : customProvider({
      languageModels: {
        'chat-model': openai.responses('gpt-5'),
        'chat-model-reasoning': openai.responses('gpt-5'),
        'title-model': openai.responses('gpt-5-mini'),
        'artifact-model': openai.responses('gpt-5'),
        'claude-chat-model': anthropic('claude-opus-4-1-20250805'),
        'claude-title-model': anthropic('claude-3-5-haiku-20241022'),
        'claude-artifact-model': anthropic('claude-opus-4-1-20250805'),
        'claude-sonnet-model': anthropic('claude-sonnet-4-20250514'),
        'claude-sonnet-title-model': anthropic('claude-3-5-haiku-20241022'),
        'claude-sonnet-artifact-model': anthropic('claude-sonnet-4-20250514'),
      },
      imageModels: {
        'small-model': openai.image('dall-e-3'),
      },
    });
