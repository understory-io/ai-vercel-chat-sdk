// Client-side logger - ONLY use in client components
// Uses console methods for browser compatibility

interface LogLevel {
  DEBUG: 0;
  INFO: 1;
  WARN: 2;
  ERROR: 3;
}

const LOG_LEVELS: LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const LOG_LEVEL =
  typeof window !== 'undefined'
    ? localStorage.getItem('logLevel') || 'INFO'
    : 'INFO';

const currentLogLevel =
  LOG_LEVELS[LOG_LEVEL as keyof LogLevel] ?? LOG_LEVELS.INFO;

class ClientLogger {
  private component?: string;
  private context?: Record<string, any>;

  constructor(component?: string, context?: Record<string, any>) {
    this.component = component;
    this.context = context;
  }

  private formatMessage(
    level: string,
    message: string,
    data?: any,
  ): [string, any?] {
    const timestamp = new Date().toISOString();
    const prefix = this.component ? `[${this.component}]` : '';
    const contextStr = this.context ? ` ${JSON.stringify(this.context)}` : '';
    const msg = `${timestamp} ${level}${prefix}${contextStr}: ${message}`;

    return data ? [msg, data] : [msg];
  }

  private shouldLog(level: number): boolean {
    return level >= currentLogLevel;
  }

  debug(data: any, message?: string): void {
    if (!this.shouldLog(LOG_LEVELS.DEBUG)) return;
    const msg = message || (typeof data === 'string' ? data : 'Debug log');
    const logData = message ? data : undefined;
    const [formattedMsg, ...args] = this.formatMessage('DEBUG', msg, logData);
    console.log(formattedMsg, ...args);
  }

  info(data: any, message?: string): void {
    if (!this.shouldLog(LOG_LEVELS.INFO)) return;
    const msg = message || (typeof data === 'string' ? data : 'Info log');
    const logData = message ? data : undefined;
    const [formattedMsg, ...args] = this.formatMessage('INFO', msg, logData);
    console.info(formattedMsg, ...args);
  }

  warn(data: any, message?: string): void {
    if (!this.shouldLog(LOG_LEVELS.WARN)) return;
    const msg = message || (typeof data === 'string' ? data : 'Warning');
    const logData = message ? data : undefined;
    const [formattedMsg, ...args] = this.formatMessage('WARN', msg, logData);
    console.warn(formattedMsg, ...args);
  }

  error(data: any, message?: string): void {
    if (!this.shouldLog(LOG_LEVELS.ERROR)) return;
    const msg = message || (typeof data === 'string' ? data : 'Error');
    const logData = message ? data : undefined;
    const [formattedMsg, ...args] = this.formatMessage('ERROR', msg, logData);
    console.error(formattedMsg, ...args);
  }

  child(context: Record<string, any>): ClientLogger {
    return new ClientLogger(this.component, { ...this.context, ...context });
  }
}

// Create the root client logger
export const clientLogger = new ClientLogger();

// Child loggers for different components with context
export const createClientLogger = (
  component: string,
  context: Record<string, any> = {},
) => {
  return new ClientLogger(component, context);
};

// Pre-configured child loggers for common client components
export const mcpClientLogger = createClientLogger('mcp-client');
export const uiLogger = createClientLogger('ui');
export const chatLogger = createClientLogger('chat');
export const artifactLogger = createClientLogger('artifact');

// Client-side performance tracking
export const createClientPerformanceLogger = (
  component: string,
  operation: string,
) => {
  const perfLogger = createClientLogger(component);
  const startTime = performance.now();

  return {
    log: perfLogger,
    end: (additionalData: Record<string, any> = {}) => {
      const duration = performance.now() - startTime;
      perfLogger.info(
        {
          operation,
          duration_ms: duration,
          ...additionalData,
        },
        `${operation} completed in ${duration.toFixed(2)}ms`,
      );
      return duration;
    },
    error: (error: Error, additionalData: Record<string, any> = {}) => {
      const duration = performance.now() - startTime;
      perfLogger.error(
        {
          operation,
          duration_ms: duration,
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
          ...additionalData,
        },
        `${operation} failed after ${duration.toFixed(2)}ms: ${error.message}`,
      );
      return duration;
    },
  };
};

// Export types for TypeScript
export type ClientLoggerType = ClientLogger;
export type ChildClientLogger = ReturnType<typeof createClientLogger>;
