import { describe, it, expect } from 'vitest';
import {
  validateResumeVariant,
  extractNumbers,
  extractTechTerms,
  extractScopeKeywords,
} from './validation';

describe('extractNumbers', () => {
  it('extracts numbers from text', () => {
    expect(extractNumbers('Improved performance by 50%')).toEqual(['50']);
    expect(extractNumbers('Led team of 5 engineers')).toEqual(['5']);
    expect(extractNumbers('Reduced latency from 200ms to 50ms')).toEqual(['200', '50']);
  });

  it('handles text with no numbers', () => {
    expect(extractNumbers('Built a web application')).toEqual([]);
  });

  it('handles decimal numbers', () => {
    expect(extractNumbers('Achieved 99.9% uptime')).toEqual(['99.9']);
  });
});

describe('extractTechTerms', () => {
  it('extracts tech terms from tags', () => {
    const terms = extractTechTerms(['typescript', 'react', 'nodejs']);
    expect(terms).toContain('typescript');
    expect(terms).toContain('react');
    expect(terms).toContain('nodejs');
  });

  it('normalizes to lowercase', () => {
    const terms = extractTechTerms(['TypeScript', 'React', 'Node.js']);
    expect(terms).toContain('typescript');
    expect(terms).toContain('react');
  });

  it('handles empty tags', () => {
    expect(extractTechTerms([])).toEqual([]);
  });
});

describe('extractScopeKeywords', () => {
  it('finds scope escalation keywords', () => {
    expect(extractScopeKeywords('Led a team of engineers')).toContain('led');
    expect(extractScopeKeywords('Owned the entire project')).toContain('owned');
    expect(extractScopeKeywords('Managed infrastructure')).toContain('managed');
  });

  it('is case insensitive', () => {
    expect(extractScopeKeywords('LED the team')).toContain('led');
    expect(extractScopeKeywords('OWNED the project')).toContain('owned');
  });

  it('returns empty for text without scope keywords', () => {
    expect(extractScopeKeywords('Built a web application')).toEqual([]);
  });
});

describe('validateResumeVariant', () => {
  it('passes when numbers are unchanged', () => {
    const result = validateResumeVariant({
      originalBullet: {
        text: 'Improved performance by 50%',
        tags: ['optimization'],
      },
      generatedVariant: 'Enhanced system performance by 50%',
      allowedTechTerms: ['optimization'],
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when numbers are changed', () => {
    const result = validateResumeVariant({
      originalBullet: {
        text: 'Improved performance by 50%',
        tags: ['optimization'],
      },
      generatedVariant: 'Enhanced system performance by 75%',
      allowedTechTerms: ['optimization'],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        type: 'number_changed',
        message: expect.stringContaining('Numbers changed'),
      })
    );
  });

  it('fails when new tech terms are introduced', () => {
    const result = validateResumeVariant({
      originalBullet: {
        text: 'Built web application with React',
        tags: ['react', 'web'],
      },
      generatedVariant: 'Built web application with React and Kubernetes',
      allowedTechTerms: ['react', 'web'],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        type: 'new_tech_term',
        message: expect.stringContaining('kubernetes'),
      })
    );
  });

  it('passes when tech terms are from allowed dictionary', () => {
    const result = validateResumeVariant({
      originalBullet: {
        text: 'Built web application',
        tags: ['web'],
      },
      generatedVariant: 'Built web application using TypeScript',
      allowedTechTerms: ['web', 'typescript'],
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when scope escalation keywords are added', () => {
    const result = validateResumeVariant({
      originalBullet: {
        text: 'Built features for the platform',
        tags: ['development'],
      },
      generatedVariant: 'Led the development of platform features',
      allowedTechTerms: ['development'],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        type: 'scope_escalation',
        message: expect.stringContaining('led'),
      })
    );
  });

  it('passes when scope keywords were in original', () => {
    const result = validateResumeVariant({
      originalBullet: {
        text: 'Led team of 5 engineers',
        tags: ['leadership'],
      },
      generatedVariant: 'Led a team of 5 software engineers',
      allowedTechTerms: ['leadership'],
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('collects multiple errors', () => {
    const result = validateResumeVariant({
      originalBullet: {
        text: 'Built application with React',
        tags: ['react'],
      },
      generatedVariant: 'Led development of application with Kubernetes, improving performance by 90%',
      allowedTechTerms: ['react'],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it('handles missing numbers in variant', () => {
    const result = validateResumeVariant({
      originalBullet: {
        text: 'Reduced latency by 50%',
        tags: ['performance'],
      },
      generatedVariant: 'Reduced system latency significantly',
      allowedTechTerms: ['performance'],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        type: 'number_changed',
      })
    );
  });
});
