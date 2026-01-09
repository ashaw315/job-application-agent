import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { extractGreenhouseJob, htmlToTextClean } from './greenhouse';

describe('extractGreenhouseJob', () => {
  it('extracts job data from standard greenhouse HTML', () => {
    const html = readFileSync(
      join(__dirname, '../test/fixtures/greenhouse/standard-job.html'),
      'utf-8'
    );
    const url = 'https://boards.greenhouse.io/acmecorp/jobs/4567890';

    const result = extractGreenhouseJob(html, url);

    expect(result.jobId).toBe('4567890');
    expect(result.title).toBe('Senior Software Engineer');
    expect(result.location).toBe('San Francisco, CA');
    expect(result.companyName).toBe('acmecorp');
    expect(result.applyUrl).toBe('https://boards.greenhouse.io/acmecorp/jobs/4567890');
    expect(result.descriptionHtml).toContain('About the Role');
    expect(result.descriptionHtml).toContain('Design and implement scalable backend systems');
    expect(result.descriptionHtml).toContain('Requirements');
  });

  it('extracts job data when location is missing', () => {
    const html = readFileSync(
      join(__dirname, '../test/fixtures/greenhouse/no-location-job.html'),
      'utf-8'
    );
    const url = 'https://boards.greenhouse.io/techstartinc/jobs/7654321';

    const result = extractGreenhouseJob(html, url);

    expect(result.jobId).toBe('7654321');
    expect(result.title).toBe('Backend Engineer');
    expect(result.location).toBeNull();
    expect(result.companyName).toBe('techstartinc');
    expect(result.applyUrl).toBe('https://boards.greenhouse.io/techstartinc/jobs/7654321');
    expect(result.descriptionHtml).toContain('TechStart Inc');
  });

  it('extracts company name from URL', () => {
    const html = readFileSync(
      join(__dirname, '../test/fixtures/greenhouse/standard-job.html'),
      'utf-8'
    );

    const result1 = extractGreenhouseJob(html, 'https://boards.greenhouse.io/acmecorp/jobs/123');
    expect(result1.companyName).toBe('acmecorp');

    const result2 = extractGreenhouseJob(html, 'https://boards.greenhouse.io/mycompany/jobs/456');
    expect(result2.companyName).toBe('mycompany');
  });

  it('extracts jobId from data attribute', () => {
    const html = readFileSync(
      join(__dirname, '../test/fixtures/greenhouse/standard-job.html'),
      'utf-8'
    );
    const url = 'https://boards.greenhouse.io/acmecorp/jobs/4567890';

    const result = extractGreenhouseJob(html, url);

    expect(result.jobId).toBe('4567890');
  });

  it('throws error if jobId cannot be extracted', () => {
    const html = '<html><body>Invalid HTML</body></html>';
    const url = 'https://boards.greenhouse.io/company/jobs/123';

    expect(() => extractGreenhouseJob(html, url)).toThrow('Failed to extract job ID from Greenhouse page');
  });

  it('throws error if title cannot be extracted', () => {
    const html = `
      <html>
        <body>
          <div id="job_application_form_data" data-job-id="123"></div>
        </body>
      </html>
    `;
    const url = 'https://boards.greenhouse.io/company/jobs/123';

    expect(() => extractGreenhouseJob(html, url)).toThrow('Failed to extract job title from Greenhouse page');
  });
});

describe('htmlToTextClean', () => {
  it('converts HTML to clean text', () => {
    const html = '<p>This is a paragraph.</p><p>Another paragraph.</p>';
    const result = htmlToTextClean(html);

    expect(result).toContain('This is a paragraph.');
    expect(result).toContain('Another paragraph.');
  });

  it('preserves line breaks between elements', () => {
    const html = '<h3>Header</h3><p>Paragraph</p><ul><li>Item 1</li><li>Item 2</li></ul>';
    const result = htmlToTextClean(html);

    expect(result).toContain('Header');
    expect(result).toContain('Paragraph');
    expect(result).toContain('Item 1');
    expect(result).toContain('Item 2');
    expect(result.split('\n').length).toBeGreaterThan(1);
  });

  it('removes script and style tags', () => {
    const html = '<p>Content</p><script>alert("test")</script><style>.test{}</style>';
    const result = htmlToTextClean(html);

    expect(result).toContain('Content');
    expect(result).not.toContain('alert');
    expect(result).not.toContain('.test');
  });

  it('decodes HTML entities', () => {
    const html = '<p>We&apos;re hiring &amp; looking for talent!</p>';
    const result = htmlToTextClean(html);

    expect(result).toContain("We're hiring & looking for talent!");
  });

  it('collapses excessive whitespace', () => {
    const html = '<p>Too     many    spaces</p>';
    const result = htmlToTextClean(html);

    expect(result).toContain('Too many spaces');
    expect(result).not.toMatch(/\s{2,}/);
  });

  it('handles empty or whitespace-only HTML', () => {
    expect(htmlToTextClean('')).toBe('');
    expect(htmlToTextClean('   ')).toBe('');
    expect(htmlToTextClean('<p>  </p>')).toBe('');
  });

  it('converts lists to readable format', () => {
    const html = '<ul><li>First item</li><li>Second item</li></ul>';
    const result = htmlToTextClean(html);

    expect(result).toContain('First item');
    expect(result).toContain('Second item');
  });
});
