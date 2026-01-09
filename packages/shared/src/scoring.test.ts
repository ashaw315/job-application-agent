import { describe, it, expect } from 'vitest';
import {
  extractKeywords,
  inferRoleType,
  inferSeniorityHint,
  inferRemoteType,
  computeFitScore,
  selectRelevantBullets,
  type JobForScoring,
  type KbBulletForScoring,
} from './scoring';

describe('extractKeywords', () => {
  it('extracts matching keywords from description', () => {
    const description = 'We need a TypeScript and React expert with Node.js experience';
    const keywords = extractKeywords(description);

    expect(keywords).toContain('typescript');
    expect(keywords).toContain('react');
    expect(keywords).toContain('node');
  });

  it('uses word boundaries to avoid partial matches', () => {
    const description = 'We use JavaScript and Java';
    const keywords = extractKeywords(description);

    expect(keywords).toContain('javascript');
    expect(keywords).toContain('java');
    // "java" shouldn't match "javascript"
    expect(keywords.filter((k) => k === 'java')).toHaveLength(1);
  });

  it('is case insensitive', () => {
    const description = 'TYPESCRIPT, React, node.js';
    const keywords = extractKeywords(description);

    expect(keywords).toContain('typescript');
    expect(keywords).toContain('react');
    expect(keywords).toContain('node');
  });

  it('returns empty array when no keywords match', () => {
    const description = 'No relevant skills mentioned here';
    const keywords = extractKeywords(description);

    expect(keywords).toEqual([]);
  });
});

describe('inferRoleType', () => {
  it('detects frontend roles', () => {
    expect(inferRoleType('Frontend Engineer')).toBe('frontend');
    expect(inferRoleType('Front-end Developer')).toBe('frontend');
    expect(inferRoleType('Front End Developer')).toBe('frontend');
  });

  it('detects backend roles', () => {
    expect(inferRoleType('Backend Engineer')).toBe('backend');
    expect(inferRoleType('Back-end Developer')).toBe('backend');
    expect(inferRoleType('Back End Engineer')).toBe('backend');
  });

  it('detects fullstack roles', () => {
    expect(inferRoleType('Fullstack Engineer')).toBe('fullstack');
    expect(inferRoleType('Full-stack Developer')).toBe('fullstack');
    expect(inferRoleType('Full Stack Engineer')).toBe('fullstack');
  });

  it('detects devops roles', () => {
    expect(inferRoleType('DevOps Engineer')).toBe('devops');
    expect(inferRoleType('SRE')).toBe('devops');
    expect(inferRoleType('SRE Engineer')).toBe('devops');
  });

  it('detects data roles', () => {
    expect(inferRoleType('Data Scientist')).toBe('data');
    expect(inferRoleType('ML Engineer')).toBe('data');
    expect(inferRoleType('Machine Learning Engineer')).toBe('data');
  });

  it('returns other for unrecognized roles', () => {
    expect(inferRoleType('Product Manager')).toBe('other');
    expect(inferRoleType('QA Engineer')).toBe('other');
  });
});

describe('inferSeniorityHint', () => {
  it('detects principal level', () => {
    expect(inferSeniorityHint('Principal Engineer')).toBe('principal');
    expect(inferSeniorityHint('Distinguished Engineer')).toBe('principal');
  });

  it('detects staff level', () => {
    expect(inferSeniorityHint('Staff Engineer')).toBe('staff');
    expect(inferSeniorityHint('Staff Software Engineer')).toBe('staff');
  });

  it('detects senior level', () => {
    expect(inferSeniorityHint('Senior Engineer')).toBe('senior');
    expect(inferSeniorityHint('Sr. Software Engineer')).toBe('senior');
  });

  it('detects junior level', () => {
    expect(inferSeniorityHint('Junior Engineer')).toBe('junior');
    expect(inferSeniorityHint('Jr. Developer')).toBe('junior');
    expect(inferSeniorityHint('Entry Level Engineer')).toBe('junior');
  });

  it('defaults to mid for no explicit seniority', () => {
    expect(inferSeniorityHint('Software Engineer')).toBe('mid');
    expect(inferSeniorityHint('Developer')).toBe('mid');
  });
});

describe('inferRemoteType', () => {
  it('detects remote', () => {
    expect(inferRemoteType('Remote')).toBe('remote');
    expect(inferRemoteType('Remote - USA')).toBe('remote');
    expect(inferRemoteType('Remote - Worldwide')).toBe('remote');
  });

  it('detects hybrid', () => {
    expect(inferRemoteType('Hybrid')).toBe('hybrid');
    expect(inferRemoteType('Hybrid - San Francisco')).toBe('hybrid');
  });

  it('defaults to onsite for specific locations', () => {
    expect(inferRemoteType('San Francisco, CA')).toBe('onsite');
    expect(inferRemoteType('New York, NY')).toBe('onsite');
  });

  it('defaults to onsite for null/undefined', () => {
    expect(inferRemoteType(null)).toBe('onsite');
    expect(inferRemoteType(undefined)).toBe('onsite');
  });
});

describe('computeFitScore', () => {
  it('calculates score based on keyword matches', () => {
    const job: JobForScoring = {
      title: 'Senior Software Engineer',
      company: 'Tech Corp',
      location: 'Remote',
      description:
        'We need a TypeScript expert with React and Node.js experience. Must know AWS and Docker.',
    };

    const kbBullets: KbBulletForScoring[] = [
      {
        id: '1',
        text: 'Built scalable web apps with TypeScript and React',
        tags: JSON.stringify(['typescript', 'react']),
      },
      {
        id: '2',
        text: 'Deployed microservices on AWS using Docker',
        tags: JSON.stringify(['aws', 'docker']),
      },
    ];

    const result = computeFitScore(job, kbBullets);

    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.bullets).toHaveLength(2);
    expect(result.breakdown.keywordMatches).toBeGreaterThan(0);
    expect(result.breakdown.seniorityBonus).toBe(10); // Senior role
    expect(result.breakdown.remoteBonus).toBe(5); // Remote
  });

  it('categorizes bullets based on keyword match strength', () => {
    const job: JobForScoring = {
      title: 'Fullstack Engineer',
      company: 'Startup',
      location: 'Hybrid',
      description:
        'Looking for TypeScript, React, and Node.js developer with PostgreSQL experience.',
    };

    const kbBullets: KbBulletForScoring[] = [
      {
        id: '1',
        text: 'Built apps with TypeScript, React, and Node.js',
        tags: '[]',
      },
      {
        id: '2',
        text: 'Worked with React and TypeScript',
        tags: '[]',
      },
      {
        id: '3',
        text: 'Used Python for data analysis',
        tags: '[]',
      },
    ];

    const result = computeFitScore(job, kbBullets);

    const strongBullets = result.bullets.filter((b) => b.category === 'strong');
    const partialBullets = result.bullets.filter((b) => b.category === 'partial');
    const gapBullets = result.bullets.filter((b) => b.category === 'gap');

    expect(strongBullets.length).toBe(1); // Bullet 1 has 3+ matches
    expect(partialBullets.length).toBe(1); // Bullet 2 has 2 matches
    expect(gapBullets.length).toBe(1); // Bullet 3 has 0 matches
  });

  it('includes evidence pointers in matched bullets', () => {
    const job: JobForScoring = {
      title: 'Backend Engineer',
      company: 'Tech Inc',
      description: 'Need Python and PostgreSQL skills',
    };

    const kbBullets: KbBulletForScoring[] = [
      {
        id: 'bullet-123',
        text: 'Developed Python APIs with PostgreSQL',
        tags: '[]',
      },
    ];

    const result = computeFitScore(job, kbBullets);

    expect(result.bullets[0].evidence).toContain('job:keyword:python');
    expect(result.bullets[0].evidence).toContain('job:keyword:postgresql');
    expect(result.bullets[0].evidence).toContain('kb:bullet:bullet-123');
  });

  it('applies role type bonus for preferred roles', () => {
    const fullstackJob: JobForScoring = {
      title: 'Fullstack Engineer',
      company: 'Startup',
      description: 'Fullstack development',
    };

    const backendJob: JobForScoring = {
      title: 'Backend Engineer',
      company: 'Startup',
      description: 'Backend development',
    };

    const frontendJob: JobForScoring = {
      title: 'Frontend Engineer',
      company: 'Startup',
      description: 'Frontend development',
    };

    const fullstackResult = computeFitScore(fullstackJob, []);
    const backendResult = computeFitScore(backendJob, []);
    const frontendResult = computeFitScore(frontendJob, []);

    expect(fullstackResult.breakdown.roleTypeBonus).toBe(10);
    expect(backendResult.breakdown.roleTypeBonus).toBe(10);
    expect(frontendResult.breakdown.roleTypeBonus).toBe(0);
  });

  it('caps total score at 100', () => {
    const job: JobForScoring = {
      title: 'Senior Staff Fullstack Engineer',
      company: 'Tech Corp',
      location: 'Remote',
      description:
        'TypeScript JavaScript React Node NodeJS Python Java Golang Rust SQL PostgreSQL MongoDB AWS Docker Kubernetes',
    };

    const kbBullets: KbBulletForScoring[] = Array.from({ length: 20 }, (_, i) => ({
      id: `${i}`,
      text: 'TypeScript React Node AWS Docker Kubernetes',
      tags: '[]',
    }));

    const result = computeFitScore(job, kbBullets);

    expect(result.score).toBe(100);
    expect(result.breakdown.total).toBe(100);
  });

  it('generates explanatory reasoning text', () => {
    const job: JobForScoring = {
      title: 'Senior Engineer',
      company: 'Corp',
      description: 'TypeScript and React',
    };

    const kbBullets: KbBulletForScoring[] = [
      { id: '1', text: 'TypeScript expert', tags: '[]' },
    ];

    const result = computeFitScore(job, kbBullets);

    expect(result.reasoning).toContain('matching keywords');
    expect(result.reasoning).toContain('Role type');
    expect(result.reasoning).toContain('Seniority');
    expect(result.reasoning).toContain('Remote');
  });

  it('handles empty KB bullets', () => {
    const job: JobForScoring = {
      title: 'Engineer',
      company: 'Corp',
      description: 'TypeScript',
    };

    const result = computeFitScore(job, []);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.bullets).toHaveLength(0);
    expect(result.breakdown.bulletMatches).toBe(0);
  });
});

describe('selectRelevantBullets', () => {
  it('ranks bullets by tag overlap with job keywords', () => {
    const jobKeywords = ['typescript', 'react', 'node'];

    const kbBullets: KbBulletForScoring[] = [
      {
        id: 'bullet-1',
        text: 'Built apps with TypeScript',
        tags: JSON.stringify(['typescript', 'javascript']),
      },
      {
        id: 'bullet-2',
        text: 'Worked with React and Node',
        tags: JSON.stringify(['react', 'node', 'typescript']),
      },
      {
        id: 'bullet-3',
        text: 'Python data analysis',
        tags: JSON.stringify(['python', 'data']),
      },
    ];

    const result = selectRelevantBullets({ jobKeywords, kbBullets, limit: 10 });

    expect(result.selectedBullets).toHaveLength(3);
    expect(result.selectedBullets[0].bulletId).toBe('bullet-2'); // 3 overlaps
    expect(result.selectedBullets[0].overlapScore).toBe(3);
    expect(result.selectedBullets[1].bulletId).toBe('bullet-1'); // 1 overlap
    expect(result.selectedBullets[1].overlapScore).toBe(1);
    expect(result.selectedBullets[2].bulletId).toBe('bullet-3'); // 0 overlaps
    expect(result.selectedBullets[2].overlapScore).toBe(0);
  });

  it('respects the limit parameter', () => {
    const jobKeywords = ['typescript', 'react'];

    const kbBullets: KbBulletForScoring[] = [
      {
        id: 'bullet-1',
        text: 'TypeScript',
        tags: JSON.stringify(['typescript']),
      },
      {
        id: 'bullet-2',
        text: 'React',
        tags: JSON.stringify(['react']),
      },
      {
        id: 'bullet-3',
        text: 'Node',
        tags: JSON.stringify(['node']),
      },
    ];

    const result = selectRelevantBullets({ jobKeywords, kbBullets, limit: 2 });

    expect(result.selectedBullets).toHaveLength(2);
  });

  it('uses stable ordering (overlap desc, then bulletId asc)', () => {
    const jobKeywords = ['typescript'];

    const kbBullets: KbBulletForScoring[] = [
      {
        id: 'bullet-c',
        text: 'TypeScript C',
        tags: JSON.stringify(['typescript']),
      },
      {
        id: 'bullet-a',
        text: 'TypeScript A',
        tags: JSON.stringify(['typescript']),
      },
      {
        id: 'bullet-b',
        text: 'TypeScript B',
        tags: JSON.stringify(['typescript']),
      },
    ];

    const result = selectRelevantBullets({ jobKeywords, kbBullets, limit: 10 });

    // All have same overlap, so should be sorted by bulletId asc
    expect(result.selectedBullets[0].bulletId).toBe('bullet-a');
    expect(result.selectedBullets[1].bulletId).toBe('bullet-b');
    expect(result.selectedBullets[2].bulletId).toBe('bullet-c');
  });

  it('handles bullets with no tags', () => {
    const jobKeywords = ['typescript'];

    const kbBullets: KbBulletForScoring[] = [
      {
        id: 'bullet-1',
        text: 'TypeScript',
        tags: JSON.stringify(['typescript']),
      },
      {
        id: 'bullet-2',
        text: 'No tags',
        tags: '[]',
      },
      {
        id: 'bullet-3',
        text: 'Invalid JSON',
        tags: 'invalid',
      },
    ];

    const result = selectRelevantBullets({ jobKeywords, kbBullets, limit: 10 });

    expect(result.selectedBullets).toHaveLength(3);
    expect(result.selectedBullets[0].bulletId).toBe('bullet-1');
    expect(result.selectedBullets[0].overlapScore).toBe(1);
    expect(result.selectedBullets[1].overlapScore).toBe(0);
    expect(result.selectedBullets[2].overlapScore).toBe(0);
  });

  it('is case insensitive for tag matching', () => {
    const jobKeywords = ['typescript', 'react'];

    const kbBullets: KbBulletForScoring[] = [
      {
        id: 'bullet-1',
        text: 'Mixed case tags',
        tags: JSON.stringify(['TypeScript', 'REACT']),
      },
    ];

    const result = selectRelevantBullets({ jobKeywords, kbBullets, limit: 10 });

    expect(result.selectedBullets[0].overlapScore).toBe(2);
  });

  it('returns job keywords in result', () => {
    const jobKeywords = ['typescript', 'react'];
    const kbBullets: KbBulletForScoring[] = [];

    const result = selectRelevantBullets({ jobKeywords, kbBullets, limit: 10 });

    expect(result.jobKeywords).toEqual(['typescript', 'react']);
  });
});
