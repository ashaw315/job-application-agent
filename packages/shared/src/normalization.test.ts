import { describe, it, expect } from 'vitest';
import { normalizeTitle, normalizeLocation, dedupeKeyForPosting } from './normalization';

describe('normalizeTitle', () => {
  it('converts to lowercase', () => {
    expect(normalizeTitle('Senior Engineer')).toBe('senior engineer');
    expect(normalizeTitle('SENIOR ENGINEER')).toBe('senior engineer');
  });

  it('strips punctuation', () => {
    expect(normalizeTitle('Senior Engineer!')).toBe('senior engineer');
    expect(normalizeTitle('Senior, Engineer')).toBe('senior engineer');
    expect(normalizeTitle('Senior - Engineer')).toBe('senior engineer');
    expect(normalizeTitle('Senior/Engineer')).toBe('senior engineer');
  });

  it('collapses whitespace', () => {
    expect(normalizeTitle('Senior   Engineer')).toBe('senior engineer');
    expect(normalizeTitle('  Senior Engineer  ')).toBe('senior engineer');
    expect(normalizeTitle('Senior\nEngineer')).toBe('senior engineer');
  });

  it('maps roman numeral synonyms', () => {
    expect(normalizeTitle('Engineer II')).toBe('engineer 2');
    expect(normalizeTitle('Engineer III')).toBe('engineer 3');
    expect(normalizeTitle('Engineer IV')).toBe('engineer 4');
    expect(normalizeTitle('Level II Engineer')).toBe('level 2 engineer');
  });

  it('handles complex titles', () => {
    expect(normalizeTitle('Senior Engineer, II (Remote)')).toBe('senior engineer 2 remote');
    expect(normalizeTitle('Full-Stack Developer III')).toBe('full stack developer 3');
  });

  it('handles empty string', () => {
    expect(normalizeTitle('')).toBe('');
  });

  it('preserves numbers', () => {
    expect(normalizeTitle('Level 2 Engineer')).toBe('level 2 engineer');
    expect(normalizeTitle('L5 Software Engineer')).toBe('l5 software engineer');
  });
});

describe('normalizeLocation', () => {
  it('converts to lowercase', () => {
    expect(normalizeLocation('San Francisco, CA')).toBe('san francisco, ca');
    expect(normalizeLocation('NEW YORK')).toBe('new york');
  });

  it('trims whitespace', () => {
    expect(normalizeLocation('  San Francisco  ')).toBe('san francisco');
  });

  it('converts empty string to "unknown"', () => {
    expect(normalizeLocation('')).toBe('unknown');
  });

  it('converts whitespace-only to "unknown"', () => {
    expect(normalizeLocation('   ')).toBe('unknown');
  });

  it('converts null/undefined to "unknown"', () => {
    expect(normalizeLocation(null)).toBe('unknown');
    expect(normalizeLocation(undefined)).toBe('unknown');
  });

  it('preserves commas and basic punctuation', () => {
    expect(normalizeLocation('San Francisco, CA')).toBe('san francisco, ca');
    expect(normalizeLocation('New York, NY, USA')).toBe('new york, ny, usa');
  });
});

describe('dedupeKeyForPosting', () => {
  describe('greenhouse with sourceKey', () => {
    it('generates greenhouse-prefixed key with job ID', () => {
      const key = dedupeKeyForPosting({
        sourceType: 'greenhouse',
        sourceKey: '123456',
        companyName: 'Acme Corp',
        title: 'Senior Engineer',
        location: 'San Francisco',
      });
      expect(key).toBe('greenhouse:123456');
    });

    it('uses sourceKey even if other fields differ', () => {
      const key1 = dedupeKeyForPosting({
        sourceType: 'greenhouse',
        sourceKey: '123456',
        companyName: 'Acme Corp',
        title: 'Senior Engineer',
        location: 'San Francisco',
      });

      const key2 = dedupeKeyForPosting({
        sourceType: 'greenhouse',
        sourceKey: '123456',
        companyName: 'Different Corp',
        title: 'Different Title',
        location: 'Different Location',
      });

      expect(key1).toBe(key2);
      expect(key1).toBe('greenhouse:123456');
    });
  });

  describe('manual or missing sourceKey', () => {
    it('generates sha256 hash for manual jobs', () => {
      const key = dedupeKeyForPosting({
        sourceType: 'manual',
        companyName: 'Acme Corp',
        title: 'Senior Engineer',
        location: 'San Francisco',
      });

      // Should be a valid hex string
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });

    it('generates same hash for identical normalized input', () => {
      const key1 = dedupeKeyForPosting({
        sourceType: 'manual',
        companyName: 'Acme Corp',
        title: 'Senior Engineer',
        location: 'San Francisco',
      });

      const key2 = dedupeKeyForPosting({
        sourceType: 'manual',
        companyName: 'Acme Corp',
        title: 'Senior Engineer',
        location: 'San Francisco',
      });

      expect(key1).toBe(key2);
    });

    it('generates same hash when normalization produces same result', () => {
      const key1 = dedupeKeyForPosting({
        sourceType: 'manual',
        companyName: 'Acme Corp',
        title: 'Senior Engineer',
        location: 'San Francisco',
      });

      const key2 = dedupeKeyForPosting({
        sourceType: 'manual',
        companyName: 'ACME CORP',
        title: 'SENIOR ENGINEER',
        location: 'SAN FRANCISCO',
      });

      expect(key1).toBe(key2);
    });

    it('generates same hash when title has punctuation differences', () => {
      const key1 = dedupeKeyForPosting({
        sourceType: 'manual',
        companyName: 'Acme Corp',
        title: 'Senior Engineer',
        location: 'San Francisco',
      });

      const key2 = dedupeKeyForPosting({
        sourceType: 'manual',
        companyName: 'Acme Corp',
        title: 'Senior, Engineer!',
        location: 'San Francisco',
      });

      expect(key1).toBe(key2);
    });

    it('generates different hash for different titles', () => {
      const key1 = dedupeKeyForPosting({
        sourceType: 'manual',
        companyName: 'Acme Corp',
        title: 'Senior Engineer',
        location: 'San Francisco',
      });

      const key2 = dedupeKeyForPosting({
        sourceType: 'manual',
        companyName: 'Acme Corp',
        title: 'Junior Engineer',
        location: 'San Francisco',
      });

      expect(key1).not.toBe(key2);
    });

    it('generates different hash for different locations', () => {
      const key1 = dedupeKeyForPosting({
        sourceType: 'manual',
        companyName: 'Acme Corp',
        title: 'Senior Engineer',
        location: 'San Francisco',
      });

      const key2 = dedupeKeyForPosting({
        sourceType: 'manual',
        companyName: 'Acme Corp',
        title: 'Senior Engineer',
        location: 'New York',
      });

      expect(key1).not.toBe(key2);
    });

    it('generates different hash for different companies', () => {
      const key1 = dedupeKeyForPosting({
        sourceType: 'manual',
        companyName: 'Acme Corp',
        title: 'Senior Engineer',
        location: 'San Francisco',
      });

      const key2 = dedupeKeyForPosting({
        sourceType: 'manual',
        companyName: 'TechStart Inc',
        title: 'Senior Engineer',
        location: 'San Francisco',
      });

      expect(key1).not.toBe(key2);
    });

    it('treats missing location as "unknown"', () => {
      const key1 = dedupeKeyForPosting({
        sourceType: 'manual',
        companyName: 'Acme Corp',
        title: 'Senior Engineer',
        location: '',
      });

      const key2 = dedupeKeyForPosting({
        sourceType: 'manual',
        companyName: 'Acme Corp',
        title: 'Senior Engineer',
        location: null,
      });

      expect(key1).toBe(key2);
    });

    it('uses roman numeral normalization in hash', () => {
      const key1 = dedupeKeyForPosting({
        sourceType: 'manual',
        companyName: 'Acme Corp',
        title: 'Engineer II',
        location: 'Remote',
      });

      const key2 = dedupeKeyForPosting({
        sourceType: 'manual',
        companyName: 'Acme Corp',
        title: 'Engineer 2',
        location: 'Remote',
      });

      expect(key1).toBe(key2);
    });
  });

  describe('greenhouse without sourceKey', () => {
    it('falls back to sha256 hash when sourceKey is missing', () => {
      const key = dedupeKeyForPosting({
        sourceType: 'greenhouse',
        companyName: 'Acme Corp',
        title: 'Senior Engineer',
        location: 'San Francisco',
      });

      // Should be a valid hex string (sha256), not greenhouse:undefined
      expect(key).toMatch(/^[a-f0-9]{64}$/);
      expect(key).not.toContain('greenhouse:');
    });
  });
});
