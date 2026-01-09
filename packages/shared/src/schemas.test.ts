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
  it('accepts valid empty packet', () => {
    const result = RunnerPacketSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('RunnerReportSchema', () => {
  it('accepts valid empty report', () => {
    const result = RunnerReportSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
