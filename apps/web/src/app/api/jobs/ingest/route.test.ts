import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { POST } from './route';
import { NextRequest } from 'next/server';

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
});
