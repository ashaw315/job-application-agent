import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
vi.mock('@prisma/client', () => {
  const mockPrisma = {
    $queryRaw: vi.fn(),
  };
  return {
    PrismaClient: vi.fn(() => mockPrisma),
  };
});

describe('GET /api/health', () => {
  let mockPrisma: any;
  const originalRedisUrl = process.env.REDIS_URL;
  const originalRunnerApiKey = process.env.RUNNER_API_KEY;

  beforeEach(() => {
    // Get the mocked prisma instance
    mockPrisma = new PrismaClient();
    vi.clearAllMocks();

    // Reset REDIS_URL to undefined for most tests
    delete process.env.REDIS_URL;

    // Reset RUNNER_API_KEY to ensure tests work without it
    delete process.env.RUNNER_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();

    // Restore original REDIS_URL
    if (originalRedisUrl !== undefined) {
      process.env.REDIS_URL = originalRedisUrl;
    } else {
      delete process.env.REDIS_URL;
    }

    // Restore original RUNNER_API_KEY
    if (originalRunnerApiKey !== undefined) {
      process.env.RUNNER_API_KEY = originalRunnerApiKey;
    } else {
      delete process.env.RUNNER_API_KEY;
    }
  });

  it('returns ok status when database is healthy', async () => {
    // Mock successful DB query
    mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.database).toBe('ok');
    expect(data.timestamp).toBeDefined();
    expect(data.version).toBeDefined();
    expect(data.queueModeEnabled).toBe(false);
  });

  it('returns database error status when query fails', async () => {
    // Mock DB query failure
    mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

    const response = await GET();
    const data = await response.json();

    // Still returns 200 for v0 local dev friendliness
    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.database).toBe('error');
    expect(data.timestamp).toBeDefined();
    expect(data.version).toBeDefined();
  });

  it('returns queueModeEnabled true when Redis is configured', async () => {
    // Set REDIS_URL env var
    process.env.REDIS_URL = 'redis://localhost:6379';

    mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.queueModeEnabled).toBe(true);
  });

  it('includes timestamp in ISO format', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

    const response = await GET();
    const data = await response.json();

    // Verify timestamp is valid ISO 8601
    const timestamp = new Date(data.timestamp);
    expect(timestamp.toISOString()).toBe(data.timestamp);
  });

  it('includes version from package.json', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

    const response = await GET();
    const data = await response.json();

    // Version should be a string (either from package.json or default 'v0')
    expect(typeof data.version).toBe('string');
    expect(data.version.length).toBeGreaterThan(0);
  });

  it('returns all required fields', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

    const response = await GET();
    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('queueModeEnabled');
    expect(data).toHaveProperty('database');

    // Verify types
    expect(typeof data.status).toBe('string');
    expect(typeof data.timestamp).toBe('string');
    expect(typeof data.version).toBe('string');
    expect(typeof data.queueModeEnabled).toBe('boolean');
    expect(['ok', 'error']).toContain(data.database);
  });

  it('works without RUNNER_API_KEY set (regression test)', async () => {
    // Explicitly ensure RUNNER_API_KEY is not set
    delete process.env.RUNNER_API_KEY;

    mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

    // This should not throw due to env validation
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.database).toBe('ok');
  });
});
