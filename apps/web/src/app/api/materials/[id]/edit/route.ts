import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

interface RouteParams {
  params: {
    id: string;
  };
}

// Request body schema
const EditMaterialSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  type: z.enum(['cover_letter', 'resume_variant'], {
    errorMap: () => ({ message: 'Type must be either cover_letter or resume_variant' }),
  }),
});

/**
 * POST /api/materials/:id/edit
 * Edit a material by creating a new version with stage=edited
 *
 * Request body:
 * - content: string (the edited content)
 * - type: 'cover_letter' | 'resume_variant'
 *
 * Creates a new MaterialVersion with:
 * - stage=edited
 * - diffBaseVersionId pointing to the original generated version
 * - next version number
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const materialPacketId = params.id;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = EditMaterialSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.errors[0]?.message || 'Invalid request body',
        },
        { status: 400 }
      );
    }

    const { content, type } = validationResult.data;

    // Validate material packet exists
    const materialPacket = await prisma.materialPacket.findUnique({
      where: { id: materialPacketId },
      include: {
        versions: {
          where: { type },
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!materialPacket) {
      return NextResponse.json(
        {
          success: false,
          error: 'Material packet not found',
        },
        { status: 404 }
      );
    }

    // Find the original generated version for this type
    const generatedVersion = await prisma.materialVersion.findFirst({
      where: {
        materialPacketId,
        type,
        stage: 'generated',
      },
      orderBy: { version: 'asc' }, // Get the first generated version
    });

    if (!generatedVersion) {
      return NextResponse.json(
        {
          success: false,
          error: `No generated version found for type: ${type}`,
        },
        { status: 404 }
      );
    }

    // Get next version number
    const existingVersions = await prisma.materialVersion.findMany({
      where: { materialPacketId },
      orderBy: { version: 'desc' },
      take: 1,
    });

    const nextVersion =
      existingVersions.length > 0 ? existingVersions[0].version + 1 : 1;

    // Create new edited version
    const editedVersion = await prisma.materialVersion.create({
      data: {
        materialPacketId,
        version: nextVersion,
        stage: 'edited',
        type,
        content: JSON.stringify({
          text: content,
          editedAt: new Date().toISOString(),
        }),
        diffBaseVersionId: generatedVersion.id,
      },
    });

    // Update material packet with edited content
    if (type === 'cover_letter') {
      await prisma.materialPacket.update({
        where: { id: materialPacketId },
        data: { coverLetterText: content },
      });
    } else if (type === 'resume_variant') {
      await prisma.materialPacket.update({
        where: { id: materialPacketId },
        data: { resumeVariantText: content },
      });
    }

    return NextResponse.json(
      {
        success: true,
        materialVersionId: editedVersion.id,
        version: editedVersion.version,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error editing material:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to edit material',
      },
      { status: 500 }
    );
  }
}
