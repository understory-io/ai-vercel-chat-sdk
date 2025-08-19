import { generateRequestId, createLogger } from './logger';
import type { ChildLogger } from './logger';

// Request context for correlation across API -> MCP -> n8n flow
export interface RequestContext {
  requestId: string;
  userId?: string;
  chatId?: string;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  logger: ChildLogger;
}

// Create request context from Next.js request
export const createRequestContext = (request: Request, additionalContext: Partial<RequestContext> = {}): RequestContext => {
  const requestId = generateRequestId();
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const ipAddress = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';

  const context: RequestContext = {
    requestId,
    userAgent,
    ipAddress,
    ...additionalContext,
    logger: createLogger('api', { 
      requestId, 
      ...additionalContext 
    })
  };

  context.logger.info({
    event: 'request_start',
    method: request.method,
    url: request.url,
    userAgent,
    ipAddress
  }, `Starting request ${requestId}`);

  return context;
};

// Add correlation to child loggers for operations within a request
export const createCorrelatedLogger = (baseContext: RequestContext, component: string, operation?: string) => {
  const additionalContext: Record<string, any> = {
    requestId: baseContext.requestId,
    userId: baseContext.userId,
    chatId: baseContext.chatId
  };

  if (operation) {
    additionalContext.operation = operation;
  }

  return createLogger(component, additionalContext);
};

// Middleware-like function to ensure request context is available
export const withRequestContext = <T extends any[], R>(
  fn: (context: RequestContext, ...args: T) => Promise<R> | R
) => {
  return async (request: Request, ...args: T): Promise<R> => {
    const context = createRequestContext(request);
    try {
      const result = await fn(context, ...args);
      context.logger.info({
        event: 'request_complete',
        requestId: context.requestId
      }, `Request ${context.requestId} completed successfully`);
      return result;
    } catch (error) {
      context.logger.error({
        event: 'request_error',
        requestId: context.requestId,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      }, `Request ${context.requestId} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };
};