import { describe, it, expect, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

describe('POST /api/jobs/ingest', () => {
  afterAll(async () => {
    // Cleanup: delete test data
    await prisma.jobPosting.deleteMany({
      where: {
        OR: [
          { company: { contains: 'Test' } },
          { company: { contains: 'Dedupe' } },
          { company: { contains: 'Punctuation' } },
          { company: { contains: 'Roman' } },
          { company: { contains: 'Location' } },
          { company: { startsWith: 'Company' } },
          { company: { contains: 'Title Test' } },
        ],
      },
    });
    await prisma.$disconnect();
  });

  it('creates JobPosting and JobSource from valid manual input', async () => {
    const requestBody = {
      sourceType: 'manual',
      manual: {
        companyName: 'Test Company',
        title: 'Software Engineer',
        location: 'Remote',
        description: 'We are looking for a software engineer to join our team.',
      },
    };

    const request = new NextRequest('http://localhost:3000/api/jobs/ingest', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.jobId).toBeDefined();

    // Verify job was created in database
    const job = await prisma.jobPosting.findUnique({
      where: { id: data.jobId },
      include: { jobSource: true },
    });

    expect(job).not.toBeNull();
    expect(job?.title).toBe('Software Engineer');
    expect(job?.company).toBe('Test Company');
    expect(job?.location).toBe('Remote');
    expect(job?.description).toBe('We are looking for a software engineer to join our team.');
    expect(job?.status).toBe('new');
    expect(job?.dedupeKey).toBeDefined();
    expect(job?.dedupeKey).toMatch(/^[a-f0-9]{64}$/); // SHA256 hash
    expect(job?.jobSource).toBeDefined();
  });

  it('normalizes whitespace in description', async () => {
    const requestBody = {
      sourceType: 'manual',
      manual: {
        companyName: 'Test Company 2',
        title: 'Backend Engineer',
        description: '  Multiple   spaces   and\n\n\nmultiple line breaks  ',
      },
    };

    const request = new NextRequest('http://localhost:3000/api/jobs/ingest', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);

    const job = await prisma.jobPosting.findUnique({
      where: { id: data.jobId },
    });

    expect(job?.description).toBe('Multiple spaces and\nmultiple line breaks');
  });

  it('handles missing optional location', async () => {
    const requestBody = {
      sourceType: 'manual',
      manual: {
        companyName: 'Test Company 3',
        title: 'Frontend Engineer',
        description: 'Great job description',
      },
    };

    const request = new NextRequest('http://localhost:3000/api/jobs/ingest', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);

    const job = await prisma.jobPosting.findUnique({
      where: { id: data.jobId },
    });

    expect(job?.location).toBeNull();
  });

  it('rejects missing companyName', async () => {
    const requestBody = {
      sourceType: 'manual',
      manual: {
        title: 'Software Engineer',
        description: 'Great job description',
      },
    };

    const request = new NextRequest('http://localhost:3000/api/jobs/ingest', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it('rejects missing title', async () => {
    const requestBody = {
      sourceType: 'manual',
      manual: {
        companyName: 'Test Company',
        description: 'Great job description',
      },
    };

    const request = new NextRequest('http://localhost:3000/api/jobs/ingest', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it('rejects missing description', async () => {
    const requestBody = {
      sourceType: 'manual',
      manual: {
        companyName: 'Test Company',
        title: 'Software Engineer',
      },
    };

    const request = new NextRequest('http://localhost:3000/api/jobs/ingest', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it('rejects invalid sourceType', async () => {
    const requestBody = {
      sourceType: 'automated',
      manual: {
        companyName: 'Test Company',
        title: 'Software Engineer',
        description: 'Great job description',
      },
    };

    const request = new NextRequest('http://localhost:3000/api/jobs/ingest', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it('rejects invalid JSON', async () => {
    const request = new NextRequest('http://localhost:3000/api/jobs/ingest', {
      method: 'POST',
      body: 'invalid json',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  describe('deduplication', () => {
    it('ingesting same job twice returns same posting id', async () => {
      const requestBody = {
        sourceType: 'manual',
        manual: {
          companyName: 'Dedupe Test Company',
          title: 'Principal Engineer',
          location: 'Seattle, WA',
          description: 'Original description',
        },
      };

      // First ingestion
      const request1 = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response1 = await POST(request1);
      const data1 = await response1.json();

      expect(response1.status).toBe(200);
      expect(data1.success).toBe(true);
      const firstJobId = data1.jobId;

      // Second ingestion with exact same data
      const request2 = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response2 = await POST(request2);
      const data2 = await response2.json();

      expect(response2.status).toBe(200);
      expect(data2.success).toBe(true);
      expect(data2.jobId).toBe(firstJobId);

      // Verify only one job was created
      const jobs = await prisma.jobPosting.findMany({
        where: {
          company: 'Dedupe Test Company',
          title: 'Principal Engineer',
        },
      });

      expect(jobs.length).toBe(1);
    });

    it('deduplicates when title has different punctuation', async () => {
      const requestBody1 = {
        sourceType: 'manual',
        manual: {
          companyName: 'Punctuation Test Corp',
          title: 'Senior Engineer',
          location: 'Boston, MA',
          description: 'First description',
        },
      };

      const request1 = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody1),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response1 = await POST(request1);
      const data1 = await response1.json();
      const firstJobId = data1.jobId;

      // Second ingestion with punctuation in title
      const requestBody2 = {
        sourceType: 'manual',
        manual: {
          companyName: 'Punctuation Test Corp',
          title: 'Senior, Engineer!',
          location: 'Boston, MA',
          description: 'Different description',
        },
      };

      const request2 = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody2),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response2 = await POST(request2);
      const data2 = await response2.json();

      expect(data2.jobId).toBe(firstJobId);
    });

    it('deduplicates when title has roman numerals', async () => {
      const requestBody1 = {
        sourceType: 'manual',
        manual: {
          companyName: 'Roman Numeral Corp',
          title: 'Engineer II',
          location: 'Austin, TX',
          description: 'First description',
        },
      };

      const request1 = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody1),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response1 = await POST(request1);
      const data1 = await response1.json();
      const firstJobId = data1.jobId;

      // Second ingestion with number instead of roman numeral
      const requestBody2 = {
        sourceType: 'manual',
        manual: {
          companyName: 'Roman Numeral Corp',
          title: 'Engineer 2',
          location: 'Austin, TX',
          description: 'Different description',
        },
      };

      const request2 = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody2),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response2 = await POST(request2);
      const data2 = await response2.json();

      expect(data2.jobId).toBe(firstJobId);
    });

    it('does NOT deduplicate with different location', async () => {
      const requestBody1 = {
        sourceType: 'manual',
        manual: {
          companyName: 'Location Test Corp',
          title: 'Staff Engineer',
          location: 'San Francisco, CA',
          description: 'First description',
        },
      };

      const request1 = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody1),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response1 = await POST(request1);
      const data1 = await response1.json();
      const firstJobId = data1.jobId;

      // Second ingestion with different location
      const requestBody2 = {
        sourceType: 'manual',
        manual: {
          companyName: 'Location Test Corp',
          title: 'Staff Engineer',
          location: 'New York, NY',
          description: 'Same description',
        },
      };

      const request2 = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody2),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response2 = await POST(request2);
      const data2 = await response2.json();

      expect(data2.jobId).not.toBe(firstJobId);

      // Verify two separate jobs were created
      const jobs = await prisma.jobPosting.findMany({
        where: {
          company: 'Location Test Corp',
          title: 'Staff Engineer',
        },
      });

      expect(jobs.length).toBe(2);
    });

    it('does NOT deduplicate with different company', async () => {
      const requestBody1 = {
        sourceType: 'manual',
        manual: {
          companyName: 'Company A',
          title: 'DevOps Engineer',
          location: 'Remote',
          description: 'First description',
        },
      };

      const request1 = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody1),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response1 = await POST(request1);
      const data1 = await response1.json();
      const firstJobId = data1.jobId;

      // Second ingestion with different company
      const requestBody2 = {
        sourceType: 'manual',
        manual: {
          companyName: 'Company B',
          title: 'DevOps Engineer',
          location: 'Remote',
          description: 'Same description',
        },
      };

      const request2 = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody2),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response2 = await POST(request2);
      const data2 = await response2.json();

      expect(data2.jobId).not.toBe(firstJobId);
    });

    it('does NOT deduplicate with different title', async () => {
      const requestBody1 = {
        sourceType: 'manual',
        manual: {
          companyName: 'Title Test Corp',
          title: 'Senior Engineer',
          location: 'Remote',
          description: 'First description',
        },
      };

      const request1 = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody1),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response1 = await POST(request1);
      const data1 = await response1.json();
      const firstJobId = data1.jobId;

      // Second ingestion with different title
      const requestBody2 = {
        sourceType: 'manual',
        manual: {
          companyName: 'Title Test Corp',
          title: 'Junior Engineer',
          location: 'Remote',
          description: 'Same description',
        },
      };

      const request2 = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody2),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response2 = await POST(request2);
      const data2 = await response2.json();

      expect(data2.jobId).not.toBe(firstJobId);
    });
  });

  describe('greenhouse ingestion', () => {
    it('ingests greenhouse job from URL with mocked fetch', async () => {
      // Read fixture HTML
      const fixtureHtml = readFileSync(
        join(process.cwd(), '../../packages/shared/test/fixtures/greenhouse/standard-job.html'),
        'utf-8'
      );

      // Mock global fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => fixtureHtml,
      } as Response);

      const requestBody = {
        sourceType: 'greenhouse',
        greenhouse: {
          url: 'https://boards.greenhouse.io/acmecorp/jobs/4567890',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.jobId).toBeDefined();

      // Verify job was created with correct data
      const job = await prisma.jobPosting.findUnique({
        where: { id: data.jobId },
        include: { jobSource: true },
      });

      expect(job).not.toBeNull();
      expect(job?.title).toBe('Senior Software Engineer');
      expect(job?.company).toBe('acmecorp');
      expect(job?.location).toBe('San Francisco, CA');
      expect(job?.status).toBe('new');
      expect(job?.dedupeKey).toBe('greenhouse:4567890');
      expect(job?.description).toContain('About the Role');
      expect(job?.description).not.toContain('<h3>'); // Should be text, not HTML
      expect(job?.jobSource?.url).toBe('https://boards.greenhouse.io/acmecorp/jobs/4567890');
      expect(job?.jobSource?.atsType).toBe('greenhouse');

      // Cleanup mock
      vi.restoreAllMocks();
    });

    it('deduplicates greenhouse jobs by sourceKey (job ID)', async () => {
      const fixtureHtml = readFileSync(
        join(process.cwd(), '../../packages/shared/test/fixtures/greenhouse/standard-job.html'),
        'utf-8'
      );

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => fixtureHtml,
      } as Response);

      const requestBody = {
        sourceType: 'greenhouse',
        greenhouse: {
          url: 'https://boards.greenhouse.io/testcompany/jobs/9999999',
        },
      };

      // First ingestion
      const request1 = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response1 = await POST(request1);
      const data1 = await response1.json();
      const firstJobId = data1.jobId;

      // Second ingestion with same greenhouse job ID
      const request2 = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response2 = await POST(request2);
      const data2 = await response2.json();

      expect(data2.jobId).toBe(firstJobId);

      // Verify only one job was created
      const jobs = await prisma.jobPosting.findMany({
        where: { dedupeKey: 'greenhouse:4567890' },
      });

      expect(jobs.length).toBeLessThanOrEqual(1);

      vi.restoreAllMocks();
    });

    it('handles greenhouse fetch errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const requestBody = {
        sourceType: 'greenhouse',
        greenhouse: {
          url: 'https://boards.greenhouse.io/company/jobs/123',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();

      vi.restoreAllMocks();
    });

    it('handles invalid greenhouse HTML', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html><body>Invalid content</body></html>',
      } as Response);

      const requestBody = {
        sourceType: 'greenhouse',
        greenhouse: {
          url: 'https://boards.greenhouse.io/company/jobs/123',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Failed to extract');

      vi.restoreAllMocks();
    });
  });

  describe('generic_url ingestion', () => {
    it('ingests generic URL job from URL with mocked fetch', async () => {
      const fixtureHtml = readFileSync(
        join(
          process.cwd(),
          '../../packages/shared/test/fixtures/generic/semantic-page.html'
        ),
        'utf-8'
      );

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => fixtureHtml,
      } as Response);

      const requestBody = {
        sourceType: 'generic_url',
        generic_url: {
          url: 'https://techcorp.com/careers/full-stack-engineer',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.jobId).toBeDefined();

      // Verify job was created in DB
      const job = await prisma.jobPosting.findUnique({
        where: { id: data.jobId },
      });

      expect(job).toBeDefined();
      expect(job?.title).toBe('Full Stack Engineer - TechCorp');
      expect(job?.company).toBe('TechCorp Careers');
      expect(job?.location).toBe('Remote - USA');
      expect(job?.description).toContain('Full Stack Engineer');
      expect(job?.description).not.toContain('<h1>'); // Should be text, not HTML
      expect(job?.applyUrl).toBe('https://techcorp.com/careers/apply/12345');
      expect(job?.sourceKey).toBeNull(); // Generic URLs don't have sourceKey

      // Verify dedupe key is a hash
      expect(job?.dedupeKey).toMatch(/^[a-f0-9]{64}$/);

      vi.restoreAllMocks();
    });

    it('ingests generic URL with user-provided companyName', async () => {
      const fixtureHtml = readFileSync(
        join(
          process.cwd(),
          '../../packages/shared/test/fixtures/generic/basic-page.html'
        ),
        'utf-8'
      );

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => fixtureHtml,
      } as Response);

      const requestBody = {
        sourceType: 'generic_url',
        generic_url: {
          url: 'https://startupxyz.com/jobs/data-scientist',
          companyName: 'StartupXYZ', // User provides company name
        },
      };

      const request = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify job was created with user-provided company name
      const job = await prisma.jobPosting.findUnique({
        where: { id: data.jobId },
      });

      expect(job?.company).toBe('StartupXYZ'); // User-provided overrides extraction
      expect(job?.title).toBe('Data Scientist at StartupXYZ');

      vi.restoreAllMocks();
    });

    it('returns error when companyName cannot be extracted and not provided', async () => {
      const htmlWithoutCompany = `
        <!DOCTYPE html>
        <html>
        <head><title>Job Opening</title></head>
        <body>
          <main>
            <h1>Software Engineer</h1>
            <p>Great opportunity</p>
          </main>
        </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => htmlWithoutCompany,
      } as Response);

      const requestBody = {
        sourceType: 'generic_url',
        generic_url: {
          url: 'https://example.com/jobs/engineer',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Company name could not be extracted');
      expect(data.error).toContain('provide it manually');

      vi.restoreAllMocks();
    });

    it('deduplicates generic URL jobs by dedupeKey', async () => {
      const fixtureHtml = readFileSync(
        join(
          process.cwd(),
          '../../packages/shared/test/fixtures/generic/semantic-page.html'
        ),
        'utf-8'
      );

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => fixtureHtml,
      } as Response);

      const requestBody = {
        sourceType: 'generic_url',
        generic_url: {
          url: 'https://techcorp.com/careers/full-stack-engineer',
        },
      };

      // First ingestion
      const request1 = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response1 = await POST(request1);
      const data1 = await response1.json();
      const firstJobId = data1.jobId;

      // Second ingestion with same data (different URL)
      const request2 = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify({
          sourceType: 'generic_url',
          generic_url: {
            url: 'https://techcorp.com/careers/different-url',
          },
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response2 = await POST(request2);
      const data2 = await response2.json();

      // Should return same job ID (deduplication)
      expect(data2.jobId).toBe(firstJobId);

      // Verify only one job exists
      const jobCount = await prisma.jobPosting.count({
        where: {
          company: 'TechCorp Careers',
          title: 'Full Stack Engineer - TechCorp',
        },
      });
      expect(jobCount).toBe(1);

      vi.restoreAllMocks();
    });

    it('handles generic URL fetch errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const requestBody = {
        sourceType: 'generic_url',
        generic_url: {
          url: 'https://example.com/jobs/engineer',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();

      vi.restoreAllMocks();
    });

    it('handles invalid generic URL HTML', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html><body>No title or content</body></html>',
      } as Response);

      const requestBody = {
        sourceType: 'generic_url',
        generic_url: {
          url: 'https://example.com/jobs/engineer',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Could not extract');

      vi.restoreAllMocks();
    });
  });
});
