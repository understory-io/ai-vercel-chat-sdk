'use client';

import { motion } from 'framer-motion';
import { InfoIcon, StopIcon, WarningIcon, SparklesIcon } from './icons';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface ErrorMessageProps {
  type: 'rate_limit' | 'api_rate_limit' | 'api_error' | 'general';
  message: string;
  onRetry?: () => void;
  className?: string;
}

const errorConfig = {
  rate_limit: {
    icon: <StopIcon size={20} />,
    title: 'Daily Message Limit Reached',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    showRetry: false,
  },
  api_rate_limit: {
    icon: <SparklesIcon size={20} />,
    title: 'AI Service Busy',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    showRetry: true,
  },
  api_error: {
    icon: <WarningIcon size={20} />,
    title: 'AI Service Unavailable',
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
    borderColor: 'border-red-200 dark:border-red-800',
    showRetry: true,
  },
  general: {
    icon: <InfoIcon size={20} />,
    title: 'Something went wrong',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 dark:bg-gray-950/20',
    borderColor: 'border-gray-200 dark:border-gray-800',
    showRetry: true,
  },
};

export function ErrorMessage({ type, message, onRetry, className }: ErrorMessageProps) {
  const config = errorConfig[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'mx-auto max-w-2xl p-4 rounded-lg border',
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex-shrink-0 mt-0.5', config.color)}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={cn('font-medium text-sm mb-1', config.color)}>
            {config.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {message}
          </p>
          {config.showRetry && onRetry && (
            <div className="mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                className="h-8 px-3 text-xs"
              >
                Try Again
              </Button>
            </div>
          )}
          {type === 'rate_limit' && (
            <div className="mt-2 text-xs text-muted-foreground">
              Your usage will reset in 24 hours from your first message today.
            </div>
          )}
          {type === 'api_rate_limit' && (
            <div className="mt-2 text-xs text-muted-foreground">
              This usually resolves within a few minutes.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}