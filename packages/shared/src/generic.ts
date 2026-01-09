/**
 * Generic job posting data extracted from HTML
 */
export interface GenericJobData {
  title: string;
  companyName?: string;
  location?: string;
  descriptionHtml?: string;
  applyUrl: string;
}

/**
 * Extract job data from generic HTML page (best-effort)
 *
 * Strategy:
 * - title: <title> tag, fallback to first <h1>
 * - companyName: og:site_name meta tag (optional)
 * - location: text matching location patterns in job meta areas
 * - descriptionHtml: content from <main> or <article> or <body>
 * - applyUrl: first link with "apply" in href/text, fallback to original URL
 */
export function extractGenericJob(html: string, url: string): GenericJobData {
  // Extract title from <title> tag
  let title: string | undefined;
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  if (titleMatch) {
    title = titleMatch[1].trim();

    // If title is generic (just "Careers", "Jobs", etc.), try h1
    const genericTitles = ['careers', 'jobs', 'job openings', 'opportunities'];
    if (genericTitles.includes(title.toLowerCase())) {
      title = undefined;
    }
  }

  // Fallback to h1 if no valid title
  if (!title) {
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
    if (h1Match) {
      title = h1Match[1].replace(/<[^>]+>/g, '').trim();
    }
  }

  if (!title) {
    throw new Error('Could not extract job title from page');
  }

  // Extract company name from og:site_name
  let companyName: string | undefined;
  const ogSiteNameMatch = html.match(
    /<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i
  );
  if (ogSiteNameMatch) {
    companyName = ogSiteNameMatch[1].trim();
  }

  // Extract location from common patterns
  let location: string | undefined;

  // Try class="location" or similar
  const locationClassMatch = html.match(
    /<(?:div|span|p)[^>]*class=["'][^"']*location[^"']*["'][^>]*>(.*?)<\/(?:div|span|p)>/is
  );
  if (locationClassMatch) {
    location = locationClassMatch[1].replace(/<[^>]+>/g, '').trim();
  }

  // Try "Location:" label pattern
  if (!location) {
    const locationLabelMatch = html.match(
      /<(?:strong|b)>Location:?<\/(?:strong|b)>\s*([^<]+)/i
    );
    if (locationLabelMatch) {
      location = locationLabelMatch[1].trim();
    }
  }

  // Extract description from <main>, <article>, or largest content block
  let descriptionHtml: string | undefined;

  // Try <main> first
  const mainMatch = html.match(/<main[^>]*>(.*?)<\/main>/is);
  if (mainMatch) {
    descriptionHtml = mainMatch[1].trim();
  }

  // Fallback to <article>
  if (!descriptionHtml) {
    const articleMatch = html.match(/<article[^>]*>(.*?)<\/article>/is);
    if (articleMatch) {
      descriptionHtml = articleMatch[1].trim();
    }
  }

  // Fallback to .main-content class (more specific than .content)
  if (!descriptionHtml) {
    const mainContentMatch = html.match(
      /<div[^>]*class=["'][^"']*main-content[^"']*["'][^>]*>(.*?)<\/div>/is
    );
    if (mainContentMatch) {
      descriptionHtml = mainContentMatch[1].trim();
    }
  }

  // Fallback to .content class
  if (!descriptionHtml) {
    const contentClassMatch = html.match(
      /<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>(.*?)<\/div>/is
    );
    if (contentClassMatch) {
      descriptionHtml = contentClassMatch[1].trim();
    }
  }

  // Last resort: get body content
  if (!descriptionHtml) {
    const bodyMatch = html.match(/<body[^>]*>(.*?)<\/body>/is);
    if (bodyMatch) {
      descriptionHtml = bodyMatch[1].trim();
    }
  }

  // Extract apply URL - look for links with "apply" in href or text
  let applyUrl: string = url; // Default to original URL

  // Try to find link with "apply" in text content
  const applyTextLinkMatch = html.match(
    /<a[^>]+href=["']([^"']+)["'][^>]*>[^<]*apply[^<]*<\/a>/is
  );
  if (applyTextLinkMatch) {
    applyUrl = applyTextLinkMatch[1];
  } else {
    // Try href with "apply" in it
    const applyHrefMatch = html.match(/<a[^>]+href=["']([^"']*apply[^"']*)["']/i);
    if (applyHrefMatch) {
      applyUrl = applyHrefMatch[1];
    }
  }

  return {
    title,
    companyName,
    location,
    descriptionHtml,
    applyUrl,
  };
}
