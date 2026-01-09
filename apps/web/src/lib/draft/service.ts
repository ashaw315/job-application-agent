import { PrismaClient } from '@prisma/client';
import { LlmClient } from '../llm';
import {
  buildCoverLetterPrompt,
  buildCoverLetterSystemPrompt,
  buildResumeVariantPrompt,
  buildResumeVariantSystemPrompt,
  buildFollowUpEmailPrompt,
  buildFollowUpEmailSystemPrompt,
  BulletForPrompt,
} from './prompts';
import {
  validateResumeVariant,
  extractTechTerms,
  type ValidationError,
} from '@job-application-agent/shared';

export interface GenerateCoverLetterInput {
  jobPostingId: string;
  materialPacketId: string;
  llmClient: LlmClient;
  prisma: PrismaClient;
}

export interface GenerateCoverLetterOutput {
  success: boolean;
  materialVersionId?: string;
  text?: string;
  error?: string;
}

/**
 * Generate a cover letter for a job posting using LLM
 */
export async function generateCoverLetter(
  input: GenerateCoverLetterInput
): Promise<GenerateCoverLetterOutput> {
  const { jobPostingId, materialPacketId, llmClient, prisma } = input;

  try {
    // Load job posting
    const job = await prisma.jobPosting.findUnique({
      where: { id: jobPostingId },
    });

    if (!job) {
      return {
        success: false,
        error: 'Job posting not found',
      };
    }

    // Load material packet with metadata
    const materialPacket = await prisma.materialPacket.findUnique({
      where: { id: materialPacketId },
    });

    if (!materialPacket) {
      return {
        success: false,
        error: 'Material packet not found',
      };
    }

    // Parse metadata to get selected bullet IDs
    let selectedBulletIds: string[] = [];
    try {
      const metadata = JSON.parse(materialPacket.metadata || '{}');
      selectedBulletIds = metadata.selectedKbBulletIds || [];
    } catch {
      selectedBulletIds = [];
    }

    // Load selected KB bullets
    const kbBullets = await prisma.kbBullet.findMany({
      where: {
        id: { in: selectedBulletIds },
      },
    });

    // Parse tags for each bullet
    const bulletsForPrompt: BulletForPrompt[] = kbBullets.map((b) => {
      let tags: string[] = [];
      try {
        tags = JSON.parse(b.tags);
        if (!Array.isArray(tags)) {
          tags = [];
        }
      } catch {
        tags = [];
      }
      return {
        id: b.id,
        text: b.text,
        tags,
      };
    });

    // Load user profile
    const userProfile = await prisma.userProfile.findFirst();

    if (!userProfile) {
      return {
        success: false,
        error: 'User profile not found',
      };
    }

    // Build prompt
    const prompt = buildCoverLetterPrompt({
      job: {
        title: job.title,
        company: job.company,
        description: job.description,
        location: job.location,
      },
      selectedBullets: bulletsForPrompt,
      userProfile: {
        name: userProfile.name,
        email: userProfile.email,
        phone: userProfile.phone,
      },
    });

    const systemPrompt = buildCoverLetterSystemPrompt();

    // Generate cover letter using LLM
    const llmResult = await llmClient.generateText({
      task: 'cover_letter',
      prompt,
      systemPrompt,
      maxTokens: 1000,
      temperature: 0.7,
    });

    // Get next version number
    const existingVersions = await prisma.materialVersion.findMany({
      where: {
        materialPacketId,
        type: 'cover_letter',
      },
      orderBy: {
        version: 'desc',
      },
      take: 1,
    });

    const nextVersion =
      existingVersions.length > 0 ? existingVersions[0].version + 1 : 1;

    // Save MaterialVersion with metadata including citations
    const materialVersion = await prisma.materialVersion.create({
      data: {
        materialPacketId,
        version: nextVersion,
        stage: 'generated',
        type: 'cover_letter',
        content: JSON.stringify({
          text: llmResult.text,
          citations: {
            selectedBulletIds,
            model: llmResult.model,
          },
          llmUsage: llmResult.usage,
          generatedAt: new Date().toISOString(),
        }),
      },
    });

    // Update material packet with cover letter text
    await prisma.materialPacket.update({
      where: { id: materialPacketId },
      data: {
        coverLetterText: llmResult.text,
      },
    });

    return {
      success: true,
      materialVersionId: materialVersion.id,
      text: llmResult.text,
    };
  } catch (error) {
    console.error('Error generating cover letter:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to generate cover letter',
    };
  }
}

export interface GenerateResumeVariantInput {
  jobPostingId: string;
  materialPacketId: string;
  llmClient: LlmClient;
  prisma: PrismaClient;
}

export interface GenerateResumeVariantOutput {
  success: boolean;
  materialVersionId?: string;
  text?: string;
  validationErrors?: ValidationError[];
  error?: string;
}

/**
 * Generate a resume variant for a job posting using LLM with strict validation
 */
export async function generateResumeVariant(
  input: GenerateResumeVariantInput
): Promise<GenerateResumeVariantOutput> {
  const { jobPostingId, materialPacketId, llmClient, prisma } = input;

  try {
    // Load job posting
    const job = await prisma.jobPosting.findUnique({
      where: { id: jobPostingId },
    });

    if (!job) {
      return {
        success: false,
        error: 'Job posting not found',
      };
    }

    // Load material packet with metadata
    const materialPacket = await prisma.materialPacket.findUnique({
      where: { id: materialPacketId },
    });

    if (!materialPacket) {
      return {
        success: false,
        error: 'Material packet not found',
      };
    }

    // Parse metadata to get selected bullet IDs
    let selectedBulletIds: string[] = [];
    try {
      const metadata = JSON.parse(materialPacket.metadata || '{}');
      selectedBulletIds = metadata.selectedKbBulletIds || [];
    } catch {
      selectedBulletIds = [];
    }

    // Load selected KB bullets
    const kbBullets = await prisma.kbBullet.findMany({
      where: {
        id: { in: selectedBulletIds },
      },
    });

    // Parse tags for each bullet
    const bulletsForPrompt: BulletForPrompt[] = kbBullets.map((b) => {
      let tags: string[] = [];
      try {
        tags = JSON.parse(b.tags);
        if (!Array.isArray(tags)) {
          tags = [];
        }
      } catch {
        tags = [];
      }
      return {
        id: b.id,
        text: b.text,
        tags,
      };
    });

    // Build prompt
    const prompt = buildResumeVariantPrompt({
      job: {
        title: job.title,
        company: job.company,
        description: job.description,
        location: job.location,
      },
      selectedBullets: bulletsForPrompt,
    });

    const systemPrompt = buildResumeVariantSystemPrompt();

    // Generate resume variant using LLM
    const llmResult = await llmClient.generateText({
      task: 'resume_variant',
      prompt,
      systemPrompt,
      maxTokens: 1500,
      temperature: 0.3, // Lower temperature for more conservative output
    });

    // Parse the generated text into individual bullets
    const generatedBullets = llmResult.text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Validate each generated bullet against its original
    const validationErrors: ValidationError[] = [];
    const validatedBullets: Array<{
      original: string;
      variant: string;
      isValid: boolean;
    }> = [];

    // Build allowed tech terms set from all bullets' tags plus global dictionary
    const allTags = bulletsForPrompt.flatMap((b) => b.tags);
    const allowedTechTerms = extractTechTerms(allTags);

    for (let i = 0; i < Math.min(bulletsForPrompt.length, generatedBullets.length); i++) {
      const originalBullet = bulletsForPrompt[i];
      const generatedText = generatedBullets[i];

      const validationResult = validateResumeVariant({
        originalBullet: {
          text: originalBullet.text,
          tags: originalBullet.tags,
        },
        generatedVariant: generatedText,
        allowedTechTerms,
      });

      validatedBullets.push({
        original: originalBullet.text,
        variant: generatedText,
        isValid: validationResult.isValid,
      });

      if (!validationResult.isValid) {
        validationErrors.push(...validationResult.errors);
      }
    }

    // Get next version number
    const existingVersions = await prisma.materialVersion.findMany({
      where: {
        materialPacketId,
        type: 'resume_variant',
      },
      orderBy: {
        version: 'desc',
      },
      take: 1,
    });

    const nextVersion =
      existingVersions.length > 0 ? existingVersions[0].version + 1 : 1;

    // Save MaterialVersion with validation results
    const materialVersion = await prisma.materialVersion.create({
      data: {
        materialPacketId,
        version: nextVersion,
        stage: 'generated',
        type: 'resume_variant',
        content: JSON.stringify({
          bullets: validatedBullets,
          citations: {
            selectedBulletIds,
            model: llmResult.model,
          },
          validation: {
            hasErrors: validationErrors.length > 0,
            errors: validationErrors,
          },
          llmUsage: llmResult.usage,
          generatedAt: new Date().toISOString(),
        }),
      },
    });

    // Update material packet with resume variant text (only valid bullets)
    const validBulletsText = validatedBullets
      .filter((b) => b.isValid)
      .map((b) => b.variant)
      .join('\n');

    await prisma.materialPacket.update({
      where: { id: materialPacketId },
      data: {
        resumeVariantText: validBulletsText || 'No valid bullets generated',
      },
    });

    return {
      success: true,
      materialVersionId: materialVersion.id,
      text: llmResult.text,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    };
  } catch (error) {
    console.error('Error generating resume variant:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to generate resume variant',
    };
  }
}

export interface GenerateFollowUpEmailInput {
  jobPostingId: string;
  materialPacketId: string;
  suggestionId: string;
  llmClient: LlmClient;
  prisma: PrismaClient;
}

export interface GenerateFollowUpEmailOutput {
  success: boolean;
  draftId?: string;
  subject?: string;
  body?: string;
  error?: string;
}

/**
 * Generate a follow-up email for a job posting using LLM
 */
export async function generateFollowUpEmail(
  input: GenerateFollowUpEmailInput
): Promise<GenerateFollowUpEmailOutput> {
  const { jobPostingId, materialPacketId, suggestionId, llmClient, prisma } =
    input;

  try {
    // Load job posting
    const job = await prisma.jobPosting.findUnique({
      where: { id: jobPostingId },
    });

    if (!job) {
      return {
        success: false,
        error: 'Job posting not found',
      };
    }

    // Load suggestion
    const suggestion = await prisma.followUpSuggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion) {
      return {
        success: false,
        error: 'Suggestion not found',
      };
    }

    // Check if draft already exists (idempotency)
    const existingDraft = await prisma.followUpEmailDraft.findFirst({
      where: { followUpSuggestionId: suggestionId },
    });

    if (existingDraft) {
      return {
        success: true,
        draftId: existingDraft.id,
        subject: existingDraft.subject,
        body: existingDraft.body,
      };
    }

    // Load user profile
    const userProfile = await prisma.userProfile.findFirst();

    if (!userProfile) {
      return {
        success: false,
        error: 'User profile not found',
      };
    }

    // Calculate days after application
    const now = new Date();
    const appliedDate = job.createdAt;
    const daysAfterApplication = Math.floor(
      (now.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Build prompt
    const prompt = buildFollowUpEmailPrompt({
      job: {
        title: job.title,
        company: job.company,
        description: job.description,
        location: job.location,
      },
      userProfile: {
        name: userProfile.name,
        email: userProfile.email,
        phone: userProfile.phone,
      },
      suggestionText: suggestion.text,
      daysAfterApplication,
    });

    const systemPrompt = buildFollowUpEmailSystemPrompt();

    // Generate follow-up email using LLM
    const llmResult = await llmClient.generateText({
      task: 'followup_email',
      prompt,
      systemPrompt,
      maxTokens: 500,
      temperature: 0.7,
    });

    // Parse subject and body from LLM output
    const emailText = llmResult.text.trim();
    let subject = '';
    let body = '';

    const subjectMatch = emailText.match(/^Subject:\s*(.+?)(?:\n|$)/i);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      body = emailText.substring(subjectMatch[0].length).trim();
    } else {
      // Fallback if no subject line found
      const lines = emailText.split('\n');
      subject = `Following up on ${job.title} Application`;
      body = lines.join('\n').trim();
    }

    // Get next version number
    const existingVersions = await prisma.materialVersion.findMany({
      where: {
        materialPacketId,
        type: 'followup_email',
      },
      orderBy: {
        version: 'desc',
      },
      take: 1,
    });

    const nextVersion =
      existingVersions.length > 0 ? existingVersions[0].version + 1 : 1;

    // Save MaterialVersion
    await prisma.materialVersion.create({
      data: {
        materialPacketId,
        version: nextVersion,
        stage: 'generated',
        type: 'followup_email',
        content: JSON.stringify({
          subject,
          body,
          llmUsage: llmResult.usage,
          model: llmResult.model,
          generatedAt: new Date().toISOString(),
          suggestionId,
          daysAfterApplication,
        }),
      },
    });

    // Create FollowUpEmailDraft
    const draft = await prisma.followUpEmailDraft.create({
      data: {
        followUpSuggestionId: suggestionId,
        subject,
        body,
      },
    });

    return {
      success: true,
      draftId: draft.id,
      subject: draft.subject,
      body: draft.body,
    };
  } catch (error) {
    console.error('Error generating follow-up email:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to generate follow-up email',
    };
  }
}
