import { chromium, type Browser, type Page } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { RunnerConfig } from './config.js';
import type { RunnerPacket, RunnerReport } from '@job-application-agent/shared';

/**
 * Fetch runner packet from the web app API
 */
async function fetchPacket(
  jobPostingId: string,
  config: RunnerConfig
): Promise<RunnerPacket> {
  const url = `${config.RUNNER_APP_BASE_URL}/api/runner/packets/${jobPostingId}`;

  console.log(`📦 Fetching packet from ${url}`);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.RUNNER_API_KEY}`,
    },
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      `Failed to fetch packet: ${response.status} ${response.statusText}${
        data.error ? ` - ${data.error}` : ''
      }`
    );
  }

  const data = (await response.json()) as {
    success: boolean;
    packet?: RunnerPacket;
  };

  if (!data.success || !data.packet) {
    throw new Error('Invalid packet response from API');
  }

  console.log(`✅ Packet fetched successfully`);
  return data.packet;
}

/**
 * Ensure artifact directory exists
 */
async function ensureArtifactDir(config: RunnerConfig): Promise<void> {
  try {
    await mkdir(config.RUNNER_ARTIFACT_DIR, { recursive: true });
  } catch (error) {
    console.warn(`⚠️  Could not create artifact directory: ${error}`);
  }
}

/**
 * Take a screenshot and save to artifacts
 */
async function takeScreenshot(
  page: Page,
  name: string,
  config: RunnerConfig
): Promise<string> {
  const filename = `${name}-${Date.now()}.png`;
  const filepath = join(config.RUNNER_ARTIFACT_DIR, filename);

  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 Screenshot saved: ${filepath}`);

  return filepath;
}

/**
 * Apply to a job posting
 * v0: Navigate, take screenshot, stop before submit
 */
export async function applyToJob(
  jobPostingId: string,
  config: RunnerConfig
): Promise<RunnerReport> {
  const report: RunnerReport = {
    jobPostingId,
    status: 'stopped_before_submit',
    errors: [],
    warnings: [],
    artifacts: [],
  };

  let browser: Browser | null = null;

  try {
    // Ensure artifact directory exists
    await ensureArtifactDir(config);

    // Fetch packet
    const packet = await fetchPacket(jobPostingId, config);
    console.log(`📋 Apply URL: ${packet.applyUrl}`);
    console.log(`👤 User: ${packet.userProfile.name} (${packet.userProfile.email})`);

    // Launch browser
    console.log(`🌐 Launching browser (headless: ${config.RUNNER_HEADLESS})`);
    browser = await chromium.launch({
      headless: config.RUNNER_HEADLESS,
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to apply URL
    console.log(`🔗 Navigating to ${packet.applyUrl}`);
    await page.goto(packet.applyUrl, { waitUntil: 'networkidle' });

    // Take initial screenshot
    const screenshotPath = await takeScreenshot(page, 'initial', config);
    report.artifacts.push({
      type: 'screenshot',
      filePath: screenshotPath,
      description: 'Initial page load',
    });

    // Save page HTML for debugging
    const htmlContent = await page.content();
    const htmlPath = join(config.RUNNER_ARTIFACT_DIR, `initial-${Date.now()}.html`);
    await writeFile(htmlPath, htmlContent, 'utf-8');
    report.artifacts.push({
      type: 'html',
      filePath: htmlPath,
      description: 'Initial page HTML',
    });

    // Check if submit button exists (but DON'T click it)
    const submitButton = page.locator('button[type="submit"], input[type="submit"]');
    const submitCount = await submitButton.count();

    if (submitCount > 0) {
      console.log(`✋ Found ${submitCount} submit button(s) - NOT clicking (as intended)`);
      report.stoppedReason = `Found ${submitCount} submit button(s). Stopped before submission as intended.`;
    } else {
      console.log(`⚠️  No submit buttons found on page`);
      report.warnings.push('No submit buttons found on page');
      report.stoppedReason = 'No submit buttons found on page';
    }

    console.log(`✅ Runner completed successfully without clicking submit`);

  } catch (error) {
    console.error(`❌ Runner error:`, error);
    report.status = 'failed';
    report.errors.push(
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return report;
}
