import { z } from 'zod';

/**
 * Manual job ingest input from user
 */
export const ManualJobIngestInputSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  title: z.string().min(1, 'Job title is required'),
  location: z.string().optional(),
  description: z.string().min(1, 'Job description is required'),
});

export type ManualJobIngestInput = z.infer<typeof ManualJobIngestInputSchema>;

/**
 * Job ingest request payload
 */
export const JobIngestRequestSchema = z.object({
  sourceType: z.literal('manual'),
  manual: ManualJobIngestInputSchema,
});

export type JobIngestRequest = z.infer<typeof JobIngestRequestSchema>;

/**
 * Job ingest response
 */
export const JobIngestResponseSchema = z.object({
  success: z.boolean(),
  jobId: z.string().uuid(),
});

export type JobIngestResponse = z.infer<typeof JobIngestResponseSchema>;

/**
 * Normalize whitespace in text
 * - Trim leading/trailing whitespace
 * - Collapse multiple spaces into single space
 * - Normalize line breaks (collapse multiple line breaks to single)
 */
export function normalizeWhitespace(text: string): string {
  return text
    .trim()
    .replace(/[ \t]+/g, ' ') // Collapse spaces/tabs to single space
    .replace(/\n\s*\n+/g, '\n') // Collapse multiple line breaks to single
    .replace(/[ \t]*\n[ \t]*/g, '\n'); // Remove spaces around line breaks
}

/**
 * Generate dedupe key for manual job posting
 * Format: lowercase(company)-lowercase(title-words)
 * Example: "acme corp" + "Senior Engineer" -> "acmecorp-seniorengineer"
 */
export function generateDedupeKey(company: string, title: string): string {
  const normalizeForKey = (str: string): string =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric
      .trim();

  const companyKey = normalizeForKey(company);
  const titleKey = normalizeForKey(title);

  return `${companyKey}-${titleKey}`;
}
