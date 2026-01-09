import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

describe('Database smoke tests', () => {
  afterAll(async () => {
    // Cleanup: delete test data
    await prisma.kbBullet.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.$disconnect();
  });

  it('can create and retrieve UserProfile', async () => {
    const profile = await prisma.userProfile.create({
      data: {
        name: 'Test User',
        email: 'test@example.com',
        phone: '+1-555-0199',
      },
    });

    expect(profile.id).toBeDefined();
    expect(profile.name).toBe('Test User');
    expect(profile.email).toBe('test@example.com');

    const retrieved = await prisma.userProfile.findFirst({
      where: { id: profile.id },
    });

    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe('Test User');
  });

  it('can create and retrieve KbBullet', async () => {
    const bullet = await prisma.kbBullet.create({
      data: {
        text: 'Sample resume bullet for testing',
        tags: JSON.stringify(['test', 'sample']), // Store as JSON string
      },
    });

    expect(bullet.id).toBeDefined();
    expect(bullet.text).toBe('Sample resume bullet for testing');
    expect(JSON.parse(bullet.tags)).toEqual(['test', 'sample']);

    const retrieved = await prisma.kbBullet.findFirst({
      where: { id: bullet.id },
    });

    expect(retrieved).not.toBeNull();
    expect(retrieved?.text).toBe('Sample resume bullet for testing');
    expect(JSON.parse(retrieved?.tags || '[]')).toEqual(['test', 'sample']);
  });

  it('KB bullets data file exists and is valid JSON', () => {
    const kbBulletsPath = join(process.cwd(), '..', '..', 'data', 'kb_bullets.json');
    const content = readFileSync(kbBulletsPath, 'utf-8');
    const bullets = JSON.parse(content);

    expect(Array.isArray(bullets)).toBe(true);
    expect(bullets.length).toBeGreaterThanOrEqual(3);

    bullets.forEach((bullet: unknown) => {
      expect(bullet).toHaveProperty('text');
      expect(bullet).toHaveProperty('tags');
      expect(typeof (bullet as { text: string }).text).toBe('string');
      expect(Array.isArray((bullet as { tags: string[] }).tags)).toBe(true);
    });
  });

  it('seed data creates expected records', async () => {
    // Load KB bullets from data file
    const kbBulletsPath = join(process.cwd(), '..', '..', 'data', 'kb_bullets.json');
    const kbBulletsJson = readFileSync(kbBulletsPath, 'utf-8');
    const kbBulletsData = JSON.parse(kbBulletsJson);

    // Create bullets from seed data
    for (const bulletData of kbBulletsData) {
      const existing = await prisma.kbBullet.findFirst({
        where: { text: bulletData.text },
      });

      if (!existing) {
        await prisma.kbBullet.create({
          data: {
            text: bulletData.text,
            tags: JSON.stringify(bulletData.tags), // Store as JSON string
          },
        });
      }
    }

    // Verify bullets were created
    const allBullets = await prisma.kbBullet.findMany();
    expect(allBullets.length).toBeGreaterThanOrEqual(3);

    // Verify first bullet from seed file exists
    const firstBulletText = kbBulletsData[0].text;
    const foundBullet = await prisma.kbBullet.findFirst({
      where: { text: firstBulletText },
    });

    expect(foundBullet).not.toBeNull();
    expect(JSON.parse(foundBullet?.tags || '[]')).toEqual(kbBulletsData[0].tags);
  });
});
