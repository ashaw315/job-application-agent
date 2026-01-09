import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface FollowUpSuggestionWithDrafts {
  id: string;
  text: string;
  suggestedAt: Date;
  emailDrafts: {
    id: string;
    subject: string;
    body: string;
    createdAt: Date;
  }[];
}

/**
 * Get all follow-up suggestions for a job posting, with their email drafts
 */
export async function getFollowUpSuggestionsForJob(
  jobPostingId: string
): Promise<FollowUpSuggestionWithDrafts[]> {
  const suggestions = await prisma.followUpSuggestion.findMany({
    where: {
      jobPostingId,
    },
    include: {
      emailDrafts: {
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
    orderBy: {
      suggestedAt: 'asc',
    },
  });

  return suggestions.map((s) => ({
    id: s.id,
    text: s.text,
    suggestedAt: s.suggestedAt,
    emailDrafts: s.emailDrafts.map((d) => ({
      id: d.id,
      subject: d.subject,
      body: d.body,
      createdAt: d.createdAt,
    })),
  }));
}
