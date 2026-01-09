/**
 * Greenhouse job extraction result
 */
export interface GreenhouseJobData {
  jobId: string;
  companyName: string;
  title: string;
  location: string | null;
  descriptionHtml: string;
  applyUrl: string;
}

/**
 * Extract job data from Greenhouse HTML page
 *
 * @param html - Raw HTML content from Greenhouse job page
 * @param url - Original URL of the job page
 * @returns Extracted job data
 * @throws Error if required fields cannot be extracted
 */
export function extractGreenhouseJob(html: string, url: string): GreenhouseJobData {
  // Extract company name from URL
  // URL format: https://boards.greenhouse.io/{companyName}/jobs/{jobId}
  const urlMatch = url.match(/greenhouse\.io\/([^/]+)\/jobs/);
  if (!urlMatch) {
    throw new Error('Invalid Greenhouse URL format');
  }
  const companyName = urlMatch[1];

  // Extract job ID from data attribute
  const jobIdMatch = html.match(/data-job-id=["'](\d+)["']/);
  if (!jobIdMatch) {
    throw new Error('Failed to extract job ID from Greenhouse page');
  }
  const jobId = jobIdMatch[1];

  // Extract title from h1 in header
  const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
  if (!titleMatch) {
    throw new Error('Failed to extract job title from Greenhouse page');
  }
  const title = titleMatch[1].trim();

  // Extract location (optional)
  const locationMatch = html.match(/<div[^>]*class=["']location["'][^>]*>(.*?)<\/div>/s);
  const location = locationMatch ? locationMatch[1].trim() : null;

  // Extract job description HTML
  const descriptionMatch = html.match(/<div[^>]*id=["']job-description["'][^>]*>(.*?)<\/div>/s);
  if (!descriptionMatch) {
    throw new Error('Failed to extract job description from Greenhouse page');
  }
  const descriptionHtml = descriptionMatch[1].trim();

  // Apply URL is the same as the job page URL for Greenhouse
  const applyUrl = url;

  return {
    jobId,
    companyName,
    title,
    location,
    descriptionHtml,
    applyUrl,
  };
}

/**
 * Convert HTML to clean text
 *
 * - Removes script and style tags
 * - Converts block elements to line breaks
 * - Decodes HTML entities
 * - Collapses excessive whitespace
 *
 * @param html - HTML string
 * @returns Clean text content
 */
export function htmlToTextClean(html: string): string {
  if (!html || !html.trim()) {
    return '';
  }

  let text = html;

  // Remove script and style tags with their content
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Convert block-level elements to line breaks
  text = text.replace(/<\/?(div|p|br|h1|h2|h3|h4|h5|h6|li|tr)[^>]*>/gi, '\n');

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&apos;/g, "'");

  // Collapse multiple spaces into one
  text = text.replace(/ {2,}/g, ' ');

  // Collapse multiple line breaks into maximum of 2
  text = text.replace(/\n{3,}/g, '\n\n');

  // Trim each line
  text = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

  return text.trim();
}
