import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { OpenAiClient } from '@/lib/llm';
import { generateFollowUpEmail } from '@/lib/draft/service';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const jobId = params.id;

    // Parse request body
    const body = await request.json();
    const suggestionId = body.suggestionId;

    if (!suggestionId || typeof suggestionId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'suggestionId is required' },
        { status: 400 }
      );
    }

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

    // Check if suggestion exists
    const suggestion = await prisma.followUpSuggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion) {
      return NextResponse.json(
        { success: false, error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    // Get or create material packet
    let materialPacket = await prisma.materialPacket.findFirst({
      where: { jobPostingId: jobId },
    });

    if (!materialPacket) {
      materialPacket = await prisma.materialPacket.create({
        data: {
          jobPostingId: jobId,
          resumeVariantText: 'N/A - Follow-up only',
        },
      });
    }

    // Generate follow-up email using service
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const llmClient = new OpenAiClient(apiKey);
    const result = await generateFollowUpEmail({
      jobPostingId: jobId,
      materialPacketId: materialPacket.id,
      suggestionId,
      llmClient,
      prisma,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to generate email' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        draftId: result.draftId,
        subject: result.subject,
        body: result.body,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error drafting follow-up email:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to draft follow-up email' },
      { status: 500 }
    );
  }
}
