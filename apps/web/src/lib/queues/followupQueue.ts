import { Queue } from 'bullmq';
import { defaultQueueOptions, QUEUE_NAMES, getRedisConnection } from './config';
import { FollowUpJobData, FollowUpJobResult } from './types';
import { isQueueModeEnabled } from '../env';
import { logger } from '../logger';

/**
 * Follow-up queue instance
 * Processes follow-up suggestion and email draft jobs
 */
let followupQueueInstance: Queue<FollowUpJobData, FollowUpJobResult> | null =
  null;

export function getFollowupQueue(): Queue<FollowUpJobData, FollowUpJobResult> {
  if (!isQueueModeEnabled()) {
    throw new Error('Queue mode not enabled');
  }

  if (!followupQueueInstance) {
    followupQueueInstance = new Queue<FollowUpJobData, FollowUpJobResult>(
      QUEUE_NAMES.FOLLOWUP,
      defaultQueueOptions as any
    );

    logger.info({ queue: QUEUE_NAMES.FOLLOWUP }, 'Follow-up queue initialized');
  }

  return followupQueueInstance;
}

/**
 * Enqueue a follow-up job
 * Idempotent - uses jobPostingId + suggestionId as job ID
 */
export async function enqueueFollowupJob(
  jobPostingId: string,
  suggestionId?: string
): Promise<{ jobId: string }> {
  const queue = getFollowupQueue();
  const idempotencyKey = suggestionId
    ? `followup:${jobPostingId}:${suggestionId}`
    : `followup:${jobPostingId}`;

  const job = await queue.add(
    suggestionId ? 'draft-followup-email' : 'create-followup-suggestions',
    {
      jobPostingId,
      suggestionId,
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
    { jobPostingId, suggestionId, jobId: job.id },
    'Enqueued follow-up job'
  );

  return { jobId: job.id! };
}
