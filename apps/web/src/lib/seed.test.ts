import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { join } from 'path';

const prisma = new PrismaClient();

describe('Seed Script', () => {
  beforeAll(async () => {
    // Clean the test database before seeding
    await prisma.runnerArtifact.deleteMany();
    await prisma.runnerRun.deleteMany();
    await prisma.followUpEmailDraft.deleteMany();
    await prisma.followUpSuggestion.deleteMany();
    await prisma.materialVersion.deleteMany();
    await prisma.materialPacket.deleteMany();
    await prisma.fitScore.deleteMany();
    await prisma.statusEvent.deleteMany();
    await prisma.jobPosting.deleteMany();
    await prisma.jobSource.deleteMany();
    await prisma.kbBullet.deleteMany();
    await prisma.userProfile.deleteMany();

    // Run the seed script
    const seedPath = join(__dirname, '../../prisma/seed.ts');
    execSync(`tsx ${seedPath}`, {
      cwd: join(__dirname, '../..'),
      stdio: 'pipe', // Suppress output
      env: process.env,
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates exactly 1 UserProfile', async () => {
    const profiles = await prisma.userProfile.findMany();
    
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('Default User');
    expect(profiles[0].email).toBe('user@example.com');
    expect(profiles[0].phone).toBe('+1-555-0100');
  });

  it('creates at least 15 KbBullets', async () => {
    const bullets = await prisma.kbBullet.findMany();
    
    expect(bullets.length).toBeGreaterThanOrEqual(15);
  });

  it('ensures all KbBullets have non-empty tags', async () => {
    const bullets = await prisma.kbBullet.findMany();
    
    for (const bullet of bullets) {
      const tags = JSON.parse(bullet.tags);
      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThan(0);
      
      // Verify tags are strings
      for (const tag of tags) {
        expect(typeof tag).toBe('string');
        expect(tag.length).toBeGreaterThan(0);
      }
    }
  });

  it('creates diverse tag categories across bullets', async () => {
    const bullets = await prisma.kbBullet.findMany();
    const allTags = new Set<string>();
    
    for (const bullet of bullets) {
      const tags = JSON.parse(bullet.tags);
      tags.forEach((tag: string) => allTags.add(tag));
    }
    
    // Should have at least 20 unique tags across all bullets
    expect(allTags.size).toBeGreaterThanOrEqual(20);
    
    // Verify we have diverse categories
    const expectedCategories = ['backend', 'frontend', 'devops', 'testing', 'leadership'];
    const hasCategory = expectedCategories.some(cat => allTags.has(cat));
    expect(hasCategory).toBe(true);
  });

  it('creates sample JobPostings', async () => {
    const jobs = await prisma.jobPosting.findMany();
    
    expect(jobs.length).toBeGreaterThanOrEqual(3);
    
    // Verify job structure
    for (const job of jobs) {
      expect(job.dedupeKey).toBeTruthy();
      expect(job.title).toBeTruthy();
      expect(job.company).toBeTruthy();
      expect(job.description).toBeTruthy();
      expect(job.status).toBeTruthy();
    }
  });

  it('is idempotent - running seed twice produces same results', async () => {
    // Get counts before second run
    const bulletsBefore = await prisma.kbBullet.count();
    const profilesBefore = await prisma.userProfile.count();
    const jobsBefore = await prisma.jobPosting.count();
    
    // Run seed again
    const seedPath = join(__dirname, '../../prisma/seed.ts');
    execSync(`tsx ${seedPath}`, {
      cwd: join(__dirname, '../..'),
      stdio: 'pipe',
      env: process.env,
    });
    
    // Get counts after second run
    const bulletsAfter = await prisma.kbBullet.count();
    const profilesAfter = await prisma.userProfile.count();
    const jobsAfter = await prisma.jobPosting.count();
    
    // Counts should be identical (no duplicates created)
    expect(bulletsAfter).toBe(bulletsBefore);
    expect(profilesAfter).toBe(profilesBefore);
    expect(jobsAfter).toBe(jobsBefore);
  });

  it('ensures KbBullets have realistic achievement text', async () => {
    const bullets = await prisma.kbBullet.findMany();
    
    for (const bullet of bullets) {
      // Each bullet should be a substantial achievement (at least 50 chars)
      expect(bullet.text.length).toBeGreaterThan(50);
      
      // Should contain numbers/metrics (common in achievement bullets)
      const hasMetrics = /\d+/.test(bullet.text);
      expect(hasMetrics).toBe(true);
    }
  });
});
