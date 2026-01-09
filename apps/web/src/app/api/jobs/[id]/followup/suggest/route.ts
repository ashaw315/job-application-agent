import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const jobId = params.id;

    // Check if job exists
    const job = await prisma.jobPosting.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job posting not found' },
        { status: 404 }
      );
    }

    // Check if suggestions already exist
    const existingSuggestions = await prisma.followUpSuggestion.findMany({
      where: { jobPostingId: jobId },
    });

    if (existingSuggestions.length > 0) {
      // Return existing suggestion IDs (idempotent)
      return NextResponse.json(
        {
          success: true,
          suggestionIds: existingSuggestions.map((s) => s.id),
        },
        { status: 200 }
      );
    }

    // Calculate suggestion dates
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const fourteenDaysFromNow = new Date(now);
    fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

    // Create suggestions
    const suggestions = await Promise.all([
      prisma.followUpSuggestion.create({
        data: {
          jobPostingId: jobId,
          suggestedAt: sevenDaysFromNow,
          text: `Follow up after 7 days to check on application status for ${job.title} at ${job.company}`,
        },
      }),
      prisma.followUpSuggestion.create({
        data: {
          jobPostingId: jobId,
          suggestedAt: fourteenDaysFromNow,
          text: `Follow up after 14 days to express continued interest in ${job.title} role at ${job.company}`,
        },
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        suggestionIds: suggestions.map((s) => s.id),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error creating follow-up suggestions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create follow-up suggestions' },
      { status: 500 }
    );
  }
}
