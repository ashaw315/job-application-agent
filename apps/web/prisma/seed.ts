import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

interface KbBulletData {
  text: string;
  tags: string[];
}

async function main(): Promise<void> {
  console.log('Starting seed...');

  // Ensure UserProfile singleton exists
  const existingProfile = await prisma.userProfile.findFirst();

  if (!existingProfile) {
    const profile = await prisma.userProfile.create({
      data: {
        name: 'Default User',
        email: 'user@example.com',
        phone: '+1-555-0100',
      },
    });
    console.log('Created UserProfile:', profile.id);
  } else {
    console.log('UserProfile already exists:', existingProfile.id);
  }

  // Load KB bullets from data file
  const kbBulletsPath = join(process.cwd(), '..', '..', 'data', 'kb_bullets.json');
  const kbBulletsJson = readFileSync(kbBulletsPath, 'utf-8');
  const kbBulletsData: KbBulletData[] = JSON.parse(kbBulletsJson);

  console.log(`Loading ${kbBulletsData.length} KB bullets...`);

  for (const bulletData of kbBulletsData) {
    // Check if bullet already exists (simple text match)
    const existing = await prisma.kbBullet.findFirst({
      where: { text: bulletData.text },
    });

    if (!existing) {
      const bullet = await prisma.kbBullet.create({
        data: {
          text: bulletData.text,
          tags: JSON.stringify(bulletData.tags), // Store as JSON string for SQLite
        },
      });
      console.log('Created KbBullet:', bullet.id);
    } else {
      console.log('KbBullet already exists:', existing.id);
    }
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
