'use client';

import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, fetchWithErrorHandlers, generateUUID } from '@/lib/utils';
import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import type { VisibilityType } from './visibility-selector';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { toast } from './toast';
import type { Session } from 'next-auth';
import { useSearchParams } from 'next/navigation';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { ChatSDKError } from '@/lib/errors';
import type { Attachment, ChatMessage } from '@/lib/types';
import { useDataStream } from './data-stream-provider';
import { ErrorMessage } from './error-message';
import { AnimatePresence } from 'framer-motion';

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  autoResume: boolean;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>('');

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest({ messages, id, body }) {
        return {
          body: {
            id,
            message: messages.at(-1),
            selectedChatModel: initialChatModel,
            selectedVisibilityType: visibilityType,
            ...body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
      setChatError(null); // Clear any previous errors on successful completion
    },
    onError: (error) => {
      console.log('Chat error received:', error);
      
      if (error instanceof ChatSDKError) {
        setChatError(error);
        
        // Show toast for rate limits and serious errors
        if (error.type === 'rate_limit' || error.type === 'api_rate_limit' || error.type === 'api_error') {
          toast({
            type: 'error',
            description: error.message,
          });
        }
      } else {
        // Handle streaming errors that come as strings or Error objects
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Detect error type based on message content
        let errorType: 'rate_limit' | 'api_rate_limit' | 'api_error' | 'general' = 'general';
        
        if (errorMessage.includes('high demand') || 
            errorMessage.includes('rate limit') || 
            errorMessage.includes('quota exceeded')) {
          errorType = 'api_rate_limit';
        } else if (errorMessage.includes('authentication') || 
                   errorMessage.includes('unauthorized')) {
          errorType = 'api_error';
        } else if (errorMessage.includes('unavailable') || 
                   errorMessage.includes('service')) {
          errorType = 'api_error';
        }
        
        // Create a mock ChatSDKError for consistent handling
        const mockError = {
          type: errorType,
          message: errorMessage,
          surface: 'chat' as const,
          statusCode: 500,
        };
        
        setChatError(mockError as ChatSDKError);
        
        // Show toast for important errors
        if (errorType === 'api_rate_limit' || errorType === 'api_error') {
          toast({
            type: 'error',
            description: errorMessage,
          });
        }
      }
    },
  });

  const searchParams = useSearchParams();
  const query = searchParams.get('query');

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: 'user' as const,
        parts: [{ type: 'text', text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, '', `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const [chatError, setChatError] = useState<ChatSDKError | null>(null);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  return (
    <>
      {/* Chat Content Container */}
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          selectedModelId={initialChatModel}
          selectedVisibilityType={initialVisibilityType}
          isReadonly={isReadonly}
          session={session}
        />

        <Messages
          chatId={id}
          status={status}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          regenerate={regenerate}
          isReadonly={isReadonly}
        />

        {/* Error Message Display */}
        <AnimatePresence>
          {chatError && (
            <div className="px-4 pb-4">
              <ErrorMessage
                type={chatError.type === 'rate_limit' ? 'rate_limit' : 
                      chatError.type === 'api_rate_limit' ? 'api_rate_limit' :
                      chatError.type === 'api_error' ? 'api_error' : 'general'}
                message={chatError.message}
                onRetry={() => {
                  setChatError(null);
                  // Could potentially retry the last message here
                }}
              />
            </div>
          )}
        </AnimatePresence>

        <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              status={status}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              sendMessage={sendMessage}
              selectedVisibilityType={visibilityType}
            />
          )}
        </form>
      </div>

      {/* Mobile Artifact Overlay */}
      <div className="md:hidden">
        <Artifact
          chatId={id}
          input={input}
          setInput={setInput}
          status={status}
          stop={stop}
          attachments={attachments}
          setAttachments={setAttachments}
          sendMessage={sendMessage}
          messages={messages}
          setMessages={setMessages}
          regenerate={regenerate}
          votes={votes}
          isReadonly={isReadonly}
          selectedVisibilityType={visibilityType}
        />
      </div>
    </>
  );
}
