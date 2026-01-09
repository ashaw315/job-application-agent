import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface RunnerRunWithArtifacts {
  id: string;
  jobPostingId: string;
  status: string;
  errors: string[];
  warnings: string[];
  stoppedReason: string | null;
  appliedAt: Date | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  artifacts: {
    id: string;
    artifactType: string;
    filePath: string | null;
    content: string | null;
    description: string | null;
    createdAt: Date;
  }[];
}

/**
 * Get all runner runs for a job posting, ordered by newest first
 * Includes all artifacts for each run
 */
export async function getRunnerRunsForJob(
  jobPostingId: string
): Promise<RunnerRunWithArtifacts[]> {
  const runs = await prisma.runnerRun.findMany({
    where: {
      jobPostingId,
    },
    include: {
      artifacts: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
    orderBy: {
      startedAt: 'desc',
    },
  });

  // Parse JSON fields
  return runs.map((run) => ({
    id: run.id,
    jobPostingId: run.jobPostingId,
    status: run.status,
    errors: JSON.parse(run.errors) as string[],
    warnings: JSON.parse(run.warnings) as string[],
    stoppedReason: run.stoppedReason,
    appliedAt: run.appliedAt,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    createdAt: run.createdAt,
    artifacts: run.artifacts.map((artifact) => ({
      id: artifact.id,
      artifactType: artifact.artifactType,
      filePath: artifact.filePath,
      content: artifact.content,
      description: artifact.description,
      createdAt: artifact.createdAt,
    })),
  }));
}
