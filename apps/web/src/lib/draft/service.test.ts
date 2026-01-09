import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { generateCoverLetter } from './service';
import { LlmClient, LlmGenerateTextInput, LlmGenerateTextOutput } from '../llm';

const prisma = new PrismaClient();

/**
 * Mock LLM client that returns deterministic text
 */
class MockLlmClient implements LlmClient {
  async generateText(
    input: LlmGenerateTextInput
  ): Promise<LlmGenerateTextOutput> {
    // Return deterministic text based on task
    const text =
      input.task === 'cover_letter'
        ? 'Dear Hiring Team,\n\nI am excited to apply for this position. My experience with TypeScript and React makes me a great fit.\n\nSincerely,\nTest User'
        : 'Mock resume variant text';

    return {
      text,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      model: 'mock-model',
    };
  }
}

beforeAll(async () => {
  // Seed test data: user profile and KB bullets
  const existingProfile = await prisma.userProfile.findFirst();
  if (!existingProfile) {
    await prisma.userProfile.create({
      data: {
        name: 'Test User',
        email: 'test@example.com',
      },
    });
  }

  const existingBullets = await prisma.kbBullet.findMany({
    where: {
      id: { in: ['draft-bullet-1', 'draft-bullet-2'] },
    },
  });

  if (existingBullets.length === 0) {
    await prisma.kbBullet.createMany({
      data: [
        {
          id: 'draft-bullet-1',
          text: 'Built scalable web applications with TypeScript and React',
          tags: JSON.stringify(['typescript', 'react', 'web']),
        },
        {
          id: 'draft-bullet-2',
          text: 'Developed REST APIs with Node.js',
          tags: JSON.stringify(['nodejs', 'backend', 'api']),
        },
      ],
    });
  }
});

afterAll(async () => {
  // Clean up test data
  const testJobs = await prisma.jobPosting.findMany({
    where: {
      dedupeKey: {
        startsWith: 'test-draft-',
      },
    },
  });

  for (const job of testJobs) {
    await prisma.materialVersion.deleteMany({
      where: {
        materialPacket: {
          jobPostingId: job.id,
        },
      },
    });
    await prisma.materialPacket.deleteMany({
      where: { jobPostingId: job.id },
    });
    await prisma.statusEvent.deleteMany({
      where: { jobPostingId: job.id },
    });
    await prisma.fitScore.deleteMany({
      where: { jobPostingId: job.id },
    });
  }

  await prisma.jobPosting.deleteMany({
    where: {
      dedupeKey: {
        startsWith: 'test-draft-',
      },
    },
  });

  await prisma.jobSource.deleteMany({
    where: {
      url: {
        startsWith: 'https://example.com/jobs/test-draft',
      },
    },
  });

  await prisma.$disconnect();
});

describe('generateCoverLetter', () => {
  it('generates cover letter and saves MaterialVersion', async () => {
    // Create test job
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-draft-1',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-draft-job-1',
        title: 'Senior Frontend Engineer',
        company: 'Tech Corp',
        location: 'Remote',
        description: 'Build awesome React apps with TypeScript',
        status: 'new',
        jobSourceId: jobSource.id,
      },
    });

    const materialPacket = await prisma.materialPacket.create({
      data: {
        jobPostingId: jobPosting.id,
        resumeVariantText: 'TODO',
        metadata: JSON.stringify({
          selectedKbBulletIds: ['draft-bullet-1', 'draft-bullet-2'],
          jobKeywords: ['typescript', 'react'],
        }),
      },
    });

    // Generate cover letter
    const mockLlm = new MockLlmClient();
    const result = await generateCoverLetter({
      jobPostingId: jobPosting.id,
      materialPacketId: materialPacket.id,
      llmClient: mockLlm,
      prisma,
    });

    expect(result.success).toBe(true);
    expect(result.materialVersionId).toBeDefined();
    expect(result.text).toContain('Dear Hiring Team');

    // Verify MaterialVersion was created
    const materialVersion = await prisma.materialVersion.findUnique({
      where: { id: result.materialVersionId },
    });

    expect(materialVersion).toBeDefined();
    expect(materialVersion?.type).toBe('cover_letter');
    expect(materialVersion?.stage).toBe('generated');
    expect(materialVersion?.content).toContain('Dear Hiring Team');
  });

  it('includes metadata with citations in MaterialVersion', async () => {
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-draft-2',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-draft-job-2',
        title: 'Backend Engineer',
        company: 'Startup Inc',
        description: 'Node.js backend development',
        status: 'new',
        jobSourceId: jobSource.id,
      },
    });

    const materialPacket = await prisma.materialPacket.create({
      data: {
        jobPostingId: jobPosting.id,
        resumeVariantText: 'TODO',
        metadata: JSON.stringify({
          selectedKbBulletIds: ['draft-bullet-1'],
          jobKeywords: ['nodejs'],
        }),
      },
    });

    const mockLlm = new MockLlmClient();
    const result = await generateCoverLetter({
      jobPostingId: jobPosting.id,
      materialPacketId: materialPacket.id,
      llmClient: mockLlm,
      prisma,
    });

    expect(result.success).toBe(true);

    const materialVersion = await prisma.materialVersion.findUnique({
      where: { id: result.materialVersionId },
    });

    expect(materialVersion?.content).toBeTruthy();

    // Check content includes metadata with citations
    const content = JSON.parse(materialVersion!.content);
    expect(content.text).toBeTruthy();
    expect(content.citations).toBeDefined();
    expect(content.citations.selectedBulletIds).toContain('draft-bullet-1');
    expect(content.llmUsage).toBeDefined();
  });

  it('returns error when job not found', async () => {
    const mockLlm = new MockLlmClient();
    const result = await generateCoverLetter({
      jobPostingId: 'non-existent-job-id',
      materialPacketId: 'non-existent-packet-id',
      llmClient: mockLlm,
      prisma,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('uses selected KB bullets in prompt', async () => {
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-draft-3',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-draft-job-3',
        title: 'Fullstack Engineer',
        company: 'Company',
        description: 'Fullstack development',
        status: 'new',
        jobSourceId: jobSource.id,
      },
    });

    const materialPacket = await prisma.materialPacket.create({
      data: {
        jobPostingId: jobPosting.id,
        resumeVariantText: 'TODO',
        metadata: JSON.stringify({
          selectedKbBulletIds: ['draft-bullet-1', 'draft-bullet-2'],
          jobKeywords: ['typescript', 'nodejs'],
        }),
      },
    });

    // Create a capturing mock
    let capturedPrompt = '';
    class CapturingMockLlm implements LlmClient {
      async generateText(
        input: LlmGenerateTextInput
      ): Promise<LlmGenerateTextOutput> {
        capturedPrompt = input.prompt;
        return {
          text: 'Test cover letter',
          usage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
          },
          model: 'mock-model',
        };
      }
    }

    const capturingLlm = new CapturingMockLlm();
    const result = await generateCoverLetter({
      jobPostingId: jobPosting.id,
      materialPacketId: materialPacket.id,
      llmClient: capturingLlm,
      prisma,
    });

    expect(result.success).toBe(true);
    expect(capturedPrompt).toContain(
      'Built scalable web applications with TypeScript and React'
    );
    expect(capturedPrompt).toContain('Developed REST APIs with Node.js');
  });
});
