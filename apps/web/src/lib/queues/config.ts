import { QueueOptions, WorkerOptions } from 'bullmq';
import IORedis from 'ioredis';
import { env, isQueueModeEnabled } from '../env';
import { logger } from '../logger';

/**
 * Redis connection for BullMQ
 * Shared across all queues and workers
 */
let redisConnection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!isQueueModeEnabled()) {
    throw new Error('Queue mode not enabled - REDIS_URL not configured');
  }

  if (!redisConnection) {
    redisConnection = new IORedis(env.REDIS_URL!, {
      maxRetriesPerRequest: null, // Required for BullMQ
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisConnection.on('error', (err) => {
      logger.error({ err }, 'Redis connection error');
    });

    redisConnection.on('connect', () => {
      logger.info('Redis connected');
    });
  }

  return redisConnection;
}

/**
 * Get connection options for BullMQ
 */
function getConnectionOptions() {
  return {
    host: getRedisConnection().options.host,
    port: getRedisConnection().options.port,
  };
}

/**
 * Default queue options
 */
export const defaultQueueOptions: Partial<QueueOptions> = {
  connection: getConnectionOptions(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2s, then 4s, then 8s
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600, // Keep for 24 hours
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs
      age: 7 * 24 * 3600, // Keep for 7 days
    },
  },
};

/**
 * Default worker options
 */
export const defaultWorkerOptions: Partial<WorkerOptions> = {
  connection: getConnectionOptions(),
  concurrency: 1, // Process one job at a time per worker (safe default)
  limiter: {
    max: 10, // Max 10 jobs
    duration: 1000, // Per second
  },
};

/**
 * Queue names
 */
export const QUEUE_NAMES = {
  SCORE: 'score-queue',
  DRAFT: 'draft-queue',
  FOLLOWUP: 'followup-queue',
} as const;

/**
 * Gracefully close all Redis connections
 */
export async function closeRedisConnections(): Promise<void> {
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
    logger.info('Redis connections closed');
  }
}
