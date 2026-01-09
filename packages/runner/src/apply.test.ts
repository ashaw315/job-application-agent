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
const TEST_PACKET: RunnerPacket = {
  jobPostingId: 'test-job-123',
  applyUrl: `${FIXTURE_URL}/jobs/simple-form`,
  userProfile: {
    name: 'Test User',
    email: 'test@example.com',
    phone: '+1234567890',
  },
  materials: {
    resumeText: 'Test resume content',
    coverLetterText: 'Test cover letter content',
  },
  allowedAnswers: {},
};

beforeAll(async () => {
  // Start fixture server
  const simpleFormPath = join(__dirname, 'fixtures', 'simple-form.html');
  const simpleFormHtml = await readFile(simpleFormPath, 'utf-8');

  fixtureServer = createServer((req, res) => {
    if (req.url === '/jobs/simple-form') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(simpleFormHtml);
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

  // Start mock API server to serve test packet
  mockApiServer = createServer((req, res) => {
    if (req.url === '/api/runner/packets/test-job-123') {
      // Check authorization header
      const auth = req.headers.authorization;
      if (!auth || auth !== 'Bearer test-api-key') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, packet: TEST_PACKET }));
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
  it('should fetch packet, navigate to fixture, take screenshot, and stop before submit', async () => {
    const config: RunnerConfig = {
      RUNNER_APP_BASE_URL: 'http://localhost:3458',
      RUNNER_API_KEY: 'test-api-key',
      RUNNER_ARTIFACT_DIR: TEST_ARTIFACT_DIR,
      RUNNER_HEADLESS: true,
    };

    const report = await applyToJob('test-job-123', config);

    // Should complete with stopped_before_submit status
    expect(report.status).toBe('stopped_before_submit');
    expect(report.jobPostingId).toBe('test-job-123');

    // Should have no errors
    expect(report.errors).toEqual([]);

    // Should have artifacts
    expect(report.artifacts.length).toBeGreaterThan(0);

    // Should have screenshot artifact
    const screenshotArtifact = report.artifacts.find((a) => a.type === 'screenshot');
    expect(screenshotArtifact).toBeDefined();
    expect(screenshotArtifact?.filePath).toBeDefined();

    // Verify screenshot file exists
    if (screenshotArtifact?.filePath) {
      await expect(access(screenshotArtifact.filePath)).resolves.toBeUndefined();
    }

    // Should have HTML artifact
    const htmlArtifact = report.artifacts.find((a) => a.type === 'html');
    expect(htmlArtifact).toBeDefined();
    expect(htmlArtifact?.filePath).toBeDefined();

    // Verify HTML file exists and does NOT show submission
    if (htmlArtifact?.filePath) {
      await expect(access(htmlArtifact.filePath)).resolves.toBeUndefined();

      const htmlContent = await readFile(htmlArtifact.filePath, 'utf-8');

      // The submission flag should NOT be visible or set
      expect(htmlContent).toContain('data-submitted="false"');
      expect(htmlContent).toContain('display: none'); // Flag should be hidden

      // Verify form elements are present (we loaded the page correctly)
      expect(htmlContent).toContain('Submit Application');
      expect(htmlContent).toContain('type="submit"');
    }

    // Should have stopped reason
    expect(report.stoppedReason).toBeDefined();
    expect(report.stoppedReason).toContain('submit');
  }, 30000); // 30 second timeout for browser operations

  it('should handle missing packet gracefully', async () => {
    const config: RunnerConfig = {
      RUNNER_APP_BASE_URL: 'http://localhost:3458',
      RUNNER_API_KEY: 'test-api-key',
      RUNNER_ARTIFACT_DIR: TEST_ARTIFACT_DIR,
      RUNNER_HEADLESS: true,
    };

    const report = await applyToJob('nonexistent-job', config);

    // Should fail
    expect(report.status).toBe('failed');
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors[0]).toContain('Failed to fetch packet');
  });

  it('should handle unauthorized request gracefully', async () => {
    const config: RunnerConfig = {
      RUNNER_APP_BASE_URL: 'http://localhost:3458',
      RUNNER_API_KEY: 'wrong-key',
      RUNNER_ARTIFACT_DIR: TEST_ARTIFACT_DIR,
      RUNNER_HEADLESS: true,
    };

    const report = await applyToJob('test-job-123', config);

    // Should fail
    expect(report.status).toBe('failed');
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors[0]).toContain('Failed to fetch packet');
  });
});
