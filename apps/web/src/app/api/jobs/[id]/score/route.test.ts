import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { POST } from './route';
import { NextRequest } from 'next/server';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Seed KB bullets for testing (check if they exist first)
  const existingBullets = await prisma.kbBullet.findMany({
    where: {
      id: { in: ['kb-score-1', 'kb-score-2', 'kb-score-3'] },
    },
  });

  if (existingBullets.length === 0) {
    await prisma.kbBullet.createMany({
      data: [
        {
          id: 'kb-score-1',
          text: 'Built scalable web applications with TypeScript and React',
          tags: JSON.stringify(['typescript', 'react', 'web']),
        },
        {
          id: 'kb-score-2',
          text: 'Deployed microservices using Docker and Kubernetes on AWS',
          tags: JSON.stringify(['docker', 'kubernetes', 'aws', 'devops']),
        },
        {
          id: 'kb-score-3',
          text: 'Developed REST APIs with Node.js and PostgreSQL',
          tags: JSON.stringify(['nodejs', 'postgresql', 'backend']),
        },
      ],
    });
  }
});

afterAll(async () => {
  // Clean up only test-specific data
  // Delete FitScores for test jobs
  const testJobs = await prisma.jobPosting.findMany({
    where: {
      dedupeKey: {
        startsWith: 'test-score-',
      },
    },
  });

  for (const job of testJobs) {
    await prisma.fitScore.deleteMany({
      where: { jobPostingId: job.id },
    });
    await prisma.statusEvent.deleteMany({
      where: { jobPostingId: job.id },
    });
  }

  await prisma.jobPosting.deleteMany({
    where: {
      dedupeKey: {
        startsWith: 'test-score-',
      },
    },
  });

  await prisma.jobSource.deleteMany({
    where: {
      url: {
        startsWith: 'https://example.com/jobs/test-score',
      },
    },
  });

  await prisma.$disconnect();
});

describe('POST /api/jobs/:id/score', () => {
  it('computes and saves FitScore for a job', async () => {
    // Create a test job posting
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-score-1',
        atsType: 'manual',
      },
    });

    expect(jobSource.id).toBeTruthy();

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-score-job-1',
        title: 'Senior Fullstack Engineer',
        company: 'Tech Corp',
        location: 'Remote',
        description:
          'We are looking for a Senior Fullstack Engineer with strong TypeScript, React, and Node.js skills. Experience with AWS and Docker required.',
        status: 'new',
        jobSourceId: jobSource.id,
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/jobs/${jobPosting.id}/score`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, { params: { id: jobPosting.id } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.fitScoreId).toBeDefined();
    expect(data.score).toBeGreaterThan(0);
    expect(data.score).toBeLessThanOrEqual(100);

    // Verify FitScore was saved
    const fitScore = await prisma.fitScore.findUnique({
      where: { jobPostingId: jobPosting.id },
    });

    expect(fitScore).toBeDefined();
    expect(fitScore?.score).toBe(data.score);
    expect(fitScore?.reasoning).toBeTruthy();

    // Verify reasoning contains breakdown and bullets
    const reasoning = JSON.parse(fitScore!.reasoning);
    expect(reasoning.reasoning).toBeTruthy();
    expect(reasoning.breakdown).toBeDefined();
    expect(reasoning.bullets).toBeInstanceOf(Array);
  });

  it('transitions job status to scored and creates StatusEvent', async () => {
    // Create a test job posting
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-score-2',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-score-job-2',
        title: 'Backend Engineer',
        company: 'Startup Inc',
        location: 'San Francisco',
        description: 'Backend engineer with Node.js and PostgreSQL experience',
        status: 'new',
        jobSourceId: jobSource.id,
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/jobs/${jobPosting.id}/score`,
      {
        method: 'POST',
      }
    );

    await POST(request, { params: { id: jobPosting.id } });

    // Verify status was updated
    const updatedJob = await prisma.jobPosting.findUnique({
      where: { id: jobPosting.id },
    });

    expect(updatedJob?.status).toBe('scored');

    // Verify StatusEvent was created
    const statusEvent = await prisma.statusEvent.findFirst({
      where: {
        jobPostingId: jobPosting.id,
        toStatus: 'scored',
      },
    });

    expect(statusEvent).toBeDefined();
    expect(statusEvent?.fromStatus).toBe('new');
    expect(statusEvent?.toStatus).toBe('scored');
    expect(statusEvent?.notes).toContain('Computed fit score');
  });

  it('upserts FitScore when called multiple times', async () => {
    // Create a test job posting
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-score-3',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-score-job-3',
        title: 'DevOps Engineer',
        company: 'Cloud Corp',
        description: 'DevOps with Docker and Kubernetes',
        status: 'new',
        jobSourceId: jobSource.id,
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/jobs/${jobPosting.id}/score`,
      {
        method: 'POST',
      }
    );

    // Call first time
    const response1 = await POST(request, { params: { id: jobPosting.id } });
    const data1 = await response1.json();

    // Call second time
    const response2 = await POST(request, { params: { id: jobPosting.id } });
    const data2 = await response2.json();

    expect(response2.status).toBe(200);
    expect(data2.fitScoreId).toBe(data1.fitScoreId); // Same FitScore record

    // Verify only one FitScore exists
    const fitScores = await prisma.fitScore.findMany({
      where: { jobPostingId: jobPosting.id },
    });

    expect(fitScores).toHaveLength(1);
  });

  it('does not change status if already scored or higher', async () => {
    // Create a test job posting already in "in_review" status
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-score-4',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-score-job-4',
        title: 'Frontend Engineer',
        company: 'Web Corp',
        description: 'Frontend with React and TypeScript',
        status: 'in_review',
        jobSourceId: jobSource.id,
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/jobs/${jobPosting.id}/score`,
      {
        method: 'POST',
      }
    );

    await POST(request, { params: { id: jobPosting.id } });

    // Verify status was NOT changed
    const updatedJob = await prisma.jobPosting.findUnique({
      where: { id: jobPosting.id },
    });

    expect(updatedJob?.status).toBe('in_review'); // Should remain in_review
  });

  it('returns 404 for non-existent job', async () => {
    const fakeJobId = '00000000-0000-0000-0000-000000000000';

    const request = new NextRequest(
      `http://localhost:3000/api/jobs/${fakeJobId}/score`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, { params: { id: fakeJobId } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Job not found');
  });

  it('computes reasonable scores based on keyword matches', async () => {
    // Create a high-match job
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-score-high',
        atsType: 'manual',
      },
    });

    const highMatchJob = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'high-match-job',
        title: 'Senior Fullstack Engineer',
        company: 'Tech Corp',
        location: 'Remote',
        description:
          'We need a Senior Fullstack Engineer with TypeScript, React, Node.js, PostgreSQL, Docker, Kubernetes, and AWS experience.',
        status: 'new',
        jobSourceId: jobSource.id,
      },
    });

    // Create a low-match job
    const jobSource2 = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-score-low',
        atsType: 'manual',
      },
    });

    const lowMatchJob = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'low-match-job',
        title: 'QA Engineer',
        company: 'Test Corp',
        description: 'Manual testing and quality assurance',
        status: 'new',
        jobSourceId: jobSource2.id,
      },
    });

    const highMatchRequest = new NextRequest(
      `http://localhost:3000/api/jobs/${highMatchJob.id}/score`,
      { method: 'POST' }
    );

    const lowMatchRequest = new NextRequest(
      `http://localhost:3000/api/jobs/${lowMatchJob.id}/score`,
      { method: 'POST' }
    );

    const highMatchResponse = await POST(highMatchRequest, {
      params: { id: highMatchJob.id },
    });
    const lowMatchResponse = await POST(lowMatchRequest, {
      params: { id: lowMatchJob.id },
    });

    const highMatchData = await highMatchResponse.json();
    const lowMatchData = await lowMatchResponse.json();

    // High-match job should have significantly higher score
    expect(highMatchData.score).toBeGreaterThan(lowMatchData.score);
    expect(highMatchData.score).toBeGreaterThan(50); // Should be reasonably high
  });
});
