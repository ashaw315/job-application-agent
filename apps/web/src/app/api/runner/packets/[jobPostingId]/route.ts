import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { RunnerPacketSchema } from '@job-application-agent/shared';

const prisma = new PrismaClient();

interface RouteParams {
  params: {
    jobPostingId: string;
  };
}

/**
 * GET /api/runner/packets/:jobPostingId
 * Retrieve runner packet for approved job
 *
 * Security:
 * - Requires Authorization: Bearer <RUNNER_API_KEY>
 * - Only serves packets for approved jobs with approved materials
 *
 * Returns:
 * - 200: Valid RunnerPacket
 * - 401: Unauthorized (missing or invalid token)
 * - 404: Job not found
 * - 409: Job not approved
 * - 400: No approved materials found
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
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

    const token = authHeader.substring(7); // Remove "Bearer " prefix
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

    const jobPostingId = params.jobPostingId;

    // Validate job exists and is approved
    const job = await prisma.jobPosting.findUnique({
      where: { id: jobPostingId },
      include: {
        materialPackets: {
          include: {
            versions: {
              where: { stage: 'approved' },
              orderBy: { version: 'desc' },
            },
          },
        },
      },
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

    if (job.status !== 'approved') {
      return NextResponse.json(
        {
          success: false,
          error: `Job must be approved before runner packet can be generated. Current status: ${job.status}`,
        },
        { status: 409 }
      );
    }

    // Validate apply URL exists
    if (!job.applyUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'Job posting has no apply URL',
        },
        { status: 400 }
      );
    }

    // Get material packet
    const materialPacket = job.materialPackets[0];
    if (!materialPacket) {
      return NextResponse.json(
        {
          success: false,
          error: 'No approved materials found for this job',
        },
        { status: 400 }
      );
    }

    // Find approved cover letter and resume
    const approvedCoverLetter = materialPacket.versions.find(
      (v) => v.type === 'cover_letter' && v.stage === 'approved'
    );

    const approvedResume = materialPacket.versions.find(
      (v) => v.type === 'resume_variant' && v.stage === 'approved'
    );

    if (!approvedCoverLetter || !approvedResume) {
      return NextResponse.json(
        {
          success: false,
          error: 'No approved materials found for this job. Both cover letter and resume must be approved.',
        },
        { status: 400 }
      );
    }

    // Parse approved materials
    let coverLetterText = '';
    let resumeText = '';

    try {
      const coverLetterContent = JSON.parse(approvedCoverLetter.content);
      coverLetterText = coverLetterContent.text || '';

      const resumeContent = JSON.parse(approvedResume.content);
      // Resume might be in bullets format or text format
      if (resumeContent.bullets && Array.isArray(resumeContent.bullets)) {
        resumeText = resumeContent.bullets
          .filter((b: { isValid: boolean }) => b.isValid)
          .map((b: { variant: string }) => b.variant)
          .join('\n');
      } else if (resumeContent.text) {
        resumeText = resumeContent.text;
      }
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse approved materials',
        },
        { status: 500 }
      );
    }

    // Get user profile
    const userProfile = await prisma.userProfile.findFirst();
    if (!userProfile) {
      return NextResponse.json(
        {
          success: false,
          error: 'User profile not found. Please set up your profile first.',
        },
        { status: 400 }
      );
    }

    // Build runner packet
    const packet = {
      jobPostingId: job.id,
      applyUrl: job.applyUrl,
      userProfile: {
        name: userProfile.name,
        email: userProfile.email,
        ...(userProfile.phone && { phone: userProfile.phone }),
      },
      materials: {
        resumeText,
        coverLetterText,
      },
      allowedAnswers: {
        // For v0, we don't store these in DB, so leave empty
        // Runner will only fill if present in form
      },
    };

    // Validate packet matches schema
    const validatedPacket = RunnerPacketSchema.parse(packet);

    return NextResponse.json(
      {
        success: true,
        packet: validatedPacket,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error generating runner packet:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to generate runner packet',
      },
      { status: 500 }
    );
  }
}
