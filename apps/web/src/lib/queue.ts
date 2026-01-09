import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get jobs for the approval queue
 * Returns jobs with status in_review or needs_attention, ordered by updatedAt desc
 */
export async function getQueueJobs() {
  return await prisma.jobPosting.findMany({
    where: {
      status: {
        in: ['in_review', 'needs_attention'],
      },
    },
    include: {
      jobSource: true,
      fitScore: true,
      materialPackets: {
        include: {
          versions: {
            orderBy: { version: 'desc' },
          },
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });
}
