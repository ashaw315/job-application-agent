import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getJobPostings, getJobPostingById } from './jobs';

const prisma = new PrismaClient();

describe('Job data access functions', () => {
  let testJobId: string;
  let testSourceId: string;

  beforeAll(async () => {
    // Create test data
    const source = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/test-job',
        atsType: 'generic',
      },
    });
    testSourceId = source.id;

    const job = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-job-listing-unique',
        title: 'Test Engineer',
        company: 'Test Company',
        location: 'Test City',
        salaryMin: 100000,
        salaryMax: 150000,
        description: 'This is a test job description.',
        status: 'new',
        jobSourceId: source.id,
      },
    });
    testJobId = job.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.jobPosting.deleteMany({
      where: { dedupeKey: 'test-job-listing-unique' },
    });
    await prisma.jobSource.deleteMany({
      where: { id: testSourceId },
    });
    await prisma.$disconnect();
  });

  describe('getJobPostings', () => {
    it('returns list of job postings with core fields', async () => {
      const jobs = await getJobPostings();

      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBeGreaterThan(0);

      const job = jobs.find((j) => j.id === testJobId);
      expect(job).toBeDefined();
      expect(job?.title).toBe('Test Engineer');
      expect(job?.company).toBe('Test Company');
      expect(job?.status).toBe('new');
      expect(job?.createdAt).toBeInstanceOf(Date);
    });

    it('returns jobs sorted by createdAt descending', async () => {
      const jobs = await getJobPostings();

      if (jobs.length > 1) {
        for (let i = 0; i < jobs.length - 1; i++) {
          const current = jobs[i].createdAt.getTime();
          const next = jobs[i + 1].createdAt.getTime();
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });
  });

  describe('getJobPostingById', () => {
    it('returns full job posting with all fields', async () => {
      const job = await getJobPostingById(testJobId);

      expect(job).not.toBeNull();
      expect(job?.id).toBe(testJobId);
      expect(job?.title).toBe('Test Engineer');
      expect(job?.company).toBe('Test Company');
      expect(job?.location).toBe('Test City');
      expect(job?.salaryMin).toBe(100000);
      expect(job?.salaryMax).toBe(150000);
      expect(job?.description).toBe('This is a test job description.');
      expect(job?.status).toBe('new');
      expect(job?.dedupeKey).toBe('test-job-listing-unique');
    });

    it('returns job with jobSource relation', async () => {
      const job = await getJobPostingById(testJobId);

      expect(job).not.toBeNull();
      expect(job?.jobSource).toBeDefined();
      expect(job?.jobSource.id).toBe(testSourceId);
      expect(job?.jobSource.url).toBe('https://example.com/test-job');
      expect(job?.jobSource.atsType).toBe('generic');
    });

    it('returns null for non-existent job ID', async () => {
      const job = await getJobPostingById('non-existent-id-12345');

      expect(job).toBeNull();
    });
  });
});
