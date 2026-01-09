import { describe, it, expect } from 'vitest';
import {
  ManualJobIngestInputSchema,
  GreenhouseJobIngestInputSchema,
  JobIngestRequestSchema,
  JobIngestResponseSchema,
  normalizeWhitespace,
  generateDedupeKey,
} from './ingest';

describe('ManualJobIngestInputSchema', () => {
  it('accepts valid manual job input', () => {
    const validInput = {
      companyName: 'Acme Corp',
      title: 'Senior Engineer',
      location: 'San Francisco, CA',
      description: 'We are looking for a senior engineer...',
    };

    const result = ManualJobIngestInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('accepts input without optional location', () => {
    const validInput = {
      companyName: 'Acme Corp',
      title: 'Senior Engineer',
      description: 'We are looking for a senior engineer...',
    };

    const result = ManualJobIngestInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects missing companyName', () => {
    const invalidInput = {
      title: 'Senior Engineer',
      description: 'We are looking for a senior engineer...',
    };

    const result = ManualJobIngestInputSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('rejects empty companyName', () => {
    const invalidInput = {
      companyName: '',
      title: 'Senior Engineer',
      description: 'We are looking for a senior engineer...',
    };

    const result = ManualJobIngestInputSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('rejects missing title', () => {
    const invalidInput = {
      companyName: 'Acme Corp',
      description: 'We are looking for a senior engineer...',
    };

    const result = ManualJobIngestInputSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('rejects missing description', () => {
    const invalidInput = {
      companyName: 'Acme Corp',
      title: 'Senior Engineer',
    };

    const result = ManualJobIngestInputSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });
});

describe('JobIngestRequestSchema', () => {
  it('accepts valid manual ingest request', () => {
    const validRequest = {
      sourceType: 'manual' as const,
      manual: {
        companyName: 'Acme Corp',
        title: 'Senior Engineer',
        location: 'Remote',
        description: 'Great job description',
      },
    };

    const result = JobIngestRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it('rejects invalid sourceType', () => {
    const invalidRequest = {
      sourceType: 'automated',
      manual: {
        companyName: 'Acme Corp',
        title: 'Senior Engineer',
        description: 'Great job description',
      },
    };

    const result = JobIngestRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it('rejects missing manual object', () => {
    const invalidRequest = {
      sourceType: 'manual',
    };

    const result = JobIngestRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it('accepts valid greenhouse ingest request', () => {
    const validRequest = {
      sourceType: 'greenhouse' as const,
      greenhouse: {
        url: 'https://boards.greenhouse.io/acmecorp/jobs/123456',
      },
    };

    const result = JobIngestRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it('rejects greenhouse request with invalid URL', () => {
    const invalidRequest = {
      sourceType: 'greenhouse',
      greenhouse: {
        url: 'not-a-url',
      },
    };

    const result = JobIngestRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it('rejects greenhouse request with missing url', () => {
    const invalidRequest = {
      sourceType: 'greenhouse',
      greenhouse: {},
    };

    const result = JobIngestRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it('accepts valid generic_url ingest request', () => {
    const validRequest = {
      sourceType: 'generic_url' as const,
      generic_url: {
        url: 'https://company.com/careers/job-123',
      },
    };

    const result = JobIngestRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it('accepts generic_url request with optional companyName', () => {
    const validRequest = {
      sourceType: 'generic_url' as const,
      generic_url: {
        url: 'https://company.com/careers/job-123',
        companyName: 'Acme Corp',
      },
    };

    const result = JobIngestRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it('rejects generic_url request with invalid URL', () => {
    const invalidRequest = {
      sourceType: 'generic_url',
      generic_url: {
        url: 'not-a-url',
      },
    };

    const result = JobIngestRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it('rejects generic_url request with missing url', () => {
    const invalidRequest = {
      sourceType: 'generic_url',
      generic_url: {},
    };

    const result = JobIngestRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });
});

describe('GreenhouseJobIngestInputSchema', () => {
  it('accepts valid greenhouse URL', () => {
    const validInput = {
      url: 'https://boards.greenhouse.io/company/jobs/123',
    };

    const result = GreenhouseJobIngestInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects invalid URL', () => {
    const invalidInput = {
      url: 'not-a-url',
    };

    const result = GreenhouseJobIngestInputSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('rejects missing URL', () => {
    const invalidInput = {};

    const result = GreenhouseJobIngestInputSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });
});

describe('JobIngestResponseSchema', () => {
  it('accepts valid response', () => {
    const validResponse = {
      success: true,
      jobId: '550e8400-e29b-41d4-a716-446655440000',
    };

    const result = JobIngestResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID', () => {
    const invalidResponse = {
      success: true,
      jobId: 'not-a-uuid',
    };

    const result = JobIngestResponseSchema.safeParse(invalidResponse);
    expect(result.success).toBe(false);
  });
});

describe('normalizeWhitespace', () => {
  it('trims leading and trailing whitespace', () => {
    const input = '  hello world  ';
    expect(normalizeWhitespace(input)).toBe('hello world');
  });

  it('collapses multiple spaces into single space', () => {
    const input = 'hello    world    test';
    expect(normalizeWhitespace(input)).toBe('hello world test');
  });

  it('normalizes multiple line breaks', () => {
    const input = 'hello\n\n\nworld';
    expect(normalizeWhitespace(input)).toBe('hello\nworld');
  });

  it('handles mixed whitespace', () => {
    const input = '  hello   world  \n\n  test  ';
    expect(normalizeWhitespace(input)).toBe('hello world\ntest');
  });

  it('handles empty string', () => {
    expect(normalizeWhitespace('')).toBe('');
  });
});

describe('generateDedupeKey', () => {
  it('generates key from company and title', () => {
    const key = generateDedupeKey('Acme Corp', 'Senior Engineer');
    expect(key).toBe('acmecorp-seniorengineer');
  });

  it('removes special characters', () => {
    const key = generateDedupeKey('Acme & Co.', 'Senior Engineer (Remote)');
    expect(key).toBe('acmeco-seniorengineerremote');
  });

  it('handles multiple spaces', () => {
    const key = generateDedupeKey('Acme   Corp', 'Senior    Engineer');
    expect(key).toBe('acmecorp-seniorengineer');
  });

  it('handles mixed case', () => {
    const key = generateDedupeKey('AcMe CoRp', 'SeNiOr EnGiNeEr');
    expect(key).toBe('acmecorp-seniorengineer');
  });

  it('removes leading/trailing hyphens', () => {
    const key = generateDedupeKey('  Acme  ', '  Engineer  ');
    expect(key).toBe('acme-engineer');
  });

  it('creates unique keys for different jobs', () => {
    const key1 = generateDedupeKey('Acme Corp', 'Senior Engineer');
    const key2 = generateDedupeKey('Acme Corp', 'Junior Engineer');
    const key3 = generateDedupeKey('Tech Corp', 'Senior Engineer');

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key2).not.toBe(key3);
  });

  it('creates same key for equivalent inputs', () => {
    const key1 = generateDedupeKey('Acme Corp', 'Senior Engineer');
    const key2 = generateDedupeKey('ACME CORP', 'senior engineer');
    const key3 = generateDedupeKey('Acme  Corp', 'Senior  Engineer');

    expect(key1).toBe(key2);
    expect(key1).toBe(key3);
  });
});
