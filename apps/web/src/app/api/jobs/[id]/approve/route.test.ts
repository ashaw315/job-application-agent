import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { POST } from './route';
import { NextRequest } from 'next/server';

const prisma = new PrismaClient();

afterAll(async () => {
  // Clean up test database - order matters due to foreign keys
  await prisma.materialVersion.deleteMany();
  await prisma.materialPacket.deleteMany();
  await prisma.statusEvent.deleteMany();
  await prisma.fitScore.deleteMany();
  await prisma.jobPosting.deleteMany();
  await prisma.jobSource.deleteMany();
  await prisma.$disconnect();
});

describe('POST /api/jobs/:id/approve', () => {
  it('creates approved versions based on edited versions when they exist', async () => {
    // Create test job with generated and edited versions
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-approve-1',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-approve-job-1',
        title: 'Software Engineer',
        company: 'Test Corp',
        description: 'Test job',
        status: 'in_review',
        jobSourceId: jobSource.id,
      },
    });

    const materialPacket = await prisma.materialPacket.create({
      data: {
        jobPostingId: jobPosting.id,
        resumeVariantText: 'Resume text',
        coverLetterText: 'Cover letter text',
      },
    });

    // Create generated versions
    const generatedCoverLetter = await prisma.materialVersion.create({
      data: {
        materialPacketId: materialPacket.id,
        version: 1,
        stage: 'generated',
        type: 'cover_letter',
        content: JSON.stringify({ text: 'Generated cover letter' }),
      },
    });

    const generatedResume = await prisma.materialVersion.create({
      data: {
        materialPacketId: materialPacket.id,
        version: 2,
        stage: 'generated',
        type: 'resume_variant',
        content: JSON.stringify({ text: 'Generated resume' }),
      },
    });

    // Create edited versions
    await prisma.materialVersion.create({
      data: {
        materialPacketId: materialPacket.id,
        version: 3,
        stage: 'edited',
        type: 'cover_letter',
        content: JSON.stringify({ text: 'Edited cover letter' }),
        diffBaseVersionId: generatedCoverLetter.id,
      },
    });

    await prisma.materialVersion.create({
      data: {
        materialPacketId: materialPacket.id,
        version: 4,
        stage: 'edited',
        type: 'resume_variant',
        content: JSON.stringify({ text: 'Edited resume' }),
        diffBaseVersionId: generatedResume.id,
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/jobs/${jobPosting.id}/approve`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: { id: jobPosting.id } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.approvedVersionIds).toHaveLength(2);

    // Verify approved versions were created based on edited versions
    const approvedCoverLetter = await prisma.materialVersion.findFirst({
      where: {
        materialPacketId: materialPacket.id,
        type: 'cover_letter',
        stage: 'approved',
      },
    });

    expect(approvedCoverLetter).toBeDefined();
    const coverLetterContent = JSON.parse(approvedCoverLetter!.content);
    expect(coverLetterContent.text).toBe('Edited cover letter');
    expect(approvedCoverLetter!.diffBaseVersionId).toBe(generatedCoverLetter.id);

    const approvedResume = await prisma.materialVersion.findFirst({
      where: {
        materialPacketId: materialPacket.id,
        type: 'resume_variant',
        stage: 'approved',
      },
    });

    expect(approvedResume).toBeDefined();
    const resumeContent = JSON.parse(approvedResume!.content);
    expect(resumeContent.text).toBe('Edited resume');
    expect(approvedResume!.diffBaseVersionId).toBe(generatedResume.id);

    // Verify status was updated to approved
    const updatedJob = await prisma.jobPosting.findUnique({
      where: { id: jobPosting.id },
    });
    expect(updatedJob?.status).toBe('approved');

    // Verify StatusEvent was created
    const statusEvent = await prisma.statusEvent.findFirst({
      where: {
        jobPostingId: jobPosting.id,
        toStatus: 'approved',
      },
    });
    expect(statusEvent).toBeDefined();
    expect(statusEvent?.fromStatus).toBe('in_review');
  });

  it('creates approved versions based on generated versions when no edits exist', async () => {
    // Create test job with only generated versions
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-approve-2',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-approve-job-2',
        title: 'Backend Engineer',
        company: 'Test Corp 2',
        description: 'Test job 2',
        status: 'in_review',
        jobSourceId: jobSource.id,
      },
    });

    const materialPacket = await prisma.materialPacket.create({
      data: {
        jobPostingId: jobPosting.id,
        resumeVariantText: 'Resume text',
        coverLetterText: 'Cover letter text',
      },
    });

    // Create only generated versions
    await prisma.materialVersion.create({
      data: {
        materialPacketId: materialPacket.id,
        version: 1,
        stage: 'generated',
        type: 'cover_letter',
        content: JSON.stringify({ text: 'Generated cover letter only' }),
      },
    });

    await prisma.materialVersion.create({
      data: {
        materialPacketId: materialPacket.id,
        version: 2,
        stage: 'generated',
        type: 'resume_variant',
        content: JSON.stringify({ text: 'Generated resume only' }),
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/jobs/${jobPosting.id}/approve`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: { id: jobPosting.id } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify approved versions were created based on generated versions
    const approvedCoverLetter = await prisma.materialVersion.findFirst({
      where: {
        materialPacketId: materialPacket.id,
        type: 'cover_letter',
        stage: 'approved',
      },
    });

    expect(approvedCoverLetter).toBeDefined();
    const coverLetterContent = JSON.parse(approvedCoverLetter!.content);
    expect(coverLetterContent.text).toBe('Generated cover letter only');

    const approvedResume = await prisma.materialVersion.findFirst({
      where: {
        materialPacketId: materialPacket.id,
        type: 'resume_variant',
        stage: 'approved',
      },
    });

    expect(approvedResume).toBeDefined();
    const resumeContent = JSON.parse(approvedResume!.content);
    expect(resumeContent.text).toBe('Generated resume only');

    // Verify status was updated
    const updatedJob = await prisma.jobPosting.findUnique({
      where: { id: jobPosting.id },
    });
    expect(updatedJob?.status).toBe('approved');
  });

  it('returns 404 for non-existent job', async () => {
    const fakeJobId = '00000000-0000-0000-0000-000000000000';

    const request = new NextRequest(
      `http://localhost:3000/api/jobs/${fakeJobId}/approve`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: { id: fakeJobId } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Job not found');
  });

  it('returns 400 when no material packet exists', async () => {
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-approve-3',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-approve-job-3',
        title: 'DevOps Engineer',
        company: 'Test Corp 3',
        description: 'Test job 3',
        status: 'in_review',
        jobSourceId: jobSource.id,
      },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/jobs/${jobPosting.id}/approve`,
      { method: 'POST' }
    );

    const response = await POST(request, { params: { id: jobPosting.id } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('No material packet found');
  });
});
