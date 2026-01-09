import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { computeFitScore } from '@job-application-agent/shared';

const prisma = new PrismaClient();

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * POST /api/jobs/:id/score
 * Compute and save fit score for a job posting
 */
export async function POST(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const jobId = params.id;

    // Load job posting
    const job = await prisma.jobPosting.findUnique({
      where: { id: jobId },
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

    // Load all KB bullets
    const kbBullets = await prisma.kbBullet.findMany();

    // Compute fit score using shared logic
    const scoreResult = computeFitScore(
      {
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
      },
      kbBullets.map((b) => ({
        id: b.id,
        text: b.text,
        tags: b.tags,
      }))
    );

    // Upsert FitScore
    const fitScore = await prisma.fitScore.upsert({
      where: { jobPostingId: jobId },
      create: {
        jobPostingId: jobId,
        score: scoreResult.score,
        reasoning: JSON.stringify({
          reasoning: scoreResult.reasoning,
          breakdown: scoreResult.breakdown,
          bullets: scoreResult.bullets,
        }),
      },
      update: {
        score: scoreResult.score,
        reasoning: JSON.stringify({
          reasoning: scoreResult.reasoning,
          breakdown: scoreResult.breakdown,
          bullets: scoreResult.bullets,
        }),
      },
    });

    // Transition status to "scored" (only if not already scored or higher)
    const nonScoredStatuses = ['new', 'needs_attention'];
    if (nonScoredStatuses.includes(job.status)) {
      await prisma.jobPosting.update({
        where: { id: jobId },
        data: { status: 'scored' },
      });

      // Record status event
      await prisma.statusEvent.create({
        data: {
          jobPostingId: jobId,
          fromStatus: job.status,
          toStatus: 'scored',
          notes: `Computed fit score: ${scoreResult.score}/100`,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        fitScoreId: fitScore.id,
        score: scoreResult.score,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error computing fit score:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to compute score',
      },
      { status: 500 }
    );
  }
}
