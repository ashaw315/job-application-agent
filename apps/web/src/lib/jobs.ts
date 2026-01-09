import {
  PrismaClient,
  JobPosting,
  JobSource,
  FitScore,
  MaterialPacket,
  MaterialVersion,
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Job posting list item for display
 */
export interface JobPostingListItem {
  id: string;
  title: string;
  company: string;
  status: string;
  location: string | null;
  createdAt: Date;
}

/**
 * Material packet with versions
 */
export interface MaterialPacketWithVersions extends MaterialPacket {
  versions: MaterialVersion[];
}

/**
 * Full job posting with relations
 */
export interface JobPostingDetail extends JobPosting {
  jobSource: JobSource;
  fitScore: FitScore | null;
  materialPackets: MaterialPacketWithVersions[];
}

/**
 * Get all job postings for list view
 * Sorted by createdAt descending (newest first)
 */
export async function getJobPostings(): Promise<JobPostingListItem[]> {
  const jobs = await prisma.jobPosting.findMany({
    select: {
      id: true,
      title: true,
      company: true,
      status: true,
      location: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return jobs;
}

/**
 * Get a single job posting by ID with all details
 * Returns null if not found
 */
export async function getJobPostingById(
  id: string
): Promise<JobPostingDetail | null> {
  const job = await prisma.jobPosting.findUnique({
    where: { id },
    include: {
      jobSource: true,
      fitScore: true,
      materialPackets: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1, // Get the most recent material packet
        include: {
          versions: {
            orderBy: {
              version: 'desc',
            },
          },
        },
      },
    },
  });

  return job;
}
