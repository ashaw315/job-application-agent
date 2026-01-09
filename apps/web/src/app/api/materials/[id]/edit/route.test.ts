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

describe('POST /api/materials/:id/edit', () => {
  it('creates new edited version with diffBaseVersionId pointing to generated version', async () => {
    // Create test job posting with material packet and generated version
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-edit-1',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-edit-job-1',
        title: 'Software Engineer',
        company: 'Test Corp',
        description: 'Test job',
        jobSourceId: jobSource.id,
      },
    });

    const materialPacket = await prisma.materialPacket.create({
      data: {
        jobPostingId: jobPosting.id,
        resumeVariantText: 'Original resume text',
        coverLetterText: 'Original cover letter text',
      },
    });

    const generatedVersion = await prisma.materialVersion.create({
      data: {
        materialPacketId: materialPacket.id,
        version: 1,
        stage: 'generated',
        type: 'cover_letter',
        content: JSON.stringify({
          text: 'Original cover letter content',
        }),
      },
    });

    const editedContent = 'Updated cover letter content with manual edits';

    const request = new NextRequest(
      `http://localhost:3000/api/materials/${materialPacket.id}/edit`,
      {
        method: 'POST',
        body: JSON.stringify({
          content: editedContent,
          type: 'cover_letter',
        }),
      }
    );

    const response = await POST(request, { params: { id: materialPacket.id } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.materialVersionId).toBeDefined();

    // Verify new edited version was created
    const editedVersion = await prisma.materialVersion.findUnique({
      where: { id: data.materialVersionId },
    });

    expect(editedVersion).toBeDefined();
    expect(editedVersion?.stage).toBe('edited');
    expect(editedVersion?.type).toBe('cover_letter');
    expect(editedVersion?.version).toBe(2); // Should be next version
    expect(editedVersion?.diffBaseVersionId).toBe(generatedVersion.id);

    const content = JSON.parse(editedVersion!.content);
    expect(content.text).toBe(editedContent);
    expect(content.editedAt).toBeDefined();
  });

  it('creates new edited version based on most recent version (including other edits)', async () => {
    // Create test data with multiple versions
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-edit-2',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-edit-job-2',
        title: 'Backend Engineer',
        company: 'Test Corp 2',
        description: 'Test job 2',
        jobSourceId: jobSource.id,
      },
    });

    const materialPacket = await prisma.materialPacket.create({
      data: {
        jobPostingId: jobPosting.id,
        resumeVariantText: 'Original resume',
        coverLetterText: 'Original cover letter',
      },
    });

    const generatedVersion = await prisma.materialVersion.create({
      data: {
        materialPacketId: materialPacket.id,
        version: 1,
        stage: 'generated',
        type: 'resume_variant',
        content: JSON.stringify({ text: 'Generated resume' }),
      },
    });

    await prisma.materialVersion.create({
      data: {
        materialPacketId: materialPacket.id,
        version: 2,
        stage: 'edited',
        type: 'resume_variant',
        content: JSON.stringify({ text: 'First edit' }),
        diffBaseVersionId: generatedVersion.id,
      },
    });

    // Now create a second edit
    const request = new NextRequest(
      `http://localhost:3000/api/materials/${materialPacket.id}/edit`,
      {
        method: 'POST',
        body: JSON.stringify({
          content: 'Second edit',
          type: 'resume_variant',
        }),
      }
    );

    const response = await POST(request, { params: { id: materialPacket.id } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify new edited version was created
    const secondEdit = await prisma.materialVersion.findUnique({
      where: { id: data.materialVersionId },
    });

    expect(secondEdit).toBeDefined();
    expect(secondEdit?.version).toBe(3); // Should be next version
    expect(secondEdit?.stage).toBe('edited');
    // Should still point to the original generated version
    expect(secondEdit?.diffBaseVersionId).toBe(generatedVersion.id);
  });

  it('returns 404 for non-existent material packet', async () => {
    const fakeMaterialId = '00000000-0000-0000-0000-000000000000';

    const request = new NextRequest(
      `http://localhost:3000/api/materials/${fakeMaterialId}/edit`,
      {
        method: 'POST',
        body: JSON.stringify({
          content: 'Some content',
          type: 'cover_letter',
        }),
      }
    );

    const response = await POST(request, { params: { id: fakeMaterialId } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Material packet not found');
  });

  it('returns 404 when no generated version exists for the specified type', async () => {
    // Create material packet without any versions
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-edit-3',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-edit-job-3',
        title: 'Frontend Engineer',
        company: 'Test Corp 3',
        description: 'Test job 3',
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

    const request = new NextRequest(
      `http://localhost:3000/api/materials/${materialPacket.id}/edit`,
      {
        method: 'POST',
        body: JSON.stringify({
          content: 'Edited content',
          type: 'cover_letter',
        }),
      }
    );

    const response = await POST(request, { params: { id: materialPacket.id } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('No generated version found');
  });

  it('validates required fields in request body', async () => {
    const jobSource = await prisma.jobSource.create({
      data: {
        url: 'https://example.com/jobs/test-edit-4',
        atsType: 'manual',
      },
    });

    const jobPosting = await prisma.jobPosting.create({
      data: {
        dedupeKey: 'test-edit-job-4',
        title: 'DevOps Engineer',
        company: 'Test Corp 4',
        description: 'Test job 4',
        jobSourceId: jobSource.id,
      },
    });

    const materialPacket = await prisma.materialPacket.create({
      data: {
        jobPostingId: jobPosting.id,
        resumeVariantText: 'Resume',
      },
    });

    // Missing content field
    const request = new NextRequest(
      `http://localhost:3000/api/materials/${materialPacket.id}/edit`,
      {
        method: 'POST',
        body: JSON.stringify({
          type: 'cover_letter',
        }),
      }
    );

    const response = await POST(request, { params: { id: materialPacket.id } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });
});
