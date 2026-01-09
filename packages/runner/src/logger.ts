import pino from 'pino';

/**
 * Structured JSON logger for runner CLI
 * Logs to stdout in JSON format for production
 * Pretty prints in development
 */
export const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
  transport:
    process.env.NODE_ENV !== 'production'
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
