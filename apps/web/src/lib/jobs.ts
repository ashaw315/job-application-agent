import { PrismaClient, JobPosting, JobSource } from '@prisma/client';

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
 * Full job posting with relations
 */
export interface JobPostingDetail extends JobPosting {
  jobSource: JobSource;
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
    },
  });

  return job;
}
