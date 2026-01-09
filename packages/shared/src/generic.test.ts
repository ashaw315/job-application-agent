import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { extractGenericJob } from './generic';

describe('extractGenericJob', () => {
  it('extracts job data from semantic HTML page', () => {
    const html = readFileSync(
      join(__dirname, '../test/fixtures/generic/semantic-page.html'),
      'utf-8'
    );
    const url = 'https://techcorp.com/careers/full-stack-engineer';

    const result = extractGenericJob(html, url);

    expect(result.title).toBe('Full Stack Engineer - TechCorp');
    expect(result.companyName).toBe('TechCorp Careers');
    expect(result.location).toBe('Remote - USA');
    expect(result.descriptionHtml).toContain('Full Stack Engineer');
    expect(result.descriptionHtml).toContain('cutting-edge web applications');
    expect(result.applyUrl).toBe('https://techcorp.com/careers/apply/12345');
  });

  it('extracts job data from basic HTML page', () => {
    const html = readFileSync(
      join(__dirname, '../test/fixtures/generic/basic-page.html'),
      'utf-8'
    );
    const url = 'https://startupxyz.com/jobs/data-scientist';

    const result = extractGenericJob(html, url);

    expect(result.title).toBe('Data Scientist at StartupXYZ');
    expect(result.companyName).toBeUndefined(); // No og:site_name or clear meta
    expect(result.location).toBe('San Francisco, CA');
    expect(result.descriptionHtml).toContain('Data Scientist');
    expect(result.descriptionHtml).toContain('AI-powered analytics tools');
    expect(result.applyUrl).toBe('/jobs/apply?id=98765');
  });

  it('falls back to h1 when title is generic', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Careers</title></head>
      <body>
        <main>
          <h1>Senior Product Manager</h1>
          <p>We are hiring a Senior Product Manager to lead our product initiatives.</p>
        </main>
      </body>
      </html>
    `;
    const url = 'https://example.com/jobs/pm';

    const result = extractGenericJob(html, url);

    expect(result.title).toBe('Senior Product Manager');
    expect(result.descriptionHtml).toContain('product initiatives');
  });

  it('uses original URL as applyUrl when no apply link found', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Backend Developer</title></head>
      <body>
        <main>
          <h1>Backend Developer</h1>
          <p>Join our backend team.</p>
        </main>
      </body>
      </html>
    `;
    const url = 'https://example.com/careers/backend-dev';

    const result = extractGenericJob(html, url);

    expect(result.applyUrl).toBe('https://example.com/careers/backend-dev');
  });

  it('extracts location from common patterns', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Frontend Engineer</title></head>
      <body>
        <main>
          <h1>Frontend Engineer</h1>
          <div class="location">New York, NY</div>
          <p>Build amazing UIs.</p>
        </main>
      </body>
      </html>
    `;
    const url = 'https://example.com/jobs/frontend';

    const result = extractGenericJob(html, url);

    expect(result.location).toBe('New York, NY');
  });

  it('returns non-empty title and description', () => {
    const html = readFileSync(
      join(__dirname, '../test/fixtures/generic/semantic-page.html'),
      'utf-8'
    );
    const url = 'https://techcorp.com/careers/job';

    const result = extractGenericJob(html, url);

    expect(result.title).toBeTruthy();
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.descriptionHtml).toBeTruthy();
    expect(result.descriptionHtml!.length).toBeGreaterThan(0);
  });

  it('throws error when title cannot be extracted', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head></head>
      <body><p>Some text</p></body>
      </html>
    `;
    const url = 'https://example.com/job';

    expect(() => extractGenericJob(html, url)).toThrow('Could not extract job title');
  });

  it('extracts companyName from og:site_name meta tag', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta property="og:site_name" content="Amazing Company">
        <title>Job Opening</title>
      </head>
      <body>
        <main>
          <h1>Software Engineer</h1>
          <p>Great opportunity</p>
        </main>
      </body>
      </html>
    `;
    const url = 'https://example.com/jobs/swe';

    const result = extractGenericJob(html, url);

    expect(result.companyName).toBe('Amazing Company');
  });

  it('extracts description from main tag', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>DevOps Engineer</title></head>
      <body>
        <header>Navigation</header>
        <main>
          <h1>DevOps Engineer</h1>
          <p>We need a DevOps engineer to manage our infrastructure.</p>
          <p>This is the main job description content.</p>
        </main>
        <footer>Footer content</footer>
      </body>
      </html>
    `;
    const url = 'https://example.com/jobs/devops';

    const result = extractGenericJob(html, url);

    expect(result.descriptionHtml).toContain('DevOps engineer');
    expect(result.descriptionHtml).toContain('infrastructure');
    expect(result.descriptionHtml).not.toContain('Navigation');
    expect(result.descriptionHtml).not.toContain('Footer content');
  });
});
