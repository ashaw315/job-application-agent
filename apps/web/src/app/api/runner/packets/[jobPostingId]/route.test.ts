import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { GET } from './route';
import { NextRequest } from 'next/server';

const prisma = new PrismaClient();

// Mock RUNNER_API_KEY for tests
const RUNNER_API_KEY = 'test-runner-api-key';

beforeEach(() => {
  // Set the environment variable for tests
  process.env.RUNNER_API_KEY = RUNNER_API_KEY;
});

afterAll(async () => {
  // Clean up test database
  await prisma.materialVersion.deleteMany();
  await prisma.materialPacket.deleteMany();
  await prisma.statusEvent.deleteMany();
  await prisma.fitScore.deleteMany();
  await prisma.jobPosting.deleteMany();
  await prisma.jobSource.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.$disconnect();
});

describe('GET /api/runner/packets/:jobPostingId', () => {
  it('returns 401 when no authorization header is provided', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/runner/packets/fake-id',
      {
        method: 'GET',
      }
    );

    const response = await GET(request, { params: { jobPostingId: 'fake-id' } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Authorization header required');
  });

  it('returns 401 when invalid bearer token is provided', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/runner/packets/fake-id',
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer wrong-token',
        },
      }
    );

    const response = await GET(request, { params: { jobPostingId: 'fake-id' } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid authorization token');
  });

  it('returns 404 when job posting does not exist', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/runner/packets/00000000-0000-0000-0000-000000000000',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${RUNNER_API_KEY}`,
        },
      }
    );

    const response = await GET(request, {
      params: { jobPostingId: '00000000-0000-0000-0000-000000000000' },
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Job posting not found');
  });

  it('returns 409 when job is not approved', async () => {
    // Create test job with status in_review
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-packet-1',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-packet-job-1',
        title: 'Software Engineer',
        company: 'Test Corp',
        description: 'Test job',
        status: 'in_review', // Not approved
        applyUrl: 'https://example.com/apply/1',
        jobSourceId: jobSource.id,
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/runner/packets/${jobPosting.id}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${RUNNER_API_KEY}`,
        },
      }
    );

    const response = await GET(request, {
      params: { jobPostingId: jobPosting.id },
    });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Job must be approved');
  });

  it('returns 400 when job has no approved materials', async () => {
    // Create test job with approved status but no materials
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-packet-2',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-packet-job-2',
        title: 'Backend Engineer',
        company: 'Test Corp 2',
        description: 'Test job 2',
        status: 'approved',
        applyUrl: 'https://example.com/apply/2',
        jobSourceId: jobSource.id,
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/runner/packets/${jobPosting.id}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${RUNNER_API_KEY}`,
        },
      }
    );

    const response = await GET(request, {
      params: { jobPostingId: jobPosting.id },
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('No approved materials found');
  });

  it('returns valid runner packet for approved job with materials', async () => {
    // Clean up and create user profile
    await prisma.userProfile.deleteMany();
    await prisma.userProfile.create({
      data: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
      },
    });

    // Create test job with approved status
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-packet-3',
        atsType: 'greenhouse',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-packet-job-3',
        title: 'Senior Engineer',
        company: 'Test Corp 3',
        description: 'Test job 3',
        status: 'approved',
        applyUrl: 'https://example.com/apply/3',
        jobSourceId: jobSource.id,
      },
    });

    // Create material packet with approved versions
    const materialPacket = await prisma.materialPacket.create({
      data: {
        jobPostingId: jobPosting.id,
        resumeVariantText: 'Approved resume text',
        coverLetterText: 'Approved cover letter text',
      },
    });

    await prisma.materialVersion.create({
      data: {
        materialPacketId: materialPacket.id,
        version: 1,
        stage: 'approved',
        type: 'cover_letter',
        content: JSON.stringify({ text: 'Approved cover letter text' }),
      },
    });

    await prisma.materialVersion.create({
      data: {
        materialPacketId: materialPacket.id,
        version: 2,
        stage: 'approved',
        type: 'resume_variant',
        content: JSON.stringify({
          text: 'Approved resume text',
          bullets: [
            { variant: 'Bullet 1', isValid: true },
            { variant: 'Bullet 2', isValid: true },
          ],
        }),
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/runner/packets/${jobPosting.id}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${RUNNER_API_KEY}`,
        },
      }
    );

    const response = await GET(request, {
      params: { jobPostingId: jobPosting.id },
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.packet).toBeDefined();

    // Verify packet structure matches schema
    const packet = data.packet;
    expect(packet.jobPostingId).toBe(jobPosting.id);
    expect(packet.applyUrl).toBe('https://example.com/apply/3');
    expect(packet.userProfile).toEqual({
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
    });
    expect(packet.materials).toBeDefined();
    expect(packet.materials.coverLetterText).toBe('Approved cover letter text');
    // Resume with bullets is joined with newlines
    expect(packet.materials.resumeText).toBe('Bullet 1\nBullet 2');
    expect(packet.allowedAnswers).toBeDefined();
  });

  it('returns packet without phone when user profile has no phone', async () => {
    // Create user profile without phone
    await prisma.userProfile.deleteMany(); // Clean up previous
    await prisma.userProfile.create({
      data: {
        name: 'Jane Smith',
        email: 'jane@example.com',
      },
    });

    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-packet-4',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-packet-job-4',
        title: 'Developer',
        company: 'Test Corp 4',
        description: 'Test job 4',
        status: 'approved',
        applyUrl: 'https://example.com/apply/4',
        jobSourceId: jobSource.id,
      },
    });

    const materialPacket = await prisma.materialPacket.create({
      data: {
        jobPostingId: jobPosting.id,
        resumeVariantText: 'Resume',
        coverLetterText: 'Cover letter',
      },
    });

    await prisma.materialVersion.create({
      data: {
        materialPacketId: materialPacket.id,
        version: 1,
        stage: 'approved',
        type: 'cover_letter',
        content: JSON.stringify({ text: 'Cover letter' }),
      },
    });

    await prisma.materialVersion.create({
      data: {
        materialPacketId: materialPacket.id,
        version: 2,
        stage: 'approved',
        type: 'resume_variant',
        content: JSON.stringify({ text: 'Resume' }),
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/runner/packets/${jobPosting.id}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${RUNNER_API_KEY}`,
        },
      }
    );

    const response = await GET(request, {
      params: { jobPostingId: jobPosting.id },
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.packet.userProfile.phone).toBeUndefined();
    expect(data.packet.userProfile.name).toBe('Jane Smith');
    expect(data.packet.userProfile.email).toBe('jane@example.com');
  });
});
