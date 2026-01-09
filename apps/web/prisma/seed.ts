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

  // Create sample JobSource and JobPostings for UI testing
  console.log('Creating sample job postings...');

  const sampleJobSource = await prisma.jobSource.upsert({
    where: { id: 'seed-source-1' },
    update: {},
    create: {
      id: 'seed-source-1',
      url: 'https://boards.greenhouse.io/acmecorp/jobs/123456',
      atsType: 'greenhouse',
    },
  });
  console.log('Created/verified JobSource:', sampleJobSource.id);

  const sampleJobs = [
    {
      dedupeKey: 'acme-senior-fullstack-sf',
      title: 'Senior Full-Stack Engineer',
      company: 'Acme Corp',
      location: 'San Francisco, CA',
      salaryMin: 150000,
      salaryMax: 200000,
      description: 'We are looking for a Senior Full-Stack Engineer to join our team. You will work on building scalable web applications using React, Node.js, and PostgreSQL. Must have 5+ years of experience.',
      status: 'new',
      jobSourceId: sampleJobSource.id,
    },
    {
      dedupeKey: 'acme-backend-remote',
      title: 'Backend Engineer',
      company: 'Acme Corp',
      location: 'Remote',
      salaryMin: 120000,
      salaryMax: 160000,
      description: 'Join our backend team to build microservices and APIs. Experience with Go, Kubernetes, and distributed systems required.',
      status: 'in_review',
      jobSourceId: sampleJobSource.id,
    },
    {
      dedupeKey: 'techstart-frontend-nyc',
      title: 'Frontend Engineer',
      company: 'TechStart Inc',
      location: 'New York, NY',
      salaryMin: 130000,
      salaryMax: 170000,
      description: 'Looking for a frontend engineer passionate about UX and performance. Work with React, TypeScript, and modern tooling.',
      status: 'new',
      jobSourceId: sampleJobSource.id,
    },
  ];

  for (const jobData of sampleJobs) {
    const existing = await prisma.jobPosting.findUnique({
      where: { dedupeKey: jobData.dedupeKey },
    });

    if (!existing) {
      const job = await prisma.jobPosting.create({
        data: jobData,
      });
      console.log('Created JobPosting:', job.title);
    } else {
      console.log('JobPosting already exists:', existing.title);
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
