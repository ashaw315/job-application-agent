import { Queue } from 'bullmq';
import { defaultQueueOptions, QUEUE_NAMES, getRedisConnection } from './config';
import { DraftJobData, DraftJobResult } from './types';
import { isQueueModeEnabled } from '../env';
import { logger } from '../logger';

/**
 * Draft queue instance
 * Processes material drafting jobs (cover letter + resume variant)
 */
let draftQueueInstance: Queue<DraftJobData, DraftJobResult> | null = null;

export function getDraftQueue(): Queue<DraftJobData, DraftJobResult> {
  if (!isQueueModeEnabled()) {
    throw new Error('Queue mode not enabled');
  }

  if (!draftQueueInstance) {
    draftQueueInstance = new Queue<DraftJobData, DraftJobResult>(
      QUEUE_NAMES.DRAFT,
      defaultQueueOptions as any
    );

    logger.info({ queue: QUEUE_NAMES.DRAFT }, 'Draft queue initialized');
  }

  return draftQueueInstance;
}

/**
 * Enqueue a draft job
 * Idempotent - uses jobPostingId as job ID to prevent duplicates
 */
export async function enqueueDraftJob(
  jobPostingId: string,
  materialPacketId: string
): Promise<{ jobId: string }> {
  const queue = getDraftQueue();
  const idempotencyKey = `draft:${jobPostingId}`;

  const job = await queue.add(
    'draft-materials',
    {
      jobPostingId,
      materialPacketId,
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
    { jobPostingId, materialPacketId, jobId: job.id },
    'Enqueued draft job'
  );

  return { jobId: job.id! };
}
