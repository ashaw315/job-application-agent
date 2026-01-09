import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { applyToJob } from './apply.js';
import { createServer, type Server } from 'http';
import { readFile, rm, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { RunnerConfig } from './config.js';
import type { RunnerPacket } from '@job-application-agent/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURE_PORT = 3457;
const FIXTURE_URL = `http://localhost:${FIXTURE_PORT}`;
const TEST_ARTIFACT_DIR = './test-artifacts';

let fixtureServer: Server | null = null;
let mockApiServer: Server | null = null;

// Mock packet for testing
const createTestPacket = (applyUrl: string): RunnerPacket => ({
  jobPostingId: 'test-job-123',
  applyUrl,
  userProfile: {
    name: 'Test User',
    email: 'test@example.com',
    phone: '+1234567890',
  },
  materials: {
    resumeText: 'Test resume content with relevant experience.',
    coverLetterText: 'Dear Hiring Manager, I am excited to apply for this position.',
  },
  allowedAnswers: {
    workAuthorization: 'US_CITIZEN',
  },
});

beforeAll(async () => {
  // Start fixture server - serve all fixture forms
  const fixturesDir = join(__dirname, 'fixtures');

  fixtureServer = createServer(async (req, res) => {
    const routes: Record<string, string> = {
      '/jobs/simple-form': 'simple-form.html',
      '/jobs/complete-form': 'complete-form.html',
      '/jobs/no-cover-letter': 'no-cover-letter-form.html',
      '/jobs/ambiguous-form': 'ambiguous-form.html',
      '/jobs/no-resume': 'no-resume-form.html',
    };

    const filename = routes[req.url || ''];
    if (filename) {
      try {
        const html = await readFile(join(fixturesDir, filename), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      } catch (error) {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  await new Promise<void>((resolve) => {
    fixtureServer!.listen(FIXTURE_PORT, () => {
      console.log(`Test fixture server started on port ${FIXTURE_PORT}`);
      resolve();
    });
  });

  // Start mock API server to serve test packets
  mockApiServer = createServer((req, res) => {
    // Check authorization header
    const auth = req.headers.authorization;
    if (!auth || auth !== 'Bearer test-api-key') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
      return;
    }

    // Route different job IDs to different fixtures
    if (req.url === '/api/runner/packets/complete-job') {
      const packet = createTestPacket(`${FIXTURE_URL}/jobs/complete-form`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, packet }));
    } else if (req.url === '/api/runner/packets/no-cover-letter-job') {
      const packet = createTestPacket(`${FIXTURE_URL}/jobs/no-cover-letter`);
      packet.jobPostingId = 'no-cover-letter-job';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, packet }));
    } else if (req.url === '/api/runner/packets/ambiguous-job') {
      const packet = createTestPacket(`${FIXTURE_URL}/jobs/ambiguous-form`);
      packet.jobPostingId = 'ambiguous-job';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, packet }));
    } else if (req.url === '/api/runner/packets/no-resume-job') {
      const packet = createTestPacket(`${FIXTURE_URL}/jobs/no-resume`);
      packet.jobPostingId = 'no-resume-job';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, packet }));
    } else if (req.url === '/api/runner/packets/test-job-123') {
      // Legacy simple form for backwards compatibility
      const packet = createTestPacket(`${FIXTURE_URL}/jobs/simple-form`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, packet }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Not Found' }));
    }
  });

  await new Promise<void>((resolve) => {
    mockApiServer!.listen(3458, () => {
      console.log('Mock API server started on port 3458');
      resolve();
    });
  });
});

afterAll(async () => {
  // Close servers
  if (fixtureServer) {
    await new Promise<void>((resolve) => {
      fixtureServer!.close(() => resolve());
    });
  }

  if (mockApiServer) {
    await new Promise<void>((resolve) => {
      mockApiServer!.close(() => resolve());
    });
  }

  // Clean up test artifacts
  try {
    await rm(TEST_ARTIFACT_DIR, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
});

describe('Runner Integration Tests', () => {
  const config: RunnerConfig = {
    RUNNER_APP_BASE_URL: 'http://localhost:3458',
    RUNNER_API_KEY: 'test-api-key',
    RUNNER_ARTIFACT_DIR: TEST_ARTIFACT_DIR,
    RUNNER_HEADLESS: true,
    RUNNER_POST_RESULTS: false, // Don't post in tests
  };

  it('should fill complete form, upload files, answer work auth, and stop before submit', async () => {
    const report = await applyToJob('complete-job', config);

    // Should complete with stopped_before_submit status
    expect(report.status).toBe('stopped_before_submit');
    expect(report.jobPostingId).toBe('complete-job');

    // Should have no errors
    expect(report.errors).toEqual([]);

    // Should have multiple screenshots (initial, after-uploads, before-stop)
    const screenshots = report.artifacts.filter((a) => a.type === 'screenshot');
    expect(screenshots.length).toBeGreaterThanOrEqual(3);

    // Verify screenshots exist
    for (const screenshot of screenshots) {
      await expect(access(screenshot.filePath!)).resolves.toBeUndefined();
    }

    // Should have HTML artifacts (DOM snapshots)
    const htmlArtifacts = report.artifacts.filter((a) => a.type === 'html');
    expect(htmlArtifacts.length).toBeGreaterThan(0);

    // Verify final DOM does NOT show submission
    const finalDom = htmlArtifacts[htmlArtifacts.length - 1];
    const htmlContent = await readFile(finalDom.filePath!, 'utf-8');
    expect(htmlContent).toContain('data-submitted="false"');

    // Should have stopped reason
    expect(report.stoppedReason).toBeDefined();
    expect(report.stoppedReason).toContain('submit');
  }, 30000);

  it('should handle missing cover letter upload with warning but continue', async () => {
    const report = await applyToJob('no-cover-letter-job', config);

    // Should still complete successfully
    expect(report.status).toBe('stopped_before_submit');
    expect(report.jobPostingId).toBe('no-cover-letter-job');

    // Should have no errors (cover letter is optional)
    expect(report.errors).toEqual([]);

    // Should have warning about missing cover letter
    expect(report.warnings.length).toBeGreaterThan(0);
    const coverLetterWarning = report.warnings.find((w) =>
      w.toLowerCase().includes('cover letter')
    );
    expect(coverLetterWarning).toBeDefined();

    // Should still have all screenshots
    const screenshots = report.artifacts.filter((a) => a.type === 'screenshot');
    expect(screenshots.length).toBeGreaterThanOrEqual(3);
  }, 30000);

  it('should warn about ambiguous questions but still complete', async () => {
    const report = await applyToJob('ambiguous-job', config);

    // Should complete successfully
    expect(report.status).toBe('stopped_before_submit');
    expect(report.jobPostingId).toBe('ambiguous-job');

    // Should have no errors
    expect(report.errors).toEqual([]);

    // Should have warning about ambiguous question
    expect(report.warnings.length).toBeGreaterThan(0);
    const ambiguousWarning = report.warnings.find((w) =>
      w.toLowerCase().includes('ambiguous')
    );
    expect(ambiguousWarning).toBeDefined();

    // Should have stopped before submit
    expect(report.stoppedReason).toContain('submit');
  }, 30000);

  it('should fail with critical error when resume upload is missing', async () => {
    const report = await applyToJob('no-resume-job', config);

    // Should fail with critical error
    expect(report.status).toBe('critical_error');
    expect(report.jobPostingId).toBe('no-resume-job');

    // Should have error about missing resume
    expect(report.errors.length).toBeGreaterThan(0);
    const resumeError = report.errors.find((e) =>
      e.toLowerCase().includes('resume')
    );
    expect(resumeError).toBeDefined();
    expect(resumeError).toContain('CRITICAL');

    // Should still have error artifacts
    const screenshots = report.artifacts.filter((a) => a.type === 'screenshot');
    expect(screenshots.length).toBeGreaterThan(0);

    const errorScreenshot = screenshots.find((a) =>
      a.description?.toLowerCase().includes('error')
    );
    expect(errorScreenshot).toBeDefined();

    // Should have trace artifact on critical error
    const traceArtifact = report.artifacts.find((a) =>
      a.filePath?.includes('trace')
    );
    expect(traceArtifact).toBeDefined();
  }, 30000);

  it('should handle missing packet gracefully', async () => {
    const report = await applyToJob('nonexistent-job', config);

    // Should fail with critical error
    expect(report.status).toBe('critical_error');
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors[0]).toContain('Failed to fetch packet');
  });

  it('should handle unauthorized request gracefully', async () => {
    const wrongConfig: RunnerConfig = {
      ...config,
      RUNNER_API_KEY: 'wrong-key',
    };

    const report = await applyToJob('complete-job', wrongConfig);

    // Should fail with critical error
    expect(report.status).toBe('critical_error');
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors[0]).toContain('Failed to fetch packet');
  });
});
