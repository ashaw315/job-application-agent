import { describe, it, expect } from 'vitest';
import { buildCoverLetterPrompt, buildResumeVariantPrompt } from './prompts';

describe('buildCoverLetterPrompt', () => {
  it('includes job title and company', () => {
    const prompt = buildCoverLetterPrompt({
      job: {
        title: 'Senior Software Engineer',
        company: 'Tech Corp',
        description: 'Build awesome software',
      },
      selectedBullets: [],
      userProfile: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    });

    expect(prompt).toContain('Senior Software Engineer');
    expect(prompt).toContain('Tech Corp');
  });

  it('includes selected KB bullets with tags', () => {
    const prompt = buildCoverLetterPrompt({
      job: {
        title: 'Backend Engineer',
        company: 'Startup Inc',
        description: 'Node.js and PostgreSQL',
      },
      selectedBullets: [
        {
          id: 'bullet-1',
          text: 'Built scalable APIs with Node.js',
          tags: ['nodejs', 'backend'],
        },
        {
          id: 'bullet-2',
          text: 'Optimized PostgreSQL queries',
          tags: ['postgresql', 'database'],
        },
      ],
      userProfile: {
        name: 'Jane Smith',
        email: 'jane@example.com',
      },
    });

    expect(prompt).toContain('Built scalable APIs with Node.js');
    expect(prompt).toContain('Optimized PostgreSQL queries');
    expect(prompt).toContain('nodejs');
    expect(prompt).toContain('postgresql');
  });

  it('includes guardrails about not inventing experience', () => {
    const prompt = buildCoverLetterPrompt({
      job: {
        title: 'Engineer',
        company: 'Company',
        description: 'Description',
      },
      selectedBullets: [],
      userProfile: {
        name: 'Test User',
        email: 'test@example.com',
      },
    });

    expect(prompt.toLowerCase()).toContain('do not invent');
    expect(prompt.toLowerCase()).toContain('only use');
  });

  it('includes user profile name', () => {
    const prompt = buildCoverLetterPrompt({
      job: {
        title: 'Engineer',
        company: 'Company',
        description: 'Description',
      },
      selectedBullets: [],
      userProfile: {
        name: 'Alice Johnson',
        email: 'alice@example.com',
      },
    });

    expect(prompt).toContain('Alice Johnson');
  });

  it('handles empty selected bullets', () => {
    const prompt = buildCoverLetterPrompt({
      job: {
        title: 'Engineer',
        company: 'Company',
        description: 'Description',
      },
      selectedBullets: [],
      userProfile: {
        name: 'Test User',
        email: 'test@example.com',
      },
    });

    expect(prompt).toBeTruthy();
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('formats bullets as numbered list', () => {
    const prompt = buildCoverLetterPrompt({
      job: {
        title: 'Engineer',
        company: 'Company',
        description: 'Description',
      },
      selectedBullets: [
        {
          id: 'bullet-1',
          text: 'First experience',
          tags: ['tag1'],
        },
        {
          id: 'bullet-2',
          text: 'Second experience',
          tags: ['tag2'],
        },
      ],
      userProfile: {
        name: 'Test User',
        email: 'test@example.com',
      },
    });

    expect(prompt).toMatch(/1\./);
    expect(prompt).toMatch(/2\./);
  });
});

describe('buildResumeVariantPrompt', () => {
  it('includes job title and company', () => {
    const prompt = buildResumeVariantPrompt({
      job: {
        title: 'Backend Engineer',
        company: 'Tech Corp',
        description: 'Build scalable systems',
      },
      selectedBullets: [],
    });

    expect(prompt).toContain('Backend Engineer');
    expect(prompt).toContain('Tech Corp');
  });

  it('includes selected bullets with tags', () => {
    const prompt = buildResumeVariantPrompt({
      job: {
        title: 'Engineer',
        company: 'Company',
        description: 'Description',
      },
      selectedBullets: [
        {
          id: 'bullet-1',
          text: 'Built APIs with Node.js',
          tags: ['nodejs', 'backend'],
        },
        {
          id: 'bullet-2',
          text: 'Optimized database queries',
          tags: ['postgresql', 'performance'],
        },
      ],
    });

    expect(prompt).toContain('Built APIs with Node.js');
    expect(prompt).toContain('Optimized database queries');
    expect(prompt).toContain('nodejs');
    expect(prompt).toContain('postgresql');
  });

  it('includes strict guardrails about numbers', () => {
    const prompt = buildResumeVariantPrompt({
      job: {
        title: 'Engineer',
        company: 'Company',
        description: 'Description',
      },
      selectedBullets: [],
    });

    expect(prompt.toLowerCase()).toContain('never change numbers');
    expect(prompt.toLowerCase()).toContain('metrics');
  });

  it('includes guardrails about tech terms', () => {
    const prompt = buildResumeVariantPrompt({
      job: {
        title: 'Engineer',
        company: 'Company',
        description: 'Description',
      },
      selectedBullets: [],
    });

    expect(prompt.toLowerCase()).toContain('tech');
    expect(prompt.toLowerCase()).toContain('tools');
  });

  it('includes guardrails about scope escalation', () => {
    const prompt = buildResumeVariantPrompt({
      job: {
        title: 'Engineer',
        company: 'Company',
        description: 'Description',
      },
      selectedBullets: [],
    });

    expect(prompt.toLowerCase()).toContain('led');
    expect(prompt.toLowerCase()).toContain('owned');
  });

  it('emphasizes light rewriting only', () => {
    const prompt = buildResumeVariantPrompt({
      job: {
        title: 'Engineer',
        company: 'Company',
        description: 'Description',
      },
      selectedBullets: [],
    });

    expect(prompt.toLowerCase()).toContain('light');
    // Check for rewriting or rewritten
    const hasRewrite = prompt.toLowerCase().includes('rewriting') ||
                       prompt.toLowerCase().includes('rewritten');
    expect(hasRewrite).toBe(true);
  });
});
