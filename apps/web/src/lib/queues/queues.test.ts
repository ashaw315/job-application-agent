import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { ScoreJobData, DraftJobData, ScoreJobResult, DraftJobResult } from './types';
import { generateCoverLetter, generateResumeVariant } from '../draft/service';
import { LlmClient, LlmGenerateTextInput, LlmGenerateTextOutput } from '../llm';

const prisma = new PrismaClient();

// Mock LLM client
class MockLlmClient implements LlmClient {
  private callCount = 0;
  private shouldFail = false;

  setShouldFail(fail: boolean) {
    this.shouldFail = fail;
  }

  async generateText(
    input: LlmGenerateTextInput
  ): Promise<LlmGenerateTextOutput> {
    this.callCount++;

    // Simulate transient failure on first call, then succeed
    if (this.shouldFail && this.callCount === 1) {
      throw new Error('Transient LLM error (simulated 429)');
    }

    if (input.task === 'cover_letter') {
      return {
        text: 'Test cover letter content',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'mock-model',
      };
    } else if (input.task === 'resume_variant') {
      return {
        text: 'Test resume bullet\nAnother test bullet',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'mock-model',
      };
    }

    return {
      text: 'Mock text',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: 'mock-model',
    };
  }

  getCallCount() {
    return this.callCount;
  }

  resetCallCount() {
    this.callCount = 0;
  }
}

// Skip tests if REDIS_URL is not set
const REDIS_URL = process.env.REDIS_URL;
const describeWithRedis = REDIS_URL ? describe : describe.skip;

describeWithRedis('Queue Idempotency and Retry', () => {
  let redis: IORedis;
  let scoreQueue: Queue<ScoreJobData, ScoreJobResult>;
  let draftQueue: Queue<DraftJobData, DraftJobResult>;
  let scoreWorker: Worker<ScoreJobData, ScoreJobResult>;
  let draftWorker: Worker<DraftJobData, DraftJobResult>;
  let mockLlm: MockLlmClient;

  beforeAll(async () => {
    // Setup Redis connection
    redis = new IORedis(REDIS_URL!, {
      maxRetriesPerRequest: null,
    });

    // Create queues
    scoreQueue = new Queue<ScoreJobData, ScoreJobResult>('test-score-queue', {
      connection: redis as any, // Type assertion to handle ioredis version mismatch
    });

    draftQueue = new Queue<DraftJobData, DraftJobResult>('test-draft-queue', {
      connection: redis as any, // Type assertion to handle ioredis version mismatch
    });

    // Setup mock LLM
    mockLlm = new MockLlmClient();

    // Create workers
    scoreWorker = new Worker<ScoreJobData, ScoreJobResult>(
      'test-score-queue',
      async (job) => {
        const { jobPostingId } = job.data;

        // Check if score already exists (idempotency)
        const existingScore = await prisma.fitScore.findUnique({
          where: { jobPostingId },
        });

        if (existingScore) {
          return {
            success: true,
            jobPostingId,
            score: existingScore.score,
          };
        }

        // Create score
        const score = 75;
        await prisma.fitScore.create({
          data: {
            jobPostingId,
            score,
            reasoning: 'Test score',
          },
        });

        return {
          success: true,
          jobPostingId,
          score,
        };
      },
      { connection: redis as any } // Type assertion to handle ioredis version mismatch
    );

    draftWorker = new Worker<DraftJobData, DraftJobResult>(
      'test-draft-queue',
      async (job) => {
        const { jobPostingId, materialPacketId } = job.data;

        // Check if materials already exist (idempotency)
        const existingVersions = await prisma.materialVersion.findMany({
          where: { materialPacketId },
        });

        if (existingVersions.length > 0) {
          return {
            success: true,
            jobPostingId,
            materialPacketId,
            coverLetterVersionId: existingVersions.find((v) => v.type === 'cover_letter')?.id,
            resumeVersionId: existingVersions.find((v) => v.type === 'resume_variant')?.id,
          };
        }

        // Generate materials
        const coverLetterResult = await generateCoverLetter({
          jobPostingId,
          materialPacketId,
          llmClient: mockLlm,
          prisma,
        });

        if (!coverLetterResult.success) {
          throw new Error(coverLetterResult.error);
        }

        const resumeResult = await generateResumeVariant({
          jobPostingId,
          materialPacketId,
          llmClient: mockLlm,
          prisma,
        });

        if (!resumeResult.success) {
          throw new Error(resumeResult.error);
        }

        return {
          success: true,
          jobPostingId,
          materialPacketId,
          coverLetterVersionId: coverLetterResult.materialVersionId,
          resumeVersionId: resumeResult.materialVersionId,
        };
      },
      { connection: redis as any } // Type assertion to handle ioredis version mismatch
    );

    // Ensure user profile exists for drafting tests
    const existingProfile = await prisma.userProfile.findFirst();
    if (!existingProfile) {
      await prisma.userProfile.create({
        data: {
          name: 'Test User',
          email: 'test@example.com',
        },
      });
    }

    // Ensure KB bullets exist
    const existingBullets = await prisma.kbBullet.findMany();
    if (existingBullets.length === 0) {
      await prisma.kbBullet.createMany({
        data: [
          {
            id: 'queue-test-bullet-1',
            text: 'Built scalable applications',
            tags: JSON.stringify(['typescript', 'react']),
          },
          {
            id: 'queue-test-bullet-2',
            text: 'Developed backend systems',
            tags: JSON.stringify(['nodejs', 'api']),
          },
        ],
      });
    }
  });

  afterAll(async () => {
    // Clean up
    await scoreWorker.close();
    await draftWorker.close();
    await scoreQueue.close();
    await draftQueue.close();
    await redis.quit();

    // Clean up test data
    await prisma.materialVersion.deleteMany({
      where: {
        materialPacket: {
          jobPosting: {
            dedupeKey: {
              startsWith: 'queue-test-',
            },
          },
        },
      },
    });
    await prisma.materialPacket.deleteMany({
      where: {
        jobPosting: {
          dedupeKey: {
            startsWith: 'queue-test-',
          },
        },
      },
    });
    await prisma.fitScore.deleteMany({
      where: {
        jobPosting: {
          dedupeKey: {
            startsWith: 'queue-test-',
          },
        },
      },
    });
    await prisma.statusEvent.deleteMany();
    await prisma.jobPosting.deleteMany({
      where: {
        dedupeKey: {
          startsWith: 'queue-test-',
        },
      },
    });
    await prisma.jobSource.deleteMany({
      where: {
        url: {
          startsWith: 'https://example.com/queue-test',
        },
      },
    });

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean queues before each test
    await scoreQueue.drain();
    await draftQueue.drain();
    mockLlm.resetCallCount();
    mockLlm.setShouldFail(false);
  });

  it('score job is idempotent - repeated enqueues dont duplicate scores', async () => {
    // Create test job
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/queue-test-1',
        atsType: 'greenhouse',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'queue-test-idempotent-1',
        title: 'Software Engineer',
        company: 'Test Corp',
        description: 'Test job',
        status: 'new',
        jobSourceId: jobSource.id,
      },
    });

    const idempotencyKey = `score:${jobPosting.id}`;

    // Enqueue job twice with same idempotency key
    await scoreQueue.add(
      'compute-score',
      {
        jobPostingId: jobPosting.id,
        idempotencyKey,
      },
      { jobId: idempotencyKey }
    );

    await scoreQueue.add(
      'compute-score',
      {
        jobPostingId: jobPosting.id,
        idempotencyKey,
      },
      { jobId: idempotencyKey }
    );

    // Wait for jobs to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify only one score was created
    const scores = await prisma.fitScore.findMany({
      where: { jobPostingId: jobPosting.id },
    });

    expect(scores).toHaveLength(1);
    expect(scores[0].score).toBe(75);
  }, 10000);

  it('draft job is idempotent - repeated enqueues dont duplicate materials', async () => {
    // Create test job
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/queue-test-2',
        atsType: 'greenhouse',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'queue-test-idempotent-2',
        title: 'Backend Engineer',
        company: 'Tech Corp',
        description: 'Backend development',
        status: 'scored',
        jobSourceId: jobSource.id,
      },
    });

    const materialPacket = await prisma.materialPacket.create({
      data: {
        jobPostingId: jobPosting.id,
        resumeVariantText: 'TODO',
        metadata: JSON.stringify({
          selectedKbBulletIds: ['queue-test-bullet-1', 'queue-test-bullet-2'],
        }),
      },
    });

    const idempotencyKey = `draft:${jobPosting.id}`;

    // Enqueue job twice with same idempotency key
    await draftQueue.add(
      'draft-materials',
      {
        jobPostingId: jobPosting.id,
        materialPacketId: materialPacket.id,
        idempotencyKey,
      },
      { jobId: idempotencyKey }
    );

    await draftQueue.add(
      'draft-materials',
      {
        jobPostingId: jobPosting.id,
        materialPacketId: materialPacket.id,
        idempotencyKey,
      },
      { jobId: idempotencyKey }
    );

    // Wait for jobs to complete
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Verify only one set of materials was created
    const versions = await prisma.materialVersion.findMany({
      where: { materialPacketId: materialPacket.id },
    });

    expect(versions).toHaveLength(2); // cover_letter + resume_variant
    expect(versions.find((v) => v.type === 'cover_letter')).toBeDefined();
    expect(versions.find((v) => v.type === 'resume_variant')).toBeDefined();

    // Verify each type only has version 1
    const coverLetterVersions = versions.filter((v) => v.type === 'cover_letter');
    const resumeVersions = versions.filter((v) => v.type === 'resume_variant');
    expect(coverLetterVersions).toHaveLength(1);
    expect(resumeVersions).toHaveLength(1);
  }, 10000);

  it('draft job retries on transient LLM failure', async () => {
    // Create test job
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/queue-test-3',
        atsType: 'greenhouse',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'queue-test-retry-1',
        title: 'Full Stack Engineer',
        company: 'Startup Inc',
        description: 'Full stack development',
        status: 'scored',
        jobSourceId: jobSource.id,
      },
    });

    const materialPacket = await prisma.materialPacket.create({
      data: {
        jobPostingId: jobPosting.id,
        resumeVariantText: 'TODO',
        metadata: JSON.stringify({
          selectedKbBulletIds: ['queue-test-bullet-1'],
        }),
      },
    });

    // Configure mock to fail once then succeed
    mockLlm.setShouldFail(true);

    const idempotencyKey = `draft:${jobPosting.id}`;

    // Enqueue job with retry configuration
    await draftQueue.add(
      'draft-materials',
      {
        jobPostingId: jobPosting.id,
        materialPacketId: materialPacket.id,
        idempotencyKey,
      },
      {
        jobId: idempotencyKey,
        attempts: 3,
        backoff: {
          type: 'fixed',
          delay: 500, // Quick retry for test
        },
      }
    );

    // Wait for job to retry and complete
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify materials were created after retry
    const versions = await prisma.materialVersion.findMany({
      where: { materialPacketId: materialPacket.id },
    });

    expect(versions.length).toBeGreaterThan(0);
    expect(mockLlm.getCallCount()).toBeGreaterThan(1); // Should have retried
  }, 10000);
});
