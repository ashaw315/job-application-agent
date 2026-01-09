import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { generateFollowUpEmail } from '@/lib/draft/service';
import { LlmClient, LlmGenerateTextInput, LlmGenerateTextOutput } from '@/lib/llm';

const prisma = new PrismaClient();

/**
 * Mock LLM client for follow-up email generation
 */
class MockLlmClient implements LlmClient {
  async generateText(
    input: LlmGenerateTextInput
  ): Promise<LlmGenerateTextOutput> {
    if (input.task === 'followup_email') {
      return {
        text: 'Subject: Following up on Software Engineer Application\n\nDear Hiring Team,\n\nI wanted to follow up on my application for the Software Engineer position at Test Corp. I remain very interested in this opportunity.\n\nBest regards,\nTest User',
        usage: {
          promptTokens: 150,
          completionTokens: 75,
          totalTokens: 225,
        },
        model: 'mock-model',
      };
    }
    return {
      text: 'Mock text',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: 'mock-model',
    };
  }
}

beforeAll(async () => {
  // Ensure user profile exists for tests
  const existingProfile = await prisma.userProfile.findFirst();
  if (!existingProfile) {
    await prisma.userProfile.create({
      data: {
        name: 'Test User',
        email: 'test@example.com',
      },
    });
  }
});

afterAll(async () => {
  // Clean up test data
  await prisma.followUpEmailDraft.deleteMany();
  await prisma.followUpSuggestion.deleteMany();
  await prisma.materialVersion.deleteMany({
    where: {
      type: 'followup_email',
    },
  });
  await prisma.materialPacket.deleteMany({
    where: {
      jobPosting: {
        dedupeKey: {
          startsWith: 'test-followup-draft-',
        },
      },
    },
  });
  await prisma.statusEvent.deleteMany();
  await prisma.fitScore.deleteMany();
  await prisma.jobPosting.deleteMany({
    where: {
      dedupeKey: {
        startsWith: 'test-followup-draft-',
      },
    },
  });
  await prisma.jobSource.deleteMany({
    where: {
      url: {
        startsWith: 'https://example.com/jobs/test-draft-',
      },
    },
  });
  await prisma.$disconnect();
});

describe('generateFollowUpEmail', () => {
  it('returns error when job posting does not exist', async () => {
    const mockLlm = new MockLlmClient();
    const result = await generateFollowUpEmail({
      jobPostingId: '00000000-0000-0000-0000-000000000000',
      materialPacketId: '00000000-0000-0000-0000-000000000000',
      suggestionId: 'some-suggestion-id',
      llmClient: mockLlm,
      prisma,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Job posting not found');
  });

  it('returns error when suggestion does not exist', async () => {
    // Create test job without suggestion
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-draft-1',
        atsType: 'greenhouse',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-followup-draft-1',
        title: 'Software Engineer',
        company: 'Test Corp',
        description: 'Test job',
        status: 'applied',
        jobSourceId: jobSource.id,
      },
    });

    const materialPacket = await prisma.materialPacket.create({
      data: {
        jobPostingId: jobPosting.id,
        resumeVariantText: 'Test resume',
      },
    });

    const mockLlm = new MockLlmClient();
    const result = await generateFollowUpEmail({
      jobPostingId: jobPosting.id,
      materialPacketId: materialPacket.id,
      suggestionId: '00000000-0000-0000-0000-000000000000',
      llmClient: mockLlm,
      prisma,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Suggestion not found');
  });

  it('generates follow-up email and creates MaterialVersion and FollowUpEmailDraft', async () => {
    // Create test job with material packet
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-draft-2',
        atsType: 'greenhouse',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-followup-draft-2',
        title: 'Backend Engineer',
        company: 'Tech Corp',
        description: 'Backend development role',
        status: 'applied',
        jobSourceId: jobSource.id,
      },
    });

    const materialPacket = await prisma.materialPacket.create({
      data: {
        jobPostingId: jobPosting.id,
        resumeVariantText: 'Test resume',
      },
    });

    // Create suggestion
    const suggestion = await prisma.followUpSuggestion.create({
      data: {
        jobPostingId: jobPosting.id,
        suggestedAt: new Date(),
        text: 'Follow up after 7 days',
      },
    });

    const mockLlm = new MockLlmClient();
    const result = await generateFollowUpEmail({
      jobPostingId: jobPosting.id,
      materialPacketId: materialPacket.id,
      suggestionId: suggestion.id,
      llmClient: mockLlm,
      prisma,
    });

    expect(result.success).toBe(true);
    expect(result.draftId).toBeDefined();
    expect(result.subject).toContain('Following up');
    expect(result.body).toContain('Test Corp');

    // Verify MaterialVersion was created
    const materialVersions = await prisma.materialVersion.findMany({
      where: {
        materialPacketId: materialPacket.id,
        type: 'followup_email',
      },
    });

    expect(materialVersions.length).toBeGreaterThan(0);
    const materialVersion = materialVersions[0];
    expect(materialVersion.stage).toBe('generated');
    expect(materialVersion.content).toBeTruthy();

    // Verify content structure
    const content = JSON.parse(materialVersion.content);
    expect(content.subject).toBeTruthy();
    expect(content.body).toBeTruthy();
    expect(content.llmUsage).toBeDefined();
    expect(content.generatedAt).toBeDefined();

    // Verify FollowUpEmailDraft was created
    const draft = await prisma.followUpEmailDraft.findUnique({
      where: { id: result.draftId },
    });

    expect(draft).toBeDefined();
    expect(draft?.followUpSuggestionId).toBe(suggestion.id);
    expect(draft?.subject).toContain('Following up');
    expect(draft?.body).toContain('Test Corp');
  });

  it('does not create duplicate drafts if called multiple times', async () => {
    // Create test job with material packet
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-draft-3',
        atsType: 'greenhouse',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-followup-draft-3',
        title: 'Full Stack Engineer',
        company: 'Tech Startup',
        description: 'Full stack development',
        status: 'applied',
        jobSourceId: jobSource.id,
      },
    });

    const materialPacket = await prisma.materialPacket.create({
      data: {
        jobPostingId: jobPosting.id,
        resumeVariantText: 'Test resume',
      },
    });

    const suggestion = await prisma.followUpSuggestion.create({
      data: {
        jobPostingId: jobPosting.id,
        suggestedAt: new Date(),
        text: 'Follow up after 14 days',
      },
    });

    const mockLlm = new MockLlmClient();

    // First call
    const result1 = await generateFollowUpEmail({
      jobPostingId: jobPosting.id,
      materialPacketId: materialPacket.id,
      suggestionId: suggestion.id,
      llmClient: mockLlm,
      prisma,
    });

    expect(result1.success).toBe(true);
    const firstDraftId = result1.draftId;

    // Second call - should return existing draft
    const result2 = await generateFollowUpEmail({
      jobPostingId: jobPosting.id,
      materialPacketId: materialPacket.id,
      suggestionId: suggestion.id,
      llmClient: mockLlm,
      prisma,
    });

    expect(result2.success).toBe(true);
    expect(result2.draftId).toBe(firstDraftId); // Same draft ID

    // Verify only one draft exists
    const drafts = await prisma.followUpEmailDraft.findMany({
      where: { followUpSuggestionId: suggestion.id },
    });

    expect(drafts).toHaveLength(1);
  });
});
