import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { getMCPTools } from '@/lib/ai/tools/mcp-dynamic-tools';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createRequestContext,
  createCorrelatedLogger,
} from '@/lib/request-context';
import { createPerformanceLogger } from '@/lib/logger';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  const requestContext = createRequestContext(request);
  const perf = createPerformanceLogger('api', 'chat_post');
  let requestBody: PostRequestBody;

  requestContext.logger.info(
    {
      event: 'chat_request_start',
      method: 'POST',
      url: request.url,
    },
    'Starting chat request',
  );

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);

    // Update context with chat information
    requestContext.chatId = requestBody.id;
    requestContext.logger = createCorrelatedLogger(
      requestContext,
      'api',
      'chat',
    );
  } catch (error) {
    perf.error(error as Error, { stage: 'request_parsing' });
    requestContext.logger.error(
      {
        event: 'chat_request_parse_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to parse chat request',
    );
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      perf.error(new Error('Unauthorized'), { stage: 'authentication' });
      requestContext.logger.warn(
        {
          event: 'chat_request_unauthorized',
        },
        'Chat request rejected - no valid session',
      );
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    // Update context with user information
    requestContext.userId = session.user.id;
    requestContext.logger = createCorrelatedLogger(
      requestContext,
      'api',
      'chat',
    );

    const userType: UserType = session.user.type;

    requestContext.logger.info(
      {
        event: 'chat_request_authenticated',
        userId: session.user.id,
        userType: userType,
        chatId: id,
        model: selectedChatModel,
      },
      `Chat request authenticated for user ${session.user.id} using model ${selectedChatModel}`,
    );

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      perf.error(new Error('Rate limited'), {
        stage: 'rate_limiting',
        messageCount,
      });
      requestContext.logger.warn(
        {
          event: 'chat_request_rate_limited',
          messageCount,
          maxAllowed: entitlementsByUserType[userType].maxMessagesPerDay,
          userType,
        },
        `Chat request rate limited - ${messageCount} messages in 24h (max: ${entitlementsByUserType[userType].maxMessagesPerDay})`,
      );
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    // Configure different settings for different model types
    const isGPTModel = (selectedChatModel.includes('chat-model') || selectedChatModel.includes('gpt41')) && !selectedChatModel.includes('claude');
    const isClaude = selectedChatModel.includes('claude');
    const provider = isClaude ? 'anthropic' : isGPTModel ? 'openai' : 'unknown';
    
    // Get the specific model name for logging
    let modelName = 'unknown';
    switch (selectedChatModel) {
      case 'claude-sonnet-model':
        modelName = 'Claude Sonnet 4';
        break;
      case 'claude-chat-model':
        modelName = 'Claude Opus 4.1';
        break;
      case 'chat-model':
        modelName = 'GPT-5';
        break;
      case 'gpt41-model':
        modelName = 'GPT-4.1';
        break;
      default:
        modelName = selectedChatModel;
    }

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        // Dynamically load MCP tools with performance tracking
        let mcpTools: any[] = [];
        const mcpToolsObject: Record<string, any> = {};
        const mcpActiveTools: string[] = [];

        const mcpLogger = createCorrelatedLogger(
          requestContext,
          'mcp',
          'tools_loading',
        );

        try {
          mcpLogger.info(
            {
              event: 'mcp_tools_loading_start',
            },
            'Starting MCP tools loading',
          );

          mcpTools = await getMCPTools({ session, dataStream, requestContext });

          // Convert MCP tools to the format expected by AI SDK using actual tool names
          mcpTools.forEach((toolObj) => {
            const toolName = toolObj.name; // Use actual MCP tool name
            mcpToolsObject[toolName] = toolObj.tool;
            mcpActiveTools.push(toolName);
          });

          mcpLogger.info(
            {
              event: 'mcp_tools_loaded',
              toolCount: mcpTools.length,
              toolNames: mcpActiveTools,
            },
            `Loaded ${mcpTools.length} MCP tools for chat: ${mcpActiveTools.join(', ')}`,
          );
        } catch (error) {
          mcpLogger.error(
            {
              event: 'mcp_tools_loading_error',
              error: {
                message:
                  error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
              },
            },
            `Failed to load MCP tools: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }

        // Combine static tools with dynamic MCP tools
        const allTools = {
          getWeather,
          createDocument: createDocument({ session, dataStream }),
          updateDocument: updateDocument({ session, dataStream }),
          requestSuggestions: requestSuggestions({
            session,
            dataStream,
          }),
          ...mcpToolsObject,
        };

        // Combine active tools lists
        const staticActiveTools = [
          'getWeather',
          'createDocument',
          'updateDocument',
          'requestSuggestions',
        ];
        const allActiveTools: string[] = [
          ...staticActiveTools,
          ...mcpActiveTools,
        ];

        const streamLogger = createCorrelatedLogger(
          requestContext,
          'ai-sdk',
          'stream_text',
        );
        streamLogger.info(
          {
            event: 'stream_text_start',
            model: selectedChatModel,
            modelName: modelName,
            provider: provider,
            messageCount: uiMessages.length,
            activeToolsCount: allActiveTools.length,
            activeTools: allActiveTools,
          },
          `Starting stream text generation with ${modelName} (${provider}) and ${allActiveTools.length} tools`,
        );

        const streamConfig: any = {
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel, requestHints }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools: allActiveTools as any,
          experimental_transform: smoothStream({ chunking: 'word' }),
          tools: allTools,
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        };

        // Add GPT-5 specific reasoning configuration only for GPT models
        if (isGPTModel) {
          streamConfig.experimental_providerOptions = {
            openai: {
              reasoningEffort: 'minimal',
              textVerbosity: 'medium',
              reasoningSummary: 'auto',
              include: ['reasoning.encrypted_content'],
              max_completion_tokens: 4096,
            },
          };
        }

        const result = streamText(streamConfig);

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          }),
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        const duration = perf.end({
          messageCount: messages.length,
          chatId: id,
          userId: session.user.id,
        });

        requestContext.logger.info(
          {
            event: 'chat_request_complete',
            duration_ms: duration,
            messageCount: messages.length,
            totalMessages: messages.length,
            model: selectedChatModel,
            modelName: modelName,
            provider: provider,
          },
          `Chat request completed in ${duration.toFixed(2)}ms with ${messages.length} messages using ${modelName} (${provider})`,
        );

        await saveMessages({
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });
      },
      onError: (error) => {
        const errorObj =
          error instanceof Error ? error : new Error(String(error));
        const duration = perf.error(errorObj, {
          chatId: id,
          userId: session.user.id,
          stage: 'streaming',
        });

        // Detect specific API error types
        let errorType = 'api_error';
        const errorMessage = errorObj.message.toLowerCase();

        if (errorMessage.includes('rate limit') || 
            errorMessage.includes('too many requests') ||
            errorMessage.includes('quota exceeded') ||
            errorMessage.includes('usage limit')) {
          errorType = 'api_rate_limit';
        } else if (errorMessage.includes('authentication') || 
                   errorMessage.includes('unauthorized') || 
                   errorMessage.includes('invalid api key')) {
          errorType = 'unauthorized';
        } else if (errorMessage.includes('insufficient funds') ||
                   errorMessage.includes('billing')) {
          errorType = 'forbidden';
        }

        requestContext.logger.error(
          {
            event: 'chat_request_stream_error',
            duration_ms: duration,
            model: selectedChatModel,
            modelName: modelName,
            provider: provider,
            error: {
              message: errorObj.message,
              stack: errorObj.stack,
              detectedType: errorType,
            },
          },
          `Chat stream failed after ${duration.toFixed(2)}ms using ${modelName} (${provider}): ${errorObj.message}`,
        );

        // Return an error message that can be handled by the AI SDK
        // The AI SDK will call the frontend's onError handler with this message
        const streamErrorMessage = errorMessage.includes('rate limit') || errorMessage.includes('quota exceeded')
          ? 'The AI service is currently experiencing high demand. Please wait a few minutes before trying again.'
          : errorMessage.includes('authentication') || errorMessage.includes('unauthorized')
          ? 'Authentication error with the AI service. Please try again.'
          : 'The AI service is temporarily unavailable. Please try again in a few minutes.';
        
        return streamErrorMessage;
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    const duration = perf.error(error as Error, {
      chatId: requestContext.chatId,
      userId: requestContext.userId,
      stage: 'general',
    });

    requestContext.logger.error(
      {
        event: 'chat_request_error',
        duration_ms: duration,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          type: error instanceof ChatSDKError ? 'ChatSDKError' : 'UnknownError',
        },
      },
      `Chat request failed after ${duration.toFixed(2)}ms`,
    );

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Log unexpected errors and return generic error
    requestContext.logger.fatal(
      {
        event: 'chat_request_unexpected_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Unexpected error in chat request',
    );

    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
