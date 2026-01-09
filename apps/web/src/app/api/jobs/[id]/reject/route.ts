import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * POST /api/jobs/:id/reject
 * Reject a job application by transitioning status to rejected
 *
 * - Transitions job status to "rejected"
 * - Records StatusEvent with transition details
 */
export async function POST(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const jobId = params.id;

    // Validate job exists
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

    // Update job status to rejected
    await prisma.jobPosting.update({
      where: { id: jobId },
      data: { status: 'rejected' },
    });

    // Record status transition
    await prisma.statusEvent.create({
      data: {
        jobPostingId: jobId,
        fromStatus: job.status,
        toStatus: 'rejected',
        notes: 'Job rejected from approval queue',
      },
    });

    return NextResponse.json(
      {
        success: true,
        jobId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error rejecting job:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to reject job',
      },
      { status: 500 }
    );
  }
}
