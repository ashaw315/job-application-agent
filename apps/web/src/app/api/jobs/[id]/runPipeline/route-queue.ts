import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { enqueueScoreJob } from '@/lib/queues/scoreQueue';
import { enqueueDraftJob } from '@/lib/queues/draftQueue';
import { createLogger } from '@/lib/logger';

const prisma = new PrismaClient();
const logger = createLogger({ component: 'runPipeline' });

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * POST /api/jobs/:id/runPipeline (Queue Mode)
 * Enqueues jobs for async processing: score -> draft materials
 */
export async function POST_QUEUE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const jobId = params.id;

    logger.info({ jobId }, 'Running pipeline via queue');

    // Validate job exists
    const job = await prisma.jobPosting.findUnique({
      where: { id: jobId },
      include: { fitScore: true },
    });

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          error: 'Job not found',
        },
        { status: 404 }
      );
    }

    const jobIds: { scoreJobId?: string; draftJobId?: string } = {};

    // Step 1: Enqueue score job if needed
    if (!job.fitScore) {
      const { jobId: scoreJobId } = await enqueueScoreJob(jobId);
      jobIds.scoreJobId = scoreJobId;
      logger.info({ jobId, scoreJobId }, 'Enqueued score job');
    } else {
      logger.info({ jobId, score: job.fitScore.score }, 'Score already exists');
    }

    // Step 2: Enqueue draft job (will create material packet if needed)
    // Note: In production, you might want to chain these jobs, but for simplicity
    // we enqueue both now. The draft worker checks idempotency.
    let materialPacket = await prisma.materialPacket.findFirst({
      where: { jobPostingId: jobId },
    });

    if (!materialPacket) {
      materialPacket = await prisma.materialPacket.create({
        data: {
          jobPostingId: jobId,
          resumeVariantText: 'TODO',
          coverLetterText: 'TODO',
        },
      });
    }

    const { jobId: draftJobId } = await enqueueDraftJob(jobId, materialPacket.id);
    jobIds.draftJobId = draftJobId;
    logger.info({ jobId, draftJobId, materialPacketId: materialPacket.id }, 'Enqueued draft job');

    return NextResponse.json({
      success: true,
      jobId,
      mode: 'queue',
      queueJobIds: jobIds,
      message: 'Pipeline jobs enqueued. Check status via queue monitoring.',
    });
  } catch (error) {
    logger.error({ err: error, jobId: params.id }, 'Failed to enqueue pipeline jobs');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enqueue pipeline',
      },
      { status: 500 }
    );
  }
}
