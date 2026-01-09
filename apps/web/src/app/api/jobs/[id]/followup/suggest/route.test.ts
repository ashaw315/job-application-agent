import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { POST } from './route';
import { NextRequest } from 'next/server';

const prisma = new PrismaClient();

afterAll(async () => {
  // Clean up test data
  await prisma.followUpEmailDraft.deleteMany();
  await prisma.followUpSuggestion.deleteMany();
  await prisma.statusEvent.deleteMany();
  await prisma.fitScore.deleteMany();
  await prisma.jobPosting.deleteMany();
  await prisma.jobSource.deleteMany();
  await prisma.$disconnect();
});

describe('POST /api/jobs/:id/followup/suggest', () => {
  it('returns 404 when job posting does not exist', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/jobs/00000000-0000-0000-0000-000000000000/followup/suggest',
      {
        method: 'POST',
      }
    );

    const response = await POST(request, {
      params: { id: '00000000-0000-0000-0000-000000000000' },
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Job posting not found');
  });

  it('creates follow-up suggestions at +7 and +14 days', async () => {
    // Create test job
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-1',
        atsType: 'greenhouse',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-followup-suggest-1',
        title: 'Software Engineer',
        company: 'Test Corp',
        description: 'Test job',
        status: 'applied',
        jobSourceId: jobSource.id,
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/jobs/${jobPosting.id}/followup/suggest`,
      {
        method: 'POST',
      }
    );

    const response = await POST(request, { params: { id: jobPosting.id } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.suggestionIds).toHaveLength(2);

    // Verify suggestions were created
    const suggestions = await prisma.followUpSuggestion.findMany({
      where: { jobPostingId: jobPosting.id },
      orderBy: { suggestedAt: 'asc' },
    });

    expect(suggestions).toHaveLength(2);

    // First suggestion should be ~7 days from now
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const diff1 = Math.abs(
      suggestions[0].suggestedAt.getTime() - sevenDaysFromNow.getTime()
    );
    expect(diff1).toBeLessThan(1000); // Within 1 second

    // Second suggestion should be ~14 days from now
    const fourteenDaysFromNow = new Date(now);
    fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

    const diff2 = Math.abs(
      suggestions[1].suggestedAt.getTime() - fourteenDaysFromNow.getTime()
    );
    expect(diff2).toBeLessThan(1000); // Within 1 second

    expect(suggestions[0].text).toContain('7 days');
    expect(suggestions[1].text).toContain('14 days');
  });

  it('does not create duplicate suggestions if called multiple times', async () => {
    // Create test job
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-2',
        atsType: 'greenhouse',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-followup-suggest-2',
        title: 'Backend Engineer',
        company: 'Test Corp 2',
        description: 'Test job 2',
        status: 'applied',
        jobSourceId: jobSource.id,
      },
    });

    const request1 = new NextRequest(
      `http://localhost:3000/api/jobs/${jobPosting.id}/followup/suggest`,
      {
        method: 'POST',
      }
    );

    // First call
    const response1 = await POST(request1, { params: { id: jobPosting.id } });
    const data1 = await response1.json();

    expect(response1.status).toBe(200);
    expect(data1.success).toBe(true);

    // Second call - should still succeed but not create duplicates
    const request2 = new NextRequest(
      `http://localhost:3000/api/jobs/${jobPosting.id}/followup/suggest`,
      {
        method: 'POST',
      }
    );

    const response2 = await POST(request2, { params: { id: jobPosting.id } });
    const data2 = await response2.json();

    expect(response2.status).toBe(200);
    expect(data2.success).toBe(true);

    // Should still only have 2 suggestions total
    const suggestions = await prisma.followUpSuggestion.findMany({
      where: { jobPostingId: jobPosting.id },
    });

    expect(suggestions).toHaveLength(2);
  });
});
