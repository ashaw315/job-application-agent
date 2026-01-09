import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

/**
 * GET /api/health
 * Returns app health status for deployment verification and monitoring
 *
 * No auth required - this is a public health check endpoint.
 * Always returns 200 (even on DB errors) with explicit status fields for v0.
 */
export async function GET(): Promise<NextResponse> {
  const timestamp = new Date().toISOString();

  // Read version from package.json
  let version = 'v0';
  try {
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    version = packageJson.version || 'v0';
  } catch {
    // If we can't read package.json, default to v0
    version = 'v0';
  }

  // Check queue mode directly from process.env to avoid env validation
  // Health endpoint must work even if some env vars are missing
  const queueModeEnabled = !!process.env.REDIS_URL;

  // Check database connectivity with lightweight query
  let databaseStatus: 'ok' | 'error' = 'ok';
  try {
    // Execute trivial query to verify DB connection
    // This is equivalent to SELECT 1 and doesn't load any data
    await prisma.$queryRaw`SELECT 1 as health_check`;
  } catch (error) {
    databaseStatus = 'error';
    console.error('Health check: Database connection failed', error);
  }

  return NextResponse.json(
    {
      status: 'ok',
      timestamp,
      version,
      queueModeEnabled,
      database: databaseStatus,
    },
    { status: 200 }
  );
}
