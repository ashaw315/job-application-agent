import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/kb/bullets
 * Get all KB bullets
 */
export async function GET(): Promise<NextResponse> {
  try {
    const bullets = await prisma.kbBullet.findMany({
      select: {
        id: true,
        text: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(
      {
        success: true,
        bullets,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching KB bullets:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch KB bullets',
      },
      { status: 500 }
    );
  }
}
