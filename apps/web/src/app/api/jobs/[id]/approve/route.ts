import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * POST /api/jobs/:id/approve
 * Approve a job application by creating approved material versions and transitioning status
 *
 * Creates MaterialVersion with stage=approved for each material type:
 * - Uses edited version if exists, otherwise uses generated version
 * - Maintains diffBaseVersionId reference chain
 * - Transitions job status to "approved"
 * - Records StatusEvent
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

    // Find material packet with versions
    const materialPacket = await prisma.materialPacket.findFirst({
      where: { jobPostingId: jobId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!materialPacket) {
      return NextResponse.json(
        {
          success: false,
          error: 'No material packet found for this job',
        },
        { status: 400 }
      );
    }

    // For each material type (cover_letter, resume_variant), find the best version to approve
    const materialTypes = ['cover_letter', 'resume_variant'] as const;
    const approvedVersionIds: string[] = [];

    for (const type of materialTypes) {
      // Find the most recent edited version, or fall back to generated
      const editedVersion = materialPacket.versions.find(
        (v) => v.type === type && v.stage === 'edited'
      );

      const generatedVersion = materialPacket.versions.find(
        (v) => v.type === type && v.stage === 'generated'
      );

      const versionToApprove = editedVersion || generatedVersion;

      if (!versionToApprove) {
        // Skip if no version exists for this type
        continue;
      }

      // Get next version number
      const existingVersions = await prisma.materialVersion.findMany({
        where: { materialPacketId: materialPacket.id },
        orderBy: { version: 'desc' },
        take: 1,
      });

      const nextVersion =
        existingVersions.length > 0 ? existingVersions[0].version + 1 : 1;

      // Find the original generated version for diffBaseVersionId
      const originalGenerated = materialPacket.versions
        .filter((v) => v.type === type && v.stage === 'generated')
        .sort((a, b) => a.version - b.version)[0];

      // Create approved version
      const approvedVersion = await prisma.materialVersion.create({
        data: {
          materialPacketId: materialPacket.id,
          version: nextVersion,
          stage: 'approved',
          type,
          content: versionToApprove.content,
          diffBaseVersionId: originalGenerated?.id || null,
        },
      });

      approvedVersionIds.push(approvedVersion.id);
    }

    // Update job status to approved
    await prisma.jobPosting.update({
      where: { id: jobId },
      data: { status: 'approved' },
    });

    // Record status transition
    await prisma.statusEvent.create({
      data: {
        jobPostingId: jobId,
        fromStatus: job.status,
        toStatus: 'approved',
        notes: `Job approved. Created ${approvedVersionIds.length} approved material version(s).`,
      },
    });

    return NextResponse.json(
      {
        success: true,
        jobId,
        approvedVersionIds,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error approving job:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to approve job',
      },
      { status: 500 }
    );
  }
}
