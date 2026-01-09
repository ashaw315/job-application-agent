import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  JobIngestRequestSchema,
  normalizeWhitespace,
  dedupeKeyForPosting,
  extractGreenhouseJob,
  extractGenericJob,
  htmlToTextClean,
} from '@job-application-agent/shared';

const prisma = new PrismaClient();

/**
 * POST /api/jobs/ingest
 * Manually ingest a job posting
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request body
    const body = await request.json();
    const parseResult = JobIngestRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    if (parseResult.data.sourceType === 'manual') {
      const { manual } = parseResult.data;

      // Generate dedupe key using new normalization logic
      const dedupeKey = dedupeKeyForPosting({
        sourceType: 'manual',
        companyName: manual.companyName,
        title: manual.title,
        location: manual.location,
      });

      // Check if job already exists with this dedupe key
      const existingJob = await prisma.jobPosting.findUnique({
        where: { dedupeKey },
      });

      // If job exists, return existing ID (conservative deduplication)
      if (existingJob) {
        return NextResponse.json(
          {
            success: true,
            jobId: existingJob.id,
          },
          { status: 200 }
        );
      }

      // Normalize description
      const descriptionClean = normalizeWhitespace(manual.description);

      // Create JobSource first
      const jobSource = await prisma.jobSource.create({
        data: {
          url: '#', // Manual entries don't have a URL
          atsType: 'manual',
        },
      });

      // Create JobPosting
      try {
        const jobPosting = await prisma.jobPosting.create({
          data: {
            dedupeKey,
            title: manual.title,
            company: manual.companyName,
            location: manual.location || null,
            description: descriptionClean,
            status: 'new',
            jobSourceId: jobSource.id,
          },
        });

        return NextResponse.json(
          {
            success: true,
            jobId: jobPosting.id,
          },
          { status: 200 }
        );
      } catch (createError) {
        // Handle race condition where job was created between our check and insert
        if (
          createError instanceof Prisma.PrismaClientKnownRequestError &&
          createError.code === 'P2002'
        ) {
          // Unique constraint violation - fetch and return existing job
          const raceJob = await prisma.jobPosting.findUnique({
            where: { dedupeKey },
          });

          if (raceJob) {
            return NextResponse.json(
              {
                success: true,
                jobId: raceJob.id,
              },
              { status: 200 }
            );
          }
        }

        // Re-throw if it's not a duplicate key error or we can't find the job
        throw createError;
      }
    } else if (parseResult.data.sourceType === 'greenhouse') {
      const { greenhouse } = parseResult.data;

      // Fetch HTML from Greenhouse URL
      const fetchResponse = await fetch(greenhouse.url);

      if (!fetchResponse.ok) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to fetch Greenhouse job: ${fetchResponse.statusText}`,
          },
          { status: 502 }
        );
      }

      const html = await fetchResponse.text();

      // Extract job data from HTML
      let jobData;
      try {
        jobData = extractGreenhouseJob(html, greenhouse.url);
      } catch (extractError) {
        return NextResponse.json(
          {
            success: false,
            error:
              extractError instanceof Error
                ? extractError.message
                : 'Failed to parse Greenhouse job',
          },
          { status: 400 }
        );
      }

      // Convert HTML description to clean text
      const descriptionClean = htmlToTextClean(jobData.descriptionHtml);

      // Generate dedupe key for Greenhouse job
      const dedupeKey = dedupeKeyForPosting({
        sourceType: 'greenhouse',
        sourceKey: jobData.jobId,
      });

      // Check if job already exists with this dedupe key
      const existingJob = await prisma.jobPosting.findUnique({
        where: { dedupeKey },
      });

      // If job exists, return existing ID (conservative deduplication)
      if (existingJob) {
        return NextResponse.json(
          {
            success: true,
            jobId: existingJob.id,
          },
          { status: 200 }
        );
      }

      // Create JobSource first
      const jobSource = await prisma.jobSource.create({
        data: {
          url: greenhouse.url,
          atsType: 'greenhouse',
        },
      });

      // Create JobPosting
      try {
        const jobPosting = await prisma.jobPosting.create({
          data: {
            dedupeKey,
            title: jobData.title,
            company: jobData.companyName,
            location: jobData.location || null,
            description: descriptionClean,
            applyUrl: jobData.applyUrl,
            status: 'new',
            jobSourceId: jobSource.id,
            sourceKey: jobData.jobId,
          },
        });

        return NextResponse.json(
          {
            success: true,
            jobId: jobPosting.id,
          },
          { status: 200 }
        );
      } catch (createError) {
        // Handle race condition where job was created between our check and insert
        if (
          createError instanceof Prisma.PrismaClientKnownRequestError &&
          createError.code === 'P2002'
        ) {
          // Unique constraint violation - fetch and return existing job
          const raceJob = await prisma.jobPosting.findUnique({
            where: { dedupeKey },
          });

          if (raceJob) {
            return NextResponse.json(
              {
                success: true,
                jobId: raceJob.id,
              },
              { status: 200 }
            );
          }
        }

        // Re-throw if it's not a duplicate key error or we can't find the job
        throw createError;
      }
    } else if (parseResult.data.sourceType === 'generic_url') {
      const { generic_url } = parseResult.data;

      // Fetch HTML from generic URL
      const fetchResponse = await fetch(generic_url.url);

      if (!fetchResponse.ok) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to fetch job page: ${fetchResponse.statusText}`,
          },
          { status: 502 }
        );
      }

      const html = await fetchResponse.text();

      // Extract job data from HTML
      let jobData;
      try {
        jobData = extractGenericJob(html, generic_url.url);
      } catch (extractError) {
        return NextResponse.json(
          {
            success: false,
            error:
              extractError instanceof Error
                ? extractError.message
                : 'Failed to parse job page',
          },
          { status: 400 }
        );
      }

      // Determine company name: user-provided > extracted > error
      const companyName = generic_url.companyName || jobData.companyName;

      if (!companyName) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Company name could not be extracted from the page. Please provide it manually using the companyName field.',
          },
          { status: 400 }
        );
      }

      // Convert HTML description to clean text
      const descriptionClean = jobData.descriptionHtml
        ? htmlToTextClean(jobData.descriptionHtml)
        : '';

      // Generate dedupe key for generic URL job (based on normalized fields)
      const dedupeKey = dedupeKeyForPosting({
        sourceType: 'generic',
        companyName,
        title: jobData.title,
        location: jobData.location,
      });

      // Check if job already exists with this dedupe key
      const existingJob = await prisma.jobPosting.findUnique({
        where: { dedupeKey },
      });

      // If job exists, return existing ID (conservative deduplication)
      if (existingJob) {
        return NextResponse.json(
          {
            success: true,
            jobId: existingJob.id,
          },
          { status: 200 }
        );
      }

      // Create JobSource first
      const jobSource = await prisma.jobSource.create({
        data: {
          url: generic_url.url,
          atsType: 'generic',
        },
      });

      // Create JobPosting
      try {
        const jobPosting = await prisma.jobPosting.create({
          data: {
            dedupeKey,
            title: jobData.title,
            company: companyName,
            location: jobData.location || null,
            description: descriptionClean,
            applyUrl: jobData.applyUrl,
            status: 'new',
            jobSourceId: jobSource.id,
            sourceKey: null, // Generic URLs don't have a sourceKey
          },
        });

        return NextResponse.json(
          {
            success: true,
            jobId: jobPosting.id,
          },
          { status: 200 }
        );
      } catch (createError) {
        // Handle race condition where job was created between our check and insert
        if (
          createError instanceof Prisma.PrismaClientKnownRequestError &&
          createError.code === 'P2002'
        ) {
          // Unique constraint violation - fetch and return existing job
          const raceJob = await prisma.jobPosting.findUnique({
            where: { dedupeKey },
          });

          if (raceJob) {
            return NextResponse.json(
              {
                success: true,
                jobId: raceJob.id,
              },
              { status: 200 }
            );
          }
        }

        // Re-throw if it's not a duplicate key error or we can't find the job
        throw createError;
      }
    }

    // This should never be reached due to discriminated union validation
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid source type',
      },
      { status: 400 }
    );
  } catch (error) {
    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
        },
        { status: 400 }
      );
    }

    // Handle unexpected errors
    console.error('Error ingesting job:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
