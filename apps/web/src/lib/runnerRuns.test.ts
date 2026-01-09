import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getRunnerRunsForJob } from './runnerRuns';

const prisma = new PrismaClient();

afterAll(async () => {
  // Clean up test data
  await prisma.runnerArtifact.deleteMany();
  await prisma.runnerRun.deleteMany();
  await prisma.materialVersion.deleteMany();
  await prisma.materialPacket.deleteMany();
  await prisma.fitScore.deleteMany();
  await prisma.jobPosting.deleteMany();
  await prisma.jobSource.deleteMany();
  await prisma.$disconnect();
});

describe('getRunnerRunsForJob', () => {
  it('returns empty array when job has no runner runs', async () => {
    // Create job without runs
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-1',
        atsType: 'greenhouse',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-no-runs-1',
        title: 'Software Engineer',
        company: 'Test Corp',
        description: 'Test job',
        status: 'approved',
        jobSourceId: jobSource.id,
      },
    });

    const runs = await getRunnerRunsForJob(jobPosting.id);

    expect(runs).toEqual([]);
  });

  it('returns runner runs with artifacts ordered by newest first', async () => {
    // Create job
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-2',
        atsType: 'greenhouse',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-with-runs-1',
        title: 'Backend Engineer',
        company: 'Test Corp 2',
        description: 'Test job 2',
        status: 'applied',
        jobSourceId: jobSource.id,
      },
    });

    // Create first run (older)
    const run1 = await prisma.runnerRun.create({
      data: {
        jobPostingId: jobPosting.id,
        status: 'stopped_before_submit',
        errors: JSON.stringify([]),
        warnings: JSON.stringify(['Some warning']),
        stoppedReason: 'Stopped before submission',
        startedAt: new Date('2024-01-01T10:00:00Z'),
        completedAt: new Date('2024-01-01T10:05:00Z'),
      },
    });

    await prisma.runnerArtifact.create({
      data: {
        runnerRunId: run1.id,
        artifactType: 'screenshot',
        filePath: '/artifacts/screenshot-1.png',
        description: 'Initial page',
      },
    });

    // Create second run (newer)
    const run2 = await prisma.runnerRun.create({
      data: {
        jobPostingId: jobPosting.id,
        status: 'success',
        errors: JSON.stringify([]),
        warnings: JSON.stringify([]),
        appliedAt: new Date('2024-01-02T15:30:00Z'),
        startedAt: new Date('2024-01-02T15:00:00Z'),
        completedAt: new Date('2024-01-02T15:35:00Z'),
      },
    });

    await prisma.runnerArtifact.createMany({
      data: [
        {
          runnerRunId: run2.id,
          artifactType: 'screenshot',
          filePath: '/artifacts/screenshot-2.png',
          description: 'Form filled',
        },
        {
          runnerRunId: run2.id,
          artifactType: 'html',
          filePath: '/artifacts/page-2.html',
          description: 'Page HTML',
        },
      ],
    });

    const runs = await getRunnerRunsForJob(jobPosting.id);

    // Should return newest first
    expect(runs.length).toBe(2);
    expect(runs[0].id).toBe(run2.id);
    expect(runs[0].status).toBe('success');
    expect(runs[0].artifacts.length).toBe(2);
    expect(runs[0].artifacts[0].artifactType).toBe('screenshot');
    expect(runs[0].artifacts[0].description).toBe('Form filled');

    expect(runs[1].id).toBe(run1.id);
    expect(runs[1].status).toBe('stopped_before_submit');
    expect(runs[1].artifacts.length).toBe(1);

    // Verify parsed errors/warnings
    expect(runs[0].errors).toEqual([]);
    expect(runs[0].warnings).toEqual([]);
    expect(runs[1].errors).toEqual([]);
    expect(runs[1].warnings).toEqual(['Some warning']);
  });

  it('handles runs with errors correctly', async () => {
    // Create job
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-3',
        atsType: 'greenhouse',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-with-errors-1',
        title: 'Frontend Engineer',
        company: 'Test Corp 3',
        description: 'Test job 3',
        status: 'needs_attention',
        jobSourceId: jobSource.id,
      },
    });

    // Create failed run
    const run = await prisma.runnerRun.create({
      data: {
        jobPostingId: jobPosting.id,
        status: 'critical_error',
        errors: JSON.stringify(['Resume upload failed', 'Form not found']),
        warnings: JSON.stringify(['Field was missing']),
        stoppedReason: 'Critical error during form filling',
        startedAt: new Date('2024-01-03T12:00:00Z'),
        completedAt: new Date('2024-01-03T12:02:00Z'),
      },
    });

    await prisma.runnerArtifact.createMany({
      data: [
        {
          runnerRunId: run.id,
          artifactType: 'screenshot',
          filePath: '/artifacts/error-screenshot.png',
          description: 'Error state',
        },
        {
          runnerRunId: run.id,
          artifactType: 'json',
          filePath: '/artifacts/trace.zip',
          description: 'Playwright trace',
        },
      ],
    });

    const runs = await getRunnerRunsForJob(jobPosting.id);

    expect(runs.length).toBe(1);
    expect(runs[0].status).toBe('critical_error');
    expect(runs[0].errors).toEqual(['Resume upload failed', 'Form not found']);
    expect(runs[0].warnings).toEqual(['Field was missing']);
    expect(runs[0].stoppedReason).toBe('Critical error during form filling');
    expect(runs[0].artifacts.length).toBe(2);
  });

  it('returns empty array for non-existent job', async () => {
    const runs = await getRunnerRunsForJob('00000000-0000-0000-0000-000000000000');
    expect(runs).toEqual([]);
  });
});
