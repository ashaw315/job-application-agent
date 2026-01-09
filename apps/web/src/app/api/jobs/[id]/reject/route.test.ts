import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { POST } from './route';
import { NextRequest } from 'next/server';

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/jobs/:id/reject', () => {
  it('transitions job status to rejected and creates StatusEvent', async () => {
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-reject-1',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-reject-job-1',
        title: 'Software Engineer',
        company: 'Test Corp',
        description: 'Test job',
        status: 'in_review',
        jobSourceId: jobSource.id,
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/jobs/${jobPosting.id}/reject`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: { id: jobPosting.id } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.jobId).toBe(jobPosting.id);

    // Verify status was updated to rejected
    const updatedJob = await prisma.jobPosting.findUnique({
      where: { id: jobPosting.id },
    });
    expect(updatedJob?.status).toBe('rejected');

    // Verify StatusEvent was created
    const statusEvent = await prisma.statusEvent.findFirst({
      where: {
        jobPostingId: jobPosting.id,
        toStatus: 'rejected',
      },
    });

    expect(statusEvent).toBeDefined();
    expect(statusEvent?.fromStatus).toBe('in_review');
    expect(statusEvent?.notes).toContain('rejected');
  });

  it('can reject job from different statuses', async () => {
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-reject-2',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-reject-job-2',
        title: 'Backend Engineer',
        company: 'Test Corp 2',
        description: 'Test job 2',
        status: 'needs_attention',
        jobSourceId: jobSource.id,
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/jobs/${jobPosting.id}/reject`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: { id: jobPosting.id } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    const updatedJob = await prisma.jobPosting.findUnique({
      where: { id: jobPosting.id },
    });
    expect(updatedJob?.status).toBe('rejected');

    const statusEvent = await prisma.statusEvent.findFirst({
      where: {
        jobPostingId: jobPosting.id,
        toStatus: 'rejected',
      },
    });

    expect(statusEvent?.fromStatus).toBe('needs_attention');
  });

  it('returns 404 for non-existent job', async () => {
    const fakeJobId = '00000000-0000-0000-0000-000000000000';

    const request = new NextRequest(
      `http://localhost:3000/api/jobs/${fakeJobId}/reject`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: { id: fakeJobId } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Job not found');
  });
});
