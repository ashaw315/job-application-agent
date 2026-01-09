import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { POST } from './route';
import { NextRequest } from 'next/server';
import type { RunnerReport } from '@job-application-agent/shared';

const prisma = new PrismaClient();

const RUNNER_API_KEY = 'test-runner-api-key';

beforeEach(() => {
  process.env.RUNNER_API_KEY = RUNNER_API_KEY;
});

afterAll(async () => {
  // Clean up test data
  await prisma.runnerArtifact.deleteMany();
  await prisma.runnerRun.deleteMany();
  await prisma.statusEvent.deleteMany();
  await prisma.materialVersion.deleteMany();
  await prisma.materialPacket.deleteMany();
  await prisma.fitScore.deleteMany();
  await prisma.jobPosting.deleteMany();
  await prisma.jobSource.deleteMany();
  await prisma.$disconnect();
});

describe('POST /api/runner/runs', () => {
  it('returns 401 when no authorization header is provided', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/runner/runs',
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Authorization header required');
  });

  it('returns 401 when invalid bearer token is provided', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/runner/runs',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer wrong-token',
        },
        body: JSON.stringify({}),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid authorization token');
  });

  it('returns 400 when request body fails RunnerReport schema validation', async () => {
    const invalidReport = {
      jobPostingId: 'job-123',
      // Missing required status field
      errors: [],
      warnings: [],
      artifacts: [],
    };

    const request = new NextRequest(
      'http://localhost:3000/api/runner/runs',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RUNNER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidReport),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid report');
  });

  it('returns 404 when job posting does not exist', async () => {
    const validReport: RunnerReport = {
      jobPostingId: '00000000-0000-0000-0000-000000000000',
      status: 'success',
      errors: [],
      warnings: [],
      artifacts: [],
    };

    const request = new NextRequest(
      'http://localhost:3000/api/runner/runs',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RUNNER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validReport),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Job posting not found');
  });

  it('creates RunnerRun record and updates job status to applied on success', async () => {
    // Create test job
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-1',
        atsType: 'greenhouse',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-runner-success-1',
        title: 'Software Engineer',
        company: 'Test Corp',
        description: 'Test job',
        status: 'approved',
        applyUrl: 'https://example.com/apply/1',
        jobSourceId: jobSource.id,
      },
    });

    const successReport: RunnerReport = {
      jobPostingId: jobPosting.id,
      status: 'success',
      errors: [],
      warnings: ['Minor warning about something'],
      artifacts: [
        {
          type: 'screenshot',
          filePath: '/artifacts/screenshot-1.png',
          description: 'Initial page',
        },
        {
          type: 'html',
          filePath: '/artifacts/page-1.html',
          description: 'Page HTML',
        },
      ],
      appliedAt: new Date().toISOString(),
    };

    const request = new NextRequest(
      'http://localhost:3000/api/runner/runs',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RUNNER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(successReport),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.runId).toBeDefined();

    // Verify RunnerRun was created
    const runnerRun = await prisma.runnerRun.findUnique({
      where: { id: data.runId },
      include: { artifacts: true },
    });

    expect(runnerRun).toBeDefined();
    expect(runnerRun!.jobPostingId).toBe(jobPosting.id);
    expect(runnerRun!.status).toBe('success');
    expect(JSON.parse(runnerRun!.errors)).toEqual([]);
    expect(JSON.parse(runnerRun!.warnings)).toEqual(['Minor warning about something']);
    expect(runnerRun!.completedAt).toBeDefined();
    expect(runnerRun!.appliedAt).toBeDefined();

    // Verify artifacts were created
    expect(runnerRun!.artifacts.length).toBe(2);
    expect(runnerRun!.artifacts[0].artifactType).toBe('screenshot');
    expect(runnerRun!.artifacts[0].filePath).toBe('/artifacts/screenshot-1.png');
    expect(runnerRun!.artifacts[0].description).toBe('Initial page');

    // Verify job status was updated to applied
    const updatedJob = await prisma.jobPosting.findUnique({
      where: { id: jobPosting.id },
    });
    expect(updatedJob!.status).toBe('applied');

    // Verify StatusEvent was created with actor="runner"
    const statusEvents = await prisma.statusEvent.findMany({
      where: { jobPostingId: jobPosting.id },
    });
    expect(statusEvents.length).toBe(1);
    expect(statusEvents[0].fromStatus).toBe('approved');
    expect(statusEvents[0].toStatus).toBe('applied');
    expect(statusEvents[0].actor).toBe('runner');
    expect(statusEvents[0].notes).toContain('Runner completed successfully');
  });

  it('creates RunnerRun record and updates job status to needs_attention on failure', async () => {
    // Create test job
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-2',
        atsType: 'greenhouse',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-runner-failure-1',
        title: 'Backend Engineer',
        company: 'Test Corp 2',
        description: 'Test job 2',
        status: 'approved',
        applyUrl: 'https://example.com/apply/2',
        jobSourceId: jobSource.id,
      },
    });

    const failureReport: RunnerReport = {
      jobPostingId: jobPosting.id,
      status: 'critical_error',
      errors: ['Failed to upload resume', 'Form submission failed'],
      warnings: ['Some field was missing'],
      artifacts: [
        {
          type: 'screenshot',
          filePath: '/artifacts/error-screenshot.png',
          description: 'Error state',
        },
      ],
      stoppedReason: 'Critical error occurred during form filling',
    };

    const request = new NextRequest(
      'http://localhost:3000/api/runner/runs',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RUNNER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(failureReport),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.runId).toBeDefined();

    // Verify RunnerRun was created with error details
    const runnerRun = await prisma.runnerRun.findUnique({
      where: { id: data.runId },
      include: { artifacts: true },
    });

    expect(runnerRun).toBeDefined();
    expect(runnerRun!.status).toBe('critical_error');
    expect(JSON.parse(runnerRun!.errors)).toEqual([
      'Failed to upload resume',
      'Form submission failed',
    ]);
    expect(JSON.parse(runnerRun!.warnings)).toEqual(['Some field was missing']);
    expect(runnerRun!.stoppedReason).toBe('Critical error occurred during form filling');
    expect(runnerRun!.completedAt).toBeDefined();

    // Verify job status was updated to needs_attention
    const updatedJob = await prisma.jobPosting.findUnique({
      where: { id: jobPosting.id },
    });
    expect(updatedJob!.status).toBe('needs_attention');

    // Verify StatusEvent was created with error details
    const statusEvents = await prisma.statusEvent.findMany({
      where: { jobPostingId: jobPosting.id },
    });
    expect(statusEvents.length).toBe(1);
    expect(statusEvents[0].fromStatus).toBe('approved');
    expect(statusEvents[0].toStatus).toBe('needs_attention');
    expect(statusEvents[0].actor).toBe('runner');
    expect(statusEvents[0].notes).toContain('Runner failed');
    expect(statusEvents[0].notes).toContain('Failed to upload resume');
  });

  it('handles stopped_before_submit status correctly', async () => {
    // Create test job
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-3',
        atsType: 'greenhouse',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-runner-stopped-1',
        title: 'Frontend Engineer',
        company: 'Test Corp 3',
        description: 'Test job 3',
        status: 'approved',
        applyUrl: 'https://example.com/apply/3',
        jobSourceId: jobSource.id,
      },
    });

    const stoppedReport: RunnerReport = {
      jobPostingId: jobPosting.id,
      status: 'stopped_before_submit',
      errors: [],
      warnings: [],
      artifacts: [
        {
          type: 'screenshot',
          filePath: '/artifacts/before-stop.png',
          description: 'Before stopping',
        },
      ],
      stoppedReason: 'Stopped before submission as intended (v0 safety)',
    };

    const request = new NextRequest(
      'http://localhost:3000/api/runner/runs',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RUNNER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stoppedReport),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // For stopped_before_submit, job should remain approved (not move to applied)
    const updatedJob = await prisma.jobPosting.findUnique({
      where: { id: jobPosting.id },
    });
    expect(updatedJob!.status).toBe('approved');

    // StatusEvent should still be created noting the run
    const statusEvents = await prisma.statusEvent.findMany({
      where: { jobPostingId: jobPosting.id },
    });
    expect(statusEvents.length).toBe(1);
    expect(statusEvents[0].fromStatus).toBe('approved');
    expect(statusEvents[0].toStatus).toBe('approved'); // Status unchanged
    expect(statusEvents[0].actor).toBe('runner');
    expect(statusEvents[0].notes).toContain('Runner stopped before submission');
  });
});
