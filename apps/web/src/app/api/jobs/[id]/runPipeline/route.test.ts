import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { POST } from './route';
import { NextRequest } from 'next/server';

const prisma = new PrismaClient();

afterAll(async () => {
  // Clean up test database
  await prisma.materialVersion.deleteMany();
  await prisma.materialPacket.deleteMany();
  await prisma.fitScore.deleteMany();
  await prisma.statusEvent.deleteMany();
  await prisma.jobPosting.deleteMany();
  await prisma.jobSource.deleteMany();
  await prisma.$disconnect();
});

describe('POST /api/jobs/:id/runPipeline', () => {
  it('creates FitScore if missing, creates materials, and sets status to in_review', async () => {
    // Create a test job posting without FitScore
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-pipeline-job-1',
        title: 'Software Engineer',
        company: 'Test Corp',
        location: 'Remote',
        description: 'A great opportunity',
        status: 'new',
        jobSourceId: jobSource.id,
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/jobs/${jobPosting.id}/runPipeline`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, { params: { id: jobPosting.id } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.jobId).toBe(jobPosting.id);

    // Verify FitScore was created
    const fitScore = await prisma.fitScore.findUnique({
      where: { jobPostingId: jobPosting.id },
    });
    expect(fitScore).toBeDefined();
    expect(fitScore?.score).toBeGreaterThanOrEqual(0);
    expect(fitScore?.score).toBeLessThanOrEqual(100);
    expect(fitScore?.reasoning).toBeTruthy();

    // Verify MaterialPacket was created
    const packet = await prisma.materialPacket.findFirst({
      where: { jobPostingId: jobPosting.id },
      include: { versions: true },
    });
    expect(packet).toBeDefined();
    expect(packet?.resumeVariantText).toBe('TODO');
    // Cover letter text is now either generated or a placeholder message
    expect(packet?.coverLetterText).toBeTruthy();

    // Verify MaterialVersions were created (2 versions: cover_letter and resume_variant)
    expect(packet?.versions).toHaveLength(2);

    const coverLetterVersion = packet?.versions.find((v) => v.type === 'cover_letter');
    const resumeVersion = packet?.versions.find((v) => v.type === 'resume_variant');

    expect(coverLetterVersion).toBeDefined();
    expect(coverLetterVersion?.stage).toBe('generated');
    // Content is now JSON - check it's a valid JSON object
    const coverLetterContent = JSON.parse(coverLetterVersion!.content);
    expect(coverLetterContent.text).toBeTruthy();
    expect(coverLetterVersion?.version).toBe(1);

    expect(resumeVersion).toBeDefined();
    expect(resumeVersion?.stage).toBe('generated');
    // Resume is still placeholder JSON
    const resumeContent = JSON.parse(resumeVersion!.content);
    expect(resumeContent.text).toBeTruthy();
    expect(resumeVersion?.version).toBe(2);

    // Verify job status was updated to in_review
    const updatedJob = await prisma.jobPosting.findUnique({
      where: { id: jobPosting.id },
    });
    expect(updatedJob?.status).toBe('in_review');

    // Verify StatusEvent was created
    const statusEvents = await prisma.statusEvent.findMany({
      where: { jobPostingId: jobPosting.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(statusEvents.length).toBeGreaterThan(0);
    const lastEvent = statusEvents[statusEvents.length - 1];
    expect(lastEvent.toStatus).toBe('in_review');
  });

  it('reuses existing FitScore if already exists', async () => {
    // Create a test job posting with existing FitScore
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-2',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-pipeline-job-2',
        title: 'Backend Engineer',
        company: 'Test Corp 2',
        location: 'San Francisco',
        description: 'Another great opportunity',
        status: 'new',
        jobSourceId: jobSource.id,
      },
    });

    // Create existing FitScore
    const existingFitScore = await prisma.fitScore.create({
      data: {
        jobPostingId: jobPosting.id,
        score: 95.5,
        reasoning: 'Perfect match for skills',
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/jobs/${jobPosting.id}/runPipeline`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, { params: { id: jobPosting.id } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify FitScore was NOT recreated (should be same)
    const fitScore = await prisma.fitScore.findUnique({
      where: { jobPostingId: jobPosting.id },
    });
    expect(fitScore?.id).toBe(existingFitScore.id);
    expect(fitScore?.score).toBe(95.5);
    expect(fitScore?.reasoning).toBe('Perfect match for skills');

    // Verify materials were still created
    const packet = await prisma.materialPacket.findFirst({
      where: { jobPostingId: jobPosting.id },
    });
    expect(packet).toBeDefined();

    // Verify status was updated
    const updatedJob = await prisma.jobPosting.findUnique({
      where: { id: jobPosting.id },
    });
    expect(updatedJob?.status).toBe('in_review');
  });

  it('returns 404 for non-existent job', async () => {
    const fakeJobId = '00000000-0000-0000-0000-000000000000';

    const request = new NextRequest(
      `http://localhost:3000/api/jobs/${fakeJobId}/runPipeline`,
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

  it('handles errors gracefully', async () => {
    // Test with invalid UUID
    const invalidId = 'invalid-uuid';

    const request = new NextRequest(
      `http://localhost:3000/api/jobs/${invalidId}/runPipeline`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, { params: { id: invalidId } });
    const data = await response.json();

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });
});
