import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { RunnerReportSchema } from '@job-application-agent/shared';

const prisma = new PrismaClient();

/**
 * POST /api/runner/runs
 * Receive and persist runner execution results
 *
 * Security:
 * - Requires Authorization: Bearer <RUNNER_API_KEY>
 *
 * Returns:
 * - 200: Successfully persisted run
 * - 400: Invalid report data
 * - 401: Unauthorized
 * - 404: Job posting not found
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Validate authorization
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authorization header required: Bearer <RUNNER_API_KEY>',
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const expectedToken = process.env.RUNNER_API_KEY;

    if (!expectedToken || token !== expectedToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid authorization token',
        },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = RunnerReportSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid report: ${validationResult.error.message}`,
        },
        { status: 400 }
      );
    }

    const report = validationResult.data;

    // Verify job exists
    const job = await prisma.jobPosting.findUnique({
      where: { id: report.jobPostingId },
    });

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          error: 'Job posting not found',
        },
        { status: 404 }
      );
    }

    // Create RunnerRun record
    const runnerRun = await prisma.runnerRun.create({
      data: {
        jobPostingId: report.jobPostingId,
        status: report.status,
        errors: JSON.stringify(report.errors),
        warnings: JSON.stringify(report.warnings),
        stoppedReason: report.stoppedReason || null,
        appliedAt: report.appliedAt ? new Date(report.appliedAt) : null,
        completedAt: new Date(),
      },
    });

    // Create RunnerArtifact records
    for (const artifact of report.artifacts) {
      await prisma.runnerArtifact.create({
        data: {
          runnerRunId: runnerRun.id,
          artifactType: artifact.type,
          filePath: artifact.filePath || null,
          content: artifact.content || null,
          description: artifact.description || null,
        },
      });
    }

    // Determine new job status and create StatusEvent
    let newStatus = job.status;
    let statusNotes = '';

    if (report.status === 'success') {
      // Success => applied
      newStatus = 'applied';
      statusNotes = `Runner completed successfully. Application submitted at ${report.appliedAt || 'unknown time'}.`;
    } else if (
      report.status === 'failed' ||
      report.status === 'critical_error'
    ) {
      // Failed or critical error => needs_attention
      newStatus = 'needs_attention';
      const errorSummary =
        report.errors.length > 0
          ? ` Errors: ${report.errors.slice(0, 2).join(', ')}${report.errors.length > 2 ? '...' : ''}`
          : '';
      statusNotes = `Runner failed with status: ${report.status}.${errorSummary}`;
    } else if (report.status === 'stopped_before_submit') {
      // Stopped before submit => keep status unchanged (v0 safety)
      // But still record the event
      statusNotes = `Runner stopped before submission (v0 safety). Reason: ${report.stoppedReason || 'Pre-submit stop'}`;
    }

    // Update job status if changed
    if (newStatus !== job.status) {
      await prisma.jobPosting.update({
        where: { id: report.jobPostingId },
        data: { status: newStatus },
      });
    }

    // Create StatusEvent
    await prisma.statusEvent.create({
      data: {
        jobPostingId: report.jobPostingId,
        fromStatus: job.status,
        toStatus: newStatus,
        actor: 'runner',
        notes: statusNotes,
      },
    });

    return NextResponse.json(
      {
        success: true,
        runId: runnerRun.id,
        previousStatus: job.status,
        newStatus,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error persisting runner run:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to persist runner run',
      },
      { status: 500 }
    );
  }
}
