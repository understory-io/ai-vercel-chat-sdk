# Pino Logging Implementation Guide

## Overview

Your chatbot now has comprehensive Pino logging to track performance, debug issues, and monitor MCP tool execution. This guide explains how to use and extend the logging system.

## What's Been Implemented

### 1. Core Logger Configuration (`lib/logger.ts`)

- **Environment-based configuration**: Pretty logs in development, structured JSON in production
- **Automatic sensitive data redaction**: Passwords, tokens, API keys are automatically censored
- **Performance tracking utilities**: Built-in timing for operations
- **Component-specific child loggers**: Pre-configured for MCP, database, AI SDK, etc.

### 2. Request Correlation (`lib/request-context.ts`)

- **Unique request IDs**: Every API request gets a unique identifier for tracking
- **Cross-system correlation**: Track requests from API → MCP → n8n
- **Contextual logging**: User ID, chat ID, and request ID automatically included

### 3. MCP Performance Tracking (`lib/ai/tools/mcp-dynamic-tools.ts`)

- **Tool discovery timing**: How long it takes to discover available tools
- **Individual tool execution**: Performance metrics for each MCP tool call
- **Error tracking**: Detailed error logs with stack traces and context

### 4. API Request Monitoring (`app/(chat)/api/chat/route.ts`)

- **End-to-end request tracking**: From request start to completion
- **Authentication logging**: Track successful/failed auth attempts
- **Rate limiting logs**: Monitor when users hit rate limits
- **Stream processing**: Log streaming text generation performance

### 5. MCP Client Connection Logging (`lib/mcp/client.ts`)

- **Connection management**: Track MCP server connections and disconnections
- **Performance monitoring**: How long connections take to establish

## How to Use the Logging System

### Basic Usage

```typescript
import { logger, createLogger } from '@/lib/logger';

// Use the root logger
logger.info('Application started');

// Create a component-specific logger
const myLogger = createLogger('my-component');
myLogger.info('Component initialized');
```

### Performance Tracking

```typescript
import { createPerformanceLogger } from '@/lib/logger';

async function slowOperation() {
  const perf = createPerformanceLogger('my-component', 'slow_operation');
  
  try {
    // Your slow operation here
    const result = await someSlowWork();
    
    // Log successful completion with timing
    perf.end({ resultSize: result.length });
    
    return result;
  } catch (error) {
    // Log error with timing
    perf.error(error, { additionalContext: 'value' });
    throw error;
  }
}
```

### Request Context Logging

```typescript
import { createRequestContext, createCorrelatedLogger } from '@/lib/request-context';

export async function POST(request: Request) {
  const requestContext = createRequestContext(request);
  
  // All logs will include requestId, userId, chatId automatically
  requestContext.logger.info('Processing request');
  
  // Create correlated loggers for different components
  const mcpLogger = createCorrelatedLogger(requestContext, 'mcp', 'operation');
  mcpLogger.info('Starting MCP operation');
}
```

### Database Operation Logging

```typescript
import { logDbOperation } from '@/lib/db/logger';

async function getUserById(id: string) {
  const dbLog = logDbOperation('get_user_by_id', 'SELECT * FROM users WHERE id = ?');
  
  try {
    const user = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    return dbLog.start({ userId: id }).end(user);
  } catch (error) {
    dbLog.start({ userId: id }).error(error);
  }
}
```

## Key Log Events to Monitor

### Performance Bottlenecks

1. **`mcp_tools_discovery`**: How long it takes to discover MCP tools
2. **`mcp_tool_execution_*`**: Individual tool execution times
3. **`mcp_connection_*`**: MCP server connection establishment
4. **`stream_text_start`**: AI text generation initialization
5. **`db_operation_*`**: Database query performance

### Error Tracking

1. **`chat_request_unauthorized`**: Authentication failures
2. **`chat_request_rate_limited`**: Rate limiting triggers
3. **`mcp_connection_error`**: MCP server connection issues
4. **`mcp_tool_execution_error`**: Tool execution failures
5. **`chat_request_stream_error`**: Streaming failures

### Request Flow Tracking

Each request gets a unique `requestId` that flows through all systems:
```
API Request → MCP Tools Discovery → Tool Execution → n8n Processing
```

## Best Practices

### 1. Use Structured Logging
```typescript
// Good ✅
logger.info({
  event: 'user_action',
  userId: '123',
  action: 'upload_document',
  documentSize: 1024
}, 'User uploaded document');

// Avoid ❌
logger.info(`User 123 uploaded document of size 1024`);
```

### 2. Include Context
```typescript
// Good ✅
const userLogger = createLogger('user-service', { userId: user.id });
userLogger.info('Processing user request');

// Less useful ❌
logger.info('Processing user request');
```

### 3. Use Appropriate Log Levels
- **`debug`**: Development debugging info
- **`info`**: Important application events
- **`warn`**: Warning conditions
- **`error`**: Error conditions
- **`fatal`**: Critical errors that might cause shutdown

### 4. Performance Tracking Pattern
```typescript
const perf = createPerformanceLogger('component', 'operation');
try {
  const result = await operation();
  perf.end({ success: true, resultCount: result.length });
  return result;
} catch (error) {
  perf.error(error, { context: 'additional info' });
  throw error;
}
```

## Configuration

### Environment Variables
- **`LOG_LEVEL`**: Set to `debug`, `info`, `warn`, `error` (defaults: `debug` in dev, `info` in prod)
- **`NODE_ENV`**: Determines log format (pretty vs JSON)

### Development vs Production

**Development**: 
- Pretty formatted logs with colors
- More verbose output
- Readable timestamps

**Production**:
- Structured JSON logs
- Optimized for log aggregation
- ISO timestamps
- Service metadata included

## Monitoring Your System

### Key Metrics to Track

1. **Average request duration**: Look for `chat_request_complete` events
2. **MCP tool performance**: Monitor `mcp_tool_execution_success` durations
3. **Error rates**: Count error events vs success events
4. **Connection health**: Monitor `mcp_connection_*` events

### Performance Benchmarks

- **MCP tools discovery**: Should be < 500ms
- **Individual tool execution**: Varies by tool, but monitor for outliers
- **Chat request end-to-end**: Depends on complexity, but track percentiles
- **MCP connection establishment**: Should be < 2000ms

## Troubleshooting Common Issues

### 1. High MCP Tool Discovery Times
```bash
# Look for logs like:
{"event":"mcp_tools_discovery_complete","duration_ms":2000}
```
- Check n8n server performance
- Verify MCP server connectivity

### 2. Frequent Connection Errors
```bash
# Look for:
{"event":"mcp_connection_error"}
```
- Check MCP server availability
- Verify network connectivity

### 3. Tool Execution Failures
```bash
# Look for:
{"event":"mcp_tool_execution_error"}
```
- Check tool parameters
- Verify n8n workflow configuration

## Extending the Logging

### Adding New Components

```typescript
// Create component-specific logger
import { createLogger } from '@/lib/logger';

export const myComponentLogger = createLogger('my-component');

// Use in your component
myComponentLogger.info({
  event: 'component_initialized',
  config: myConfig
}, 'My component started');
```

### Adding New Performance Metrics

```typescript
import { createPerformanceLogger } from '@/lib/logger';

function trackMyOperation() {
  const perf = createPerformanceLogger('my-component', 'my_operation');
  
  // Your operation
  
  perf.end({ customMetric: value });
}
```

This logging system gives you complete visibility into your MCP-integrated chatbot's performance and helps identify bottlenecks in the API → MCP → n8n flow.