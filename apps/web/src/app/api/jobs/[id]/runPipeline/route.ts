import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import {
  extractKeywords,
  selectRelevantBullets,
} from '@job-application-agent/shared';
import { generateCoverLetter, generateResumeVariant } from '@/lib/draft/service';
import { OpenAiClient } from '@/lib/llm';

const prisma = new PrismaClient();

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * POST /api/jobs/:id/runPipeline
 * Run the full pipeline for a job: score (if needed) -> draft materials -> set status to in_review
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

    // Step 1: Create FitScore if missing (placeholder scoring logic)
    let fitScore = job.fitScore;

    if (!fitScore) {
      // Generate a placeholder score (for now, just a simple calculation)
      // In a real implementation, this would call an LLM to analyze the job description
      const placeholderScore = generatePlaceholderScore(job.description, job.title);

      fitScore = await prisma.fitScore.create({
        data: {
          jobPostingId: jobId,
          score: placeholderScore.score,
          reasoning: placeholderScore.reasoning,
        },
      });

      // Record status transition to scored (optional intermediate status)
      await prisma.statusEvent.create({
        data: {
          jobPostingId: jobId,
          fromStatus: job.status,
          toStatus: 'scored',
        },
      });
    }

    // Step 2: Select relevant KB bullets for drafting
    const kbBullets = await prisma.kbBullet.findMany();
    const jobKeywords = extractKeywords(job.description);
    const relevantBullets = selectRelevantBullets({
      jobKeywords,
      kbBullets: kbBullets.map((b) => ({
        id: b.id,
        text: b.text,
        tags: b.tags,
      })),
      limit: 10,
    });

    // Step 3: Create MaterialPacket with placeholder materials and metadata
    const materialPacket = await prisma.materialPacket.create({
      data: {
        jobPostingId: jobId,
        resumeVariantText: 'TODO',
        coverLetterText: 'TODO',
        metadata: JSON.stringify({
          selectedKbBulletIds: relevantBullets.selectedBullets.map(
            (b) => b.bulletId
          ),
          jobKeywords: relevantBullets.jobKeywords,
          bulletScores: relevantBullets.selectedBullets,
        }),
      },
    });

    // Step 4: Generate cover letter using LLM
    // Check if OPENAI_API_KEY is available
    const apiKey = process.env.OPENAI_API_KEY;
    let coverLetterResult;

    if (apiKey) {
      // Use real OpenAI client
      const llmClient = new OpenAiClient(apiKey);
      coverLetterResult = await generateCoverLetter({
        jobPostingId: jobId,
        materialPacketId: materialPacket.id,
        llmClient,
        prisma,
      });

      if (!coverLetterResult.success) {
        console.error('Cover letter generation failed:', coverLetterResult.error);
        // Fall back to placeholder
        await prisma.materialVersion.create({
          data: {
            materialPacketId: materialPacket.id,
            version: 1,
            stage: 'generated',
            type: 'cover_letter',
            content: JSON.stringify({
              text: 'TODO: Cover letter generation failed',
              error: coverLetterResult.error,
            }),
          },
        });
      }
    } else {
      // No API key - use placeholder
      console.warn('OPENAI_API_KEY not set - using placeholder cover letter');
      await prisma.materialVersion.create({
        data: {
          materialPacketId: materialPacket.id,
          version: 1,
          stage: 'generated',
          type: 'cover_letter',
          content: JSON.stringify({
            text: 'TODO: Set OPENAI_API_KEY to generate cover letter',
          }),
        },
      });
    }

    // Step 5: Generate resume variant using LLM
    let resumeVariantResult;
    let hasValidationErrors = false;

    if (apiKey) {
      // Use real OpenAI client
      const llmClient = new OpenAiClient(apiKey);
      resumeVariantResult = await generateResumeVariant({
        jobPostingId: jobId,
        materialPacketId: materialPacket.id,
        llmClient,
        prisma,
      });

      if (!resumeVariantResult.success) {
        console.error('Resume variant generation failed:', resumeVariantResult.error);
        // Fall back to placeholder
        await prisma.materialVersion.create({
          data: {
            materialPacketId: materialPacket.id,
            version: 2,
            stage: 'generated',
            type: 'resume_variant',
            content: JSON.stringify({
              text: 'TODO: Resume variant generation failed',
              error: resumeVariantResult.error,
            }),
          },
        });
      } else if (resumeVariantResult.validationErrors && resumeVariantResult.validationErrors.length > 0) {
        // Validation errors found
        hasValidationErrors = true;
        console.warn('Resume variant has validation errors:', resumeVariantResult.validationErrors);
      }
    } else {
      // No API key - use placeholder
      console.warn('OPENAI_API_KEY not set - using placeholder resume variant');
      await prisma.materialVersion.create({
        data: {
          materialPacketId: materialPacket.id,
          version: 2,
          stage: 'generated',
          type: 'resume_variant',
          content: JSON.stringify({
            text: 'TODO: Set OPENAI_API_KEY to generate resume variant',
          }),
        },
      });
    }

    // Step 6: Update job status based on validation results
    let newStatus: string;
    let statusNotes: string;

    if (hasValidationErrors) {
      // Validation failed - mark as needs_attention
      newStatus = 'needs_attention';
      statusNotes = 'Resume variant validation failed. Please review validation errors.';
    } else {
      // All good - mark as in_review
      newStatus = 'in_review';
      statusNotes = 'Pipeline completed successfully. Ready for review.';
    }

    await prisma.jobPosting.update({
      where: { id: jobId },
      data: { status: newStatus },
    });

    // Record status transition
    await prisma.statusEvent.create({
      data: {
        jobPostingId: jobId,
        fromStatus: job.status,
        toStatus: newStatus,
        notes: statusNotes,
      },
    });

    return NextResponse.json(
      {
        success: true,
        jobId,
        fitScoreId: fitScore.id,
        materialPacketId: materialPacket.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error running pipeline:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to run pipeline',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate a placeholder FitScore
 * In v0, this is a simple heuristic. Later this will be replaced with LLM scoring.
 */
function generatePlaceholderScore(
  description: string,
  title: string
): { score: number; reasoning: string } {
  // Simple placeholder logic: longer descriptions get higher scores
  // and certain keywords boost the score
  let score = 50; // Base score

  const keywords = [
    'typescript',
    'react',
    'node',
    'javascript',
    'senior',
    'engineer',
    'fullstack',
    'backend',
    'frontend',
  ];

  const descLower = description.toLowerCase();
  const titleLower = title.toLowerCase();

  // Boost score for relevant keywords
  keywords.forEach((keyword) => {
    if (descLower.includes(keyword) || titleLower.includes(keyword)) {
      score += 5;
    }
  });

  // Boost score for longer descriptions (more detail = better fit estimation)
  if (description.length > 500) {
    score += 10;
  }
  if (description.length > 1000) {
    score += 10;
  }

  // Cap score at 100
  score = Math.min(score, 100);

  const reasoning = `Placeholder score based on job description length (${description.length} chars) and keyword matching. This will be replaced with LLM-based scoring.`;

  return { score, reasoning };
}
