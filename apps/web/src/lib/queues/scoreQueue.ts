import { Queue } from 'bullmq';
import { getDefaultQueueOptions, QUEUE_NAMES } from './config';
import { ScoreJobData, ScoreJobResult } from './types';
import { isQueueModeEnabled } from '../env';
import { logger } from '../logger';

/**
 * Score queue instance
 * Processes fit score computation jobs
 */
let scoreQueueInstance: Queue<ScoreJobData, ScoreJobResult> | null = null;

export function getScoreQueue(): Queue<ScoreJobData, ScoreJobResult> {
  if (!isQueueModeEnabled()) {
    throw new Error('Queue mode not enabled');
  }

  if (!scoreQueueInstance) {
    scoreQueueInstance = new Queue<ScoreJobData, ScoreJobResult>(
      QUEUE_NAMES.SCORE,
      getDefaultQueueOptions() as any
    );

    logger.info({ queue: QUEUE_NAMES.SCORE }, 'Score queue initialized');
  }

  return scoreQueueInstance;
}

/**
 * Enqueue a score job
 * Idempotent - uses jobPostingId as job ID to prevent duplicates
 */
export async function enqueueScoreJob(
  jobPostingId: string
): Promise<{ jobId: string }> {
  const queue = getScoreQueue();
  const idempotencyKey = `score:${jobPostingId}`;

  const job = await queue.add(
    'compute-score',
    {
      jobPostingId,
      idempotencyKey,
    },
    {
      jobId: idempotencyKey, // Use as job ID for deduplication
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    }
  );

  logger.info(
    { jobPostingId, jobId: job.id },
    'Enqueued score job'
  );

  return { jobId: job.id! };
}
