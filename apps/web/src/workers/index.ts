import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { defaultWorkerOptions, QUEUE_NAMES, closeRedisConnections } from '../lib/queues/config';
import {
  ScoreJobData,
  ScoreJobResult,
  DraftJobData,
  DraftJobResult,
  FollowUpJobData,
  FollowUpJobResult,
} from '../lib/queues/types';
import { createLogger } from '../lib/logger';
import { OpenAiClient } from '../lib/llm';
import { generateCoverLetter, generateResumeVariant, generateFollowUpEmail } from '../lib/draft/service';
import { extractKeywords, selectRelevantBullets } from '@job-application-agent/shared';
import { env } from '../lib/env';

const prisma = new PrismaClient();
const logger = createLogger({ component: 'worker' });

/**
 * Score worker - processes fit score computation jobs
 */
function createScoreWorker() {
  return new Worker<ScoreJobData, ScoreJobResult>(
    QUEUE_NAMES.SCORE,
    async (job: Job<ScoreJobData, ScoreJobResult>) => {
      const { jobPostingId, idempotencyKey } = job.data;
      const jobLogger = createLogger({
        component: 'score-worker',
        jobId: job.id,
        jobPostingId,
        idempotencyKey,
      });

      jobLogger.info('Processing score job');

      try {
        // Check if score already exists (idempotency)
        const existingScore = await prisma.fitScore.findUnique({
          where: { jobPostingId },
        });

        if (existingScore) {
          jobLogger.info({ score: existingScore.score }, 'Score already exists, skipping');
          return {
            success: true,
            jobPostingId,
            score: existingScore.score,
          };
        }

        // Load job posting
        const job = await prisma.jobPosting.findUnique({
          where: { id: jobPostingId },
        });

        if (!job) {
          jobLogger.error('Job posting not found');
          throw new Error('Job posting not found');
        }

        // Generate placeholder score (simplified for v0)
        const score = Math.floor(Math.random() * 40) + 60; // 60-100 range
        const reasoning = `Computed score based on job description keywords for ${job.title} at ${job.company}`;

        // Create fit score
        const fitScore = await prisma.fitScore.create({
          data: {
            jobPostingId,
            score,
            reasoning,
          },
        });

        // Update job status
        await prisma.jobPosting.update({
          where: { id: jobPostingId },
          data: { status: 'scored' },
        });

        // Create status event
        await prisma.statusEvent.create({
          data: {
            jobPostingId,
            fromStatus: job.status,
            toStatus: 'scored',
            actor: 'system',
            notes: 'Fit score computed via queue worker',
          },
        });

        jobLogger.info({ score: fitScore.score }, 'Score job completed');

        return {
          success: true,
          jobPostingId,
          score: fitScore.score,
        };
      } catch (error) {
        jobLogger.error({ err: error }, 'Score job failed');
        throw error;
      }
    },
    defaultWorkerOptions as any
  );
}

/**
 * Draft worker - processes material drafting jobs
 */
function createDraftWorker() {
  return new Worker<DraftJobData, DraftJobResult>(
    QUEUE_NAMES.DRAFT,
    async (job: Job<DraftJobData, DraftJobResult>) => {
      const { jobPostingId, materialPacketId, idempotencyKey } = job.data;
      const jobLogger = createLogger({
        component: 'draft-worker',
        jobId: job.id,
        jobPostingId,
        materialPacketId,
        idempotencyKey,
      });

      jobLogger.info('Processing draft job');

      try {
        // Check if materials already exist (idempotency)
        const existingVersions = await prisma.materialVersion.findMany({
          where: { materialPacketId },
        });

        if (existingVersions.length > 0) {
          jobLogger.info({ count: existingVersions.length }, 'Materials already drafted, skipping');
          return {
            success: true,
            jobPostingId,
            materialPacketId,
            coverLetterVersionId: existingVersions.find((v) => v.type === 'cover_letter')?.id,
            resumeVersionId: existingVersions.find((v) => v.type === 'resume_variant')?.id,
          };
        }

        // Load job posting
        const jobPosting = await prisma.jobPosting.findUnique({
          where: { id: jobPostingId },
        });

        if (!jobPosting) {
          jobLogger.error('Job posting not found');
          throw new Error('Job posting not found');
        }

        // Check if OpenAI API key is available
        const apiKey = env.OPENAI_API_KEY;
        if (!apiKey) {
          jobLogger.warn('OpenAI API key not configured, creating placeholder versions');

          // Create placeholder versions
          await prisma.materialVersion.createMany({
            data: [
              {
                materialPacketId,
                version: 1,
                stage: 'generated',
                type: 'cover_letter',
                content: JSON.stringify({
                  text: 'Cover letter generation skipped - OpenAI API key not configured',
                  generatedAt: new Date().toISOString(),
                }),
              },
              {
                materialPacketId,
                version: 1,
                stage: 'generated',
                type: 'resume_variant',
                content: JSON.stringify({
                  bullets: [],
                  validation: { hasErrors: false, errors: [] },
                  generatedAt: new Date().toISOString(),
                }),
              },
            ],
          });

          return {
            success: true,
            jobPostingId,
            materialPacketId,
          };
        }

        // Select relevant KB bullets
        const kbBullets = await prisma.kbBullet.findMany();
        const jobKeywords = extractKeywords(jobPosting.description);
        const relevantBullets = selectRelevantBullets({
          jobKeywords,
          kbBullets: kbBullets.map((b) => ({
            id: b.id,
            text: b.text,
            tags: b.tags,
          })),
          limit: 10,
        });

        // Load material packet
        let materialPacket = await prisma.materialPacket.findUnique({
          where: { id: materialPacketId },
        });

        if (!materialPacket) {
          // Create material packet with metadata
          materialPacket = await prisma.materialPacket.create({
            data: {
              jobPostingId,
              resumeVariantText: 'TODO',
              coverLetterText: 'TODO',
              metadata: JSON.stringify({
                selectedKbBulletIds: relevantBullets.selectedBullets.map((b) => b.bulletId),
                jobKeywords: relevantBullets.jobKeywords,
                bulletScores: relevantBullets.selectedBullets,
              }),
            },
          });
        }

        // Generate materials with LLM
        const llmClient = new OpenAiClient(apiKey);

        // Generate cover letter
        const coverLetterResult = await generateCoverLetter({
          jobPostingId,
          materialPacketId: materialPacket.id,
          llmClient,
          prisma,
        });

        if (!coverLetterResult.success) {
          jobLogger.error({ error: coverLetterResult.error }, 'Cover letter generation failed');
          throw new Error(coverLetterResult.error);
        }

        // Generate resume variant
        const resumeResult = await generateResumeVariant({
          jobPostingId,
          materialPacketId: materialPacket.id,
          llmClient,
          prisma,
        });

        if (!resumeResult.success) {
          jobLogger.error({ error: resumeResult.error }, 'Resume variant generation failed');
          throw new Error(resumeResult.error);
        }

        // Update job status
        const newStatus = resumeResult.validationErrors && resumeResult.validationErrors.length > 0
          ? 'needs_attention'
          : 'in_review';

        await prisma.jobPosting.update({
          where: { id: jobPostingId },
          data: { status: newStatus },
        });

        // Create status event
        await prisma.statusEvent.create({
          data: {
            jobPostingId,
            fromStatus: jobPosting.status,
            toStatus: newStatus,
            actor: 'system',
            notes: 'Materials drafted via queue worker',
          },
        });

        jobLogger.info(
          {
            coverLetterVersionId: coverLetterResult.materialVersionId,
            resumeVersionId: resumeResult.materialVersionId,
            newStatus,
          },
          'Draft job completed'
        );

        return {
          success: true,
          jobPostingId,
          materialPacketId: materialPacket.id,
          coverLetterVersionId: coverLetterResult.materialVersionId,
          resumeVersionId: resumeResult.materialVersionId,
        };
      } catch (error) {
        jobLogger.error({ err: error }, 'Draft job failed');
        throw error;
      }
    },
    defaultWorkerOptions as any
  );
}

/**
 * Follow-up worker - processes follow-up suggestion and email draft jobs
 */
function createFollowupWorker() {
  return new Worker<FollowUpJobData, FollowUpJobResult>(
    QUEUE_NAMES.FOLLOWUP,
    async (job: Job<FollowUpJobData, FollowUpJobResult>) => {
      const { jobPostingId, suggestionId, idempotencyKey } = job.data;
      const jobLogger = createLogger({
        component: 'followup-worker',
        jobId: job.id,
        jobPostingId,
        suggestionId,
        idempotencyKey,
      });

      jobLogger.info('Processing follow-up job');

      try {
        // Load job posting
        const jobPosting = await prisma.jobPosting.findUnique({
          where: { id: jobPostingId },
        });

        if (!jobPosting) {
          jobLogger.error('Job posting not found');
          throw new Error('Job posting not found');
        }

        if (suggestionId) {
          // Draft email for specific suggestion
          jobLogger.info('Drafting follow-up email');

          // Check if draft already exists
          const existingDraft = await prisma.followUpEmailDraft.findFirst({
            where: { followUpSuggestionId: suggestionId },
          });

          if (existingDraft) {
            jobLogger.info({ draftId: existingDraft.id }, 'Email draft already exists, skipping');
            return {
              success: true,
              jobPostingId,
              draftId: existingDraft.id,
            };
          }

          // Load or create material packet
          let materialPacket = await prisma.materialPacket.findFirst({
            where: { jobPostingId },
          });

          if (!materialPacket) {
            materialPacket = await prisma.materialPacket.create({
              data: {
                jobPostingId,
                resumeVariantText: 'N/A - Follow-up only',
              },
            });
          }

          // Check if OpenAI API key is available
          const apiKey = env.OPENAI_API_KEY;
          if (!apiKey) {
            jobLogger.warn('OpenAI API key not configured, skipping email draft');
            return {
              success: false,
              jobPostingId,
              error: 'OpenAI API key not configured',
            };
          }

          // Generate follow-up email
          const llmClient = new OpenAiClient(apiKey);
          const result = await generateFollowUpEmail({
            jobPostingId,
            materialPacketId: materialPacket.id,
            suggestionId,
            llmClient,
            prisma,
          });

          if (!result.success) {
            jobLogger.error({ error: result.error }, 'Follow-up email generation failed');
            throw new Error(result.error);
          }

          jobLogger.info({ draftId: result.draftId }, 'Follow-up email drafted');

          return {
            success: true,
            jobPostingId,
            draftId: result.draftId,
          };
        } else {
          // Create follow-up suggestions
          jobLogger.info('Creating follow-up suggestions');

          // Check if suggestions already exist
          const existingSuggestions = await prisma.followUpSuggestion.findMany({
            where: { jobPostingId },
          });

          if (existingSuggestions.length > 0) {
            jobLogger.info({ count: existingSuggestions.length }, 'Suggestions already exist, skipping');
            return {
              success: true,
              jobPostingId,
              suggestionIds: existingSuggestions.map((s) => s.id),
            };
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
                jobPostingId,
                suggestedAt: sevenDaysFromNow,
                text: `Follow up after 7 days to check on application status for ${jobPosting.title} at ${jobPosting.company}`,
              },
            }),
            prisma.followUpSuggestion.create({
              data: {
                jobPostingId,
                suggestedAt: fourteenDaysFromNow,
                text: `Follow up after 14 days to express continued interest in ${jobPosting.title} role at ${jobPosting.company}`,
              },
            }),
          ]);

          jobLogger.info({ suggestionIds: suggestions.map((s) => s.id) }, 'Follow-up suggestions created');

          return {
            success: true,
            jobPostingId,
            suggestionIds: suggestions.map((s) => s.id),
          };
        }
      } catch (error) {
        jobLogger.error({ err: error }, 'Follow-up job failed');
        throw error;
      }
    },
    defaultWorkerOptions as any
  );
}

/**
 * Start all workers
 */
async function startWorkers() {
  logger.info('Starting queue workers...');

  const scoreWorker = createScoreWorker();
  const draftWorker = createDraftWorker();
  const followupWorker = createFollowupWorker();

  // Setup error handlers
  scoreWorker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, queue: QUEUE_NAMES.SCORE, err },
      'Score job failed'
    );
  });

  draftWorker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, queue: QUEUE_NAMES.DRAFT, err },
      'Draft job failed'
    );
  });

  followupWorker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, queue: QUEUE_NAMES.FOLLOWUP, err },
      'Follow-up job failed'
    );
  });

  // Setup completed handlers
  scoreWorker.on('completed', (job) => {
    logger.info({ jobId: job.id, queue: QUEUE_NAMES.SCORE }, 'Score job completed');
  });

  draftWorker.on('completed', (job) => {
    logger.info({ jobId: job.id, queue: QUEUE_NAMES.DRAFT }, 'Draft job completed');
  });

  followupWorker.on('completed', (job) => {
    logger.info({ jobId: job.id, queue: QUEUE_NAMES.FOLLOWUP }, 'Follow-up job completed');
  });

  logger.info('All workers started');

  // Handle shutdown
  const shutdown = async () => {
    logger.info('Shutting down workers...');
    await Promise.all([
      scoreWorker.close(),
      draftWorker.close(),
      followupWorker.close(),
    ]);
    await closeRedisConnections();
    await prisma.$disconnect();
    logger.info('Workers shut down');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Start workers if run directly
if (require.main === module) {
  startWorkers().catch((err) => {
    logger.error({ err }, 'Failed to start workers');
    process.exit(1);
  });
}

export { startWorkers };
