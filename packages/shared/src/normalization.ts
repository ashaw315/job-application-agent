import { createHash } from 'crypto';

/**
 * Normalize job title for deduplication
 * - Converts to lowercase
 * - Strips punctuation (replaces with spaces)
 * - Collapses whitespace
 * - Maps roman numerals to numbers (II -> 2, III -> 3, IV -> 4)
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\bii\b/g, '2') // Roman numeral II -> 2
    .replace(/\biii\b/g, '3') // Roman numeral III -> 3
    .replace(/\biv\b/g, '4') // Roman numeral IV -> 4
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces (keep alphanumeric and whitespace)
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

/**
 * Normalize location for deduplication
 * - Converts to lowercase
 * - Trims whitespace
 * - Empty/null/undefined becomes "unknown"
 */
export function normalizeLocation(location: string | null | undefined): string {
  if (!location || location.trim() === '') {
    return 'unknown';
  }
  return location.toLowerCase().trim();
}

/**
 * Input for dedupe key generation
 */
export interface DedupeKeyInput {
  sourceType: 'manual' | 'greenhouse' | 'generic';
  sourceKey?: string; // Job ID for greenhouse
  companyName: string;
  title: string;
  location?: string | null;
}

/**
 * Generate dedupe key for job posting
 *
 * Logic:
 * - If greenhouse + sourceKey exists: "greenhouse:<sourceKey>"
 * - Otherwise: sha256(companyName + "::" + normalizedTitle + "::" + normalizedLocation)
 *
 * Conservative deduplication: only exact key match will dedupe.
 */
export function dedupeKeyForPosting(input: DedupeKeyInput): string {
  // Greenhouse with sourceKey uses the greenhouse job ID as dedupe key
  if (input.sourceType === 'greenhouse' && input.sourceKey) {
    return `greenhouse:${input.sourceKey}`;
  }

  // For manual or greenhouse without sourceKey, use hash of normalized fields
  const normalizedTitle = normalizeTitle(input.title);
  const normalizedLocation = normalizeLocation(input.location);
  const companyLower = input.companyName.toLowerCase().trim();

  const hashInput = `${companyLower}::${normalizedTitle}::${normalizedLocation}`;

  return createHash('sha256').update(hashInput).digest('hex');
}
