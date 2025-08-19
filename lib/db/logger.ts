import { createLogger } from '@/lib/logger';

// Database operation logger with specific context
export const dbOperationLogger = createLogger('database');

// Helper to log database operations with performance tracking
export const logDbOperation = <T>(operation: string, query?: string) => {
  return {
    start: (context: Record<string, any> = {}) => {
      const startTime = process.hrtime.bigint();
      
      dbOperationLogger.debug({
        event: 'db_operation_start',
        operation,
        query: query ? query.substring(0, 200) + (query.length > 200 ? '...' : '') : undefined,
        ...context
      }, `Starting database operation: ${operation}`);
      
      return {
        end: (result?: any, additionalContext?: Record<string, any>) => {
          const endTime = process.hrtime.bigint();
          const duration = Number(endTime - startTime) / 1_000_000;
          
          dbOperationLogger.info({
            event: 'db_operation_complete',
            operation,
            duration_ms: duration,
            resultCount: Array.isArray(result) ? result.length : result ? 1 : 0,
            ...context,
            ...additionalContext
          }, `Database operation completed: ${operation} in ${duration.toFixed(2)}ms`);
          
          return result;
        },
        error: (error: Error, additionalContext?: Record<string, any>) => {
          const endTime = process.hrtime.bigint();
          const duration = Number(endTime - startTime) / 1_000_000;
          
          dbOperationLogger.error({
            event: 'db_operation_error',
            operation,
            duration_ms: duration,
            error: {
              message: error.message,
              stack: error.stack,
              name: error.name
            },
            query: query ? query.substring(0, 200) + (query.length > 200 ? '...' : '') : undefined,
            ...context,
            ...additionalContext
          }, `Database operation failed: ${operation} after ${duration.toFixed(2)}ms - ${error.message}`);
          
          throw error;
        }
      };
    }
  };
};