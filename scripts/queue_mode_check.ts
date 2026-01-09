#!/usr/bin/env tsx
/**
 * Queue Mode Integration Test
 * 
 * Validates that BullMQ queue mode works correctly:
 * 1. Checks REDIS_URL is configured
 * 2. Enqueues a test job through pipeline API
 * 3. Polls database until worker processes it (score + draft)
 * 4. Validates idempotency (re-enqueue doesn't duplicate)
 * 5. Reports timing and success
 * 
 * Prerequisites:
 *   - Web app running (pnpm dev in apps/web)
 *   - Worker running (pnpm worker in apps/web)
 *   - REDIS_URL set in apps/web/.env
 *   - Database seeded
 * 
 * Usage:
 *   # Terminal 1: Start worker
 *   cd apps/web
 *   pnpm worker
 *   
 *   # Terminal 2: Run validation
 *   cd /path/to/repo
 *   pnpm tsx scripts/queue_mode_check.ts
 */

import { PrismaClient } from '@prisma/client';

// ============================================================================
// Configuration
// ============================================================================

const WEB_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:3000';
const MAX_WAIT_MS = 30000; // 30 seconds max wait for async processing
const POLL_INTERVAL_MS = 500; // Poll every 500ms

const prisma = new PrismaClient();

// ============================================================================
// Helpers
// ============================================================================

function log(message: string, ...args: any[]): void {
  console.log(`[${new Date().toISOString().substring(11, 23)}] ${message}`, ...args);
}

function error(message: string, ...args: any[]): void {
  console.error(`[${new Date().toISOString().substring(11, 23)}] ❌ ${message}`, ...args);
}

function success(message: string, ...args: any[]): void {
  console.log(`[${new Date().toISOString().substring(11, 23)}] ✅ ${message}`, ...args);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiCall<T>(
  method: string,
  path: string,
  body?: any
): Promise<T> {
  const url = `${WEB_BASE_URL}${path}`;
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `API call failed: ${method} ${path}\n` +
      `Status: ${response.status}\n` +
      `Body: ${text.substring(0, 500)}`
    );
  }
  
  return response.json();
}

async function waitForMaterials(
  jobId: string,
  timeoutMs: number
): Promise<{ success: boolean; durationMs: number; materials?: any }> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const materialPackets = await prisma.materialPacket.findMany({
      where: { jobPostingId: jobId },
      include: { versions: true },
    });
    
    if (materialPackets.length > 0 && materialPackets[0].versions.length >= 2) {
      const durationMs = Date.now() - startTime;
      return { success: true, durationMs, materials: materialPackets[0] };
    }
    
    await sleep(POLL_INTERVAL_MS);
  }
  
  const durationMs = Date.now() - startTime;
  return { success: false, durationMs };
}

async function waitForScore(
  jobId: string,
  timeoutMs: number
): Promise<{ success: boolean; durationMs: number; score?: any }> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const fitScore = await prisma.fitScore.findUnique({
      where: { jobPostingId: jobId },
    });
    
    if (fitScore) {
      const durationMs = Date.now() - startTime;
      return { success: true, durationMs, score: fitScore };
    }
    
    await sleep(POLL_INTERVAL_MS);
  }
  
  const durationMs = Date.now() - startTime;
  return { success: false, durationMs };
}

// ============================================================================
// Main Validation
// ============================================================================

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('🔄 QUEUE MODE INTEGRATION TEST');
  console.log('='.repeat(70));
  log(`Web API: ${WEB_BASE_URL}`);
  log(`Max wait: ${MAX_WAIT_MS}ms`);
  log(`Poll interval: ${POLL_INTERVAL_MS}ms\n`);
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // -------------------------------------------------------------------------
  // Step 1: Check REDIS_URL is configured
  // -------------------------------------------------------------------------
  
  log('Step 1: Checking queue mode configuration...');
  
  try {
    const health = await apiCall<any>('GET', '/api/health');
    
    if (!health.queueModeEnabled) {
      error('Queue mode is NOT enabled!');
      error('Set REDIS_URL in apps/web/.env and restart the app');
      error('Example: REDIS_URL="redis://localhost:6379"');
      process.exit(1);
    }
    
    success('Queue mode is enabled');
    success(`Redis configured, database: ${health.database}`);
    testsPassed++;
  } catch (err: any) {
    error('Failed to check health:', err.message);
    error('Is the web app running? (cd apps/web && pnpm dev)');
    testsFailed++;
    process.exit(1);
  }
  
  // -------------------------------------------------------------------------
  // Step 2: Ingest test job
  // -------------------------------------------------------------------------
  
  log('\nStep 2: Ingesting test job...');
  
  let jobId: string;
  
  try {
    const ingestBody = {
      sourceType: 'manual',
      manual: {
        companyName: 'Queue Test Corp',
        title: 'Backend Engineer (Queue Mode Test)',
        location: 'Remote',
        description:
          'This is a queue mode integration test job. ' +
          'We need React, TypeScript, Node.js, PostgreSQL, and Redis experience. ' +
          'Must have microservices and Kubernetes knowledge.',
      },
    };
    
    const result = await apiCall<{ success: boolean; jobId: string }>(
      'POST',
      '/api/jobs/ingest',
      ingestBody
    );
    
    if (!result.success || !result.jobId) {
      throw new Error('Ingest failed: no jobId returned');
    }
    
    jobId = result.jobId;
    success(`Job ingested: ${jobId}`);
    testsPassed++;
  } catch (err: any) {
    error('Failed to ingest job:', err.message);
    testsFailed++;
    process.exit(1);
  }
  
  // -------------------------------------------------------------------------
  // Step 3: Enqueue pipeline (score + draft)
  // -------------------------------------------------------------------------
  
  log('\nStep 3: Enqueueing pipeline jobs...');
  
  try {
    const result = await apiCall<{ success: boolean; queueJobIds?: any; mode?: string }>(
      'POST',
      `/api/jobs/${jobId}/runPipeline`
    );
    
    if (!result.success) {
      throw new Error('Pipeline enqueue failed');
    }
    
    if (result.mode !== 'queue') {
      error(`Expected mode='queue', got '${result.mode}'`);
      error('Is REDIS_URL set correctly?');
      testsFailed++;
      process.exit(1);
    }
    
    success('Pipeline jobs enqueued');
    if (result.queueJobIds) {
      log(`  Score job ID: ${result.queueJobIds.scoreJobId || 'N/A'}`);
      log(`  Draft job ID: ${result.queueJobIds.draftJobId || 'N/A'}`);
    }
    testsPassed++;
  } catch (err: any) {
    error('Failed to enqueue pipeline:', err.message);
    testsFailed++;
    process.exit(1);
  }
  
  // -------------------------------------------------------------------------
  // Step 4: Wait for worker to process score job
  // -------------------------------------------------------------------------
  
  log('\nStep 4: Waiting for worker to compute score...');
  log('(If this times out, check that worker is running: cd apps/web && pnpm worker)');
  
  try {
    const scoreResult = await waitForScore(jobId, MAX_WAIT_MS);
    
    if (!scoreResult.success) {
      error(`Score not computed after ${scoreResult.durationMs}ms`);
      error('Is the worker running?');
      error('Start it with: cd apps/web && pnpm worker');
      testsFailed++;
      process.exit(1);
    }
    
    success(`Score computed in ${scoreResult.durationMs}ms`);
    log(`  Score: ${scoreResult.score?.score}/100`);
    testsPassed++;
  } catch (err: any) {
    error('Failed to wait for score:', err.message);
    testsFailed++;
    process.exit(1);
  }
  
  // -------------------------------------------------------------------------
  // Step 5: Wait for worker to process draft job
  // -------------------------------------------------------------------------
  
  log('\nStep 5: Waiting for worker to draft materials...');
  
  try {
    const materialsResult = await waitForMaterials(jobId, MAX_WAIT_MS);
    
    if (!materialsResult.success) {
      error(`Materials not created after ${materialsResult.durationMs}ms`);
      error('Check worker logs for errors');
      testsFailed++;
      process.exit(1);
    }
    
    success(`Materials created in ${materialsResult.durationMs}ms`);
    log(`  Versions: ${materialsResult.materials?.versions.length}`);
    
    const hasCoverLetter = materialsResult.materials?.versions.some(
      (v: any) => v.type === 'cover_letter'
    );
    const hasResume = materialsResult.materials?.versions.some(
      (v: any) => v.type === 'resume_variant'
    );
    
    if (!hasCoverLetter || !hasResume) {
      error('Missing material types!');
      error(`  Has cover letter: ${hasCoverLetter}`);
      error(`  Has resume: ${hasResume}`);
      testsFailed++;
    } else {
      success('Both cover letter and resume variants created');
      testsPassed++;
    }
  } catch (err: any) {
    error('Failed to wait for materials:', err.message);
    testsFailed++;
    process.exit(1);
  }
  
  // -------------------------------------------------------------------------
  // Step 6: Test idempotency (enqueue same job again)
  // -------------------------------------------------------------------------
  
  log('\nStep 6: Testing idempotency (re-enqueue same job)...');
  
  try {
    const beforeCount = await prisma.materialVersion.count({
      where: { materialPacket: { jobPostingId: jobId } },
    });
    
    // Enqueue again
    await apiCall<{ success: boolean }>(
      'POST',
      `/api/jobs/${jobId}/runPipeline`
    );
    
    // Wait a bit for potential duplicate processing
    await sleep(3000);
    
    const afterCount = await prisma.materialVersion.count({
      where: { materialPacket: { jobPostingId: jobId } },
    });
    
    if (afterCount > beforeCount) {
      error(`Idempotency FAILED: material count increased from ${beforeCount} to ${afterCount}`);
      error('Duplicate materials were created!');
      testsFailed++;
    } else {
      success(`Idempotency PASSED: material count unchanged (${afterCount})`);
      testsPassed++;
    }
  } catch (err: any) {
    error('Failed idempotency test:', err.message);
    testsFailed++;
  }
  
  // -------------------------------------------------------------------------
  // Step 7: Verify job status
  // -------------------------------------------------------------------------
  
  log('\nStep 7: Verifying final job status...');
  
  try {
    const job = await prisma.jobPosting.findUnique({
      where: { id: jobId },
      include: {
        fitScore: true,
        materialPackets: { include: { versions: true } },
      },
    });
    
    if (!job) {
      throw new Error('Job not found');
    }
    
    success(`Final job status: ${job.status}`);
    log(`  Fit score: ${job.fitScore?.score || 'N/A'}/100`);
    log(`  Material versions: ${job.materialPackets[0]?.versions.length || 0}`);
    
    if (job.status === 'in_review' || job.status === 'needs_attention') {
      success('Job status is correct for completed pipeline');
      testsPassed++;
    } else {
      error(`Unexpected job status: ${job.status}`);
      testsFailed++;
    }
  } catch (err: any) {
    error('Failed to verify job status:', err.message);
    testsFailed++;
  }
  
  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📝 Job ID: ${jobId}`);
  console.log(`🔗 View at: ${WEB_BASE_URL}/jobs/${jobId}`);
  console.log('='.repeat(70));
  
  if (testsFailed > 0) {
    console.log('\n💥 QUEUE MODE TEST FAILED\n');
    process.exit(1);
  } else {
    console.log('\n🎉 QUEUE MODE TEST PASSED\n');
    console.log('Queue mode is working correctly:');
    console.log('  ✅ Jobs are enqueued via BullMQ');
    console.log('  ✅ Worker processes score and draft jobs');
    console.log('  ✅ Database is updated with results');
    console.log('  ✅ Idempotency prevents duplicate processing');
    process.exit(0);
  }
}

// ============================================================================
// Execute
// ============================================================================

main()
  .catch((err) => {
    console.error('\n💥 UNEXPECTED ERROR\n');
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
