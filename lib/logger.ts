import pino from 'pino';
import { isDevelopmentEnvironment, isProductionEnvironment } from './constants';

// Server-side Pino logger - ONLY use in API routes and server components
const loggerConfig = {
  level: process.env.LOG_LEVEL || (isDevelopmentEnvironment ? 'debug' : 'info'),

  // Redact sensitive fields from logs
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      'res.headers["set-cookie"]',
      'session.accessToken',
      'session.refreshToken',
      'args.password',
      'args.token',
      'args.apiKey',
    ],
    censor: '***REDACTED***',
  },

  // For development: use pino-pretty only in Node.js environment
  ...(isDevelopmentEnvironment && typeof window === 'undefined'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            levelFirst: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
            messageFormat: '{msg}',
            singleLine: false,
          },
        },
      }
    : {
        // Production: structured JSON logging
        formatters: {
          level: (label: string) => ({ level: label }),
          log: (object: any) => object,
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        messageKey: 'msg',
      }),

  // Include basic system info
  base: isProductionEnvironment
    ? {
        service: 'proddoc-chatbot',
        version: process.env.npm_package_version || '1.0.0',
      }
    : { service: 'proddoc-chatbot' },
};

// Create the root logger
export const logger = pino(loggerConfig);

// Child loggers for different components with context
export const createLogger = (
  component: string,
  context: Record<string, any> = {},
) => {
  return logger.child({
    component,
    ...context,
  });
};

// Pre-configured child loggers for common components
export const mcpLogger = createLogger('mcp');
export const dbLogger = createLogger('database');
export const aiLogger = createLogger('ai-sdk');
export const apiLogger = createLogger('api');
export const authLogger = createLogger('auth');

// Request correlation helper - generates unique request IDs
export const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

// Performance tracking utilities
export const createPerformanceLogger = (
  component: string,
  operation: string,
) => {
  const perfLogger = createLogger(component);
  const startTime = process.hrtime.bigint();

  return {
    log: perfLogger,
    end: (additionalData: Record<string, any> = {}) => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

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
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;

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
export type Logger = typeof logger;
export type ChildLogger = ReturnType<typeof createLogger>;
