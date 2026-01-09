import { describe, it, expect } from 'vitest';
import { JobPostingIdSchema, RunnerPacketSchema, RunnerReportSchema } from './schemas';

describe('JobPostingIdSchema', () => {
  it('accepts valid UUID string', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';
    const result = JobPostingIdSchema.safeParse(validUuid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(validUuid);
    }
  });

  it('rejects invalid UUID string', () => {
    const invalidUuid = 'not-a-uuid';
    const result = JobPostingIdSchema.safeParse(invalidUuid);
    expect(result.success).toBe(false);
  });

  it('rejects non-string values', () => {
    const result = JobPostingIdSchema.safeParse(12345);
    expect(result.success).toBe(false);
  });

  it('rejects malformed UUID', () => {
    const malformedUuid = '550e8400-e29b-41d4-a716';
    const result = JobPostingIdSchema.safeParse(malformedUuid);
    expect(result.success).toBe(false);
  });
});

describe('RunnerPacketSchema', () => {
  it('accepts valid complete packet', () => {
    const validPacket = {
      jobPostingId: '550e8400-e29b-41d4-a716-446655440000',
      applyUrl: 'https://example.com/apply',
      userProfile: {
        name: 'Test User',
        email: 'test@example.com',
        phone: '555-1234',
      },
      materials: {
        resumeText: 'Test resume content',
        coverLetterText: 'Test cover letter content',
      },
      allowedAnswers: {
        workAuthorization: 'US_CITIZEN',
        location: 'San Francisco, CA',
        willingToRelocate: true,
      },
    };
    const result = RunnerPacketSchema.safeParse(validPacket);
    expect(result.success).toBe(true);
  });

  it('rejects packet missing required fields', () => {
    const result = RunnerPacketSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('RunnerReportSchema', () => {
  it('accepts valid complete report', () => {
    const validReport = {
      jobPostingId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'stopped_before_submit',
      errors: [],
      warnings: [],
      artifacts: [],
    };
    const result = RunnerReportSchema.safeParse(validReport);
    expect(result.success).toBe(true);
  });

  it('rejects report missing required fields', () => {
    const result = RunnerReportSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
