import pino from 'pino';
import { env } from './env';

/**
 * Structured JSON logger using Pino
 * Logs to stdout in JSON format for production
 * Pretty prints in development
 */
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

/**
 * Create a child logger with context
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
