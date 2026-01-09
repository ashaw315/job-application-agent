import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
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
 * Save DOM snapshot to artifacts
 */
async function saveDOMSnapshot(
  page: Page,
  name: string,
  config: RunnerConfig
): Promise<string> {
  const filename = `${name}-${Date.now()}.html`;
  const filepath = join(config.RUNNER_ARTIFACT_DIR, filename);
  const htmlContent = await page.content();

  await writeFile(filepath, htmlContent, 'utf-8');
  console.log(`📄 DOM snapshot saved: ${filepath}`);

  return filepath;
}

/**
 * Create temporary files for resume and cover letter
 * Returns paths to temp files
 */
async function createTempFiles(packet: RunnerPacket): Promise<{
  resumePath: string;
  coverLetterPath: string;
}> {
  const timestamp = Date.now();
  const resumePath = join(tmpdir(), `resume-${timestamp}.txt`);
  const coverLetterPath = join(tmpdir(), `cover-letter-${timestamp}.txt`);

  await writeFile(resumePath, packet.materials.resumeText, 'utf-8');
  await writeFile(coverLetterPath, packet.materials.coverLetterText, 'utf-8');

  console.log(`📝 Created temp files:`);
  console.log(`   Resume: ${resumePath}`);
  console.log(`   Cover letter: ${coverLetterPath}`);

  return { resumePath, coverLetterPath };
}

/**
 * Cleanup temporary files
 */
async function cleanupTempFiles(
  resumePath: string,
  coverLetterPath: string
): Promise<void> {
  try {
    await rm(resumePath, { force: true });
    await rm(coverLetterPath, { force: true });
    console.log(`🧹 Cleaned up temp files`);
  } catch (error) {
    console.warn(`⚠️  Could not cleanup temp files: ${error}`);
  }
}

/**
 * Fill identity fields (name, email, phone)
 */
async function fillIdentityFields(
  page: Page,
  packet: RunnerPacket,
  report: RunnerReport
): Promise<void> {
  console.log(`👤 Filling identity fields...`);

  // Fill name
  const nameInput = page.locator('input#name, input[name="name"]').first();
  if ((await nameInput.count()) > 0) {
    await nameInput.fill(packet.userProfile.name);
    console.log(`   ✓ Name: ${packet.userProfile.name}`);
  } else {
    report.warnings.push('Name input not found on form');
  }

  // Fill email
  const emailInput = page.locator('input#email, input[name="email"], input[type="email"]').first();
  if ((await emailInput.count()) > 0) {
    await emailInput.fill(packet.userProfile.email);
    console.log(`   ✓ Email: ${packet.userProfile.email}`);
  } else {
    report.warnings.push('Email input not found on form');
  }

  // Fill phone (optional)
  if (packet.userProfile.phone) {
    const phoneInput = page.locator('input#phone, input[name="phone"], input[type="tel"]').first();
    if ((await phoneInput.count()) > 0) {
      await phoneInput.fill(packet.userProfile.phone);
      console.log(`   ✓ Phone: ${packet.userProfile.phone}`);
    } else {
      report.warnings.push('Phone input not found on form (phone is optional)');
    }
  }
}

/**
 * Upload resume and cover letter files
 * Returns true if critical uploads succeeded (resume), false otherwise
 */
async function uploadFiles(
  page: Page,
  resumePath: string,
  coverLetterPath: string,
  report: RunnerReport
): Promise<boolean> {
  console.log(`📤 Uploading files...`);

  // Upload resume (CRITICAL - must succeed)
  const resumeInput = page.locator('input#resume, input[name="resume"], input[type="file"]').first();
  if ((await resumeInput.count()) === 0) {
    report.errors.push('CRITICAL: Resume upload input not found on form. Cannot proceed.');
    return false;
  }

  try {
    await resumeInput.setInputFiles(resumePath);
    console.log(`   ✓ Resume uploaded`);
  } catch (error) {
    report.errors.push(
      `CRITICAL: Failed to upload resume: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return false;
  }

  // Upload cover letter (OPTIONAL - warn if missing)
  const coverLetterInput = page.locator(
    'input#cover-letter, input[name="cover-letter"], input[name="cover_letter"]'
  ).first();

  if ((await coverLetterInput.count()) === 0) {
    report.warnings.push(
      'Cover letter upload input not found on form. This is optional; continuing without it.'
    );
  } else {
    try {
      await coverLetterInput.setInputFiles(coverLetterPath);
      console.log(`   ✓ Cover letter uploaded`);
    } catch (error) {
      report.warnings.push(
        `Could not upload cover letter: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return true;
}

/**
 * Handle work authorization question
 * Only answers if the question is unambiguous
 */
async function handleWorkAuthorization(
  page: Page,
  packet: RunnerPacket,
  report: RunnerReport
): Promise<void> {
  console.log(`🏢 Checking for work authorization question...`);

  if (!packet.allowedAnswers.workAuthorization) {
    console.log(`   ⚠️  No work authorization provided in packet; skipping`);
    return;
  }

  // Look for work authorization select/dropdown
  const workAuthSelect = page.locator(
    'select#work-authorization, select[name="work-authorization"]'
  ).first();

  if ((await workAuthSelect.count()) === 0) {
    report.warnings.push('Work authorization question not found on form');
    return;
  }

  // Try to select the value
  try {
    await workAuthSelect.selectOption({ value: packet.allowedAnswers.workAuthorization });
    console.log(`   ✓ Work authorization: ${packet.allowedAnswers.workAuthorization}`);
  } catch (error) {
    report.warnings.push(
      `Could not select work authorization option: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Skip ambiguous free-text questions
 * Logs warnings for any custom questions that would require human judgment
 */
async function skipAmbiguousQuestions(
  page: Page,
  report: RunnerReport
): Promise<void> {
  console.log(`❓ Checking for ambiguous questions...`);

  // Look for custom text areas that are NOT standard fields
  const customTextareas = page.locator('textarea').filter({
    hasNot: page.locator('#resume, #cover-letter, [name="resume"], [name="cover-letter"]'),
  });

  const count = await customTextareas.count();
  if (count > 0) {
    console.log(`   ⚠️  Found ${count} custom question(s) - skipping (ambiguous)`);
    report.warnings.push(
      `Found ${count} ambiguous free-text question(s). Skipped to avoid incorrect answers.`
    );

    // Get labels for debugging
    for (let i = 0; i < Math.min(count, 3); i++) {
      const textarea = customTextareas.nth(i);
      const id = await textarea.getAttribute('id');
      const name = await textarea.getAttribute('name');
      console.log(`      - Question field: ${id || name || 'unknown'}`);
    }
  }
}

/**
 * Apply to a job posting
 * v0: Fill form fields, upload files, stop before submit
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
  let context: BrowserContext | null = null;
  let resumePath: string | null = null;
  let coverLetterPath: string | null = null;

  try {
    // Ensure artifact directory exists
    await ensureArtifactDir(config);

    // Fetch packet
    const packet = await fetchPacket(jobPostingId, config);
    console.log(`📋 Apply URL: ${packet.applyUrl}`);
    console.log(`👤 User: ${packet.userProfile.name} (${packet.userProfile.email})`);

    // Create temporary files for uploads
    const tempFiles = await createTempFiles(packet);
    resumePath = tempFiles.resumePath;
    coverLetterPath = tempFiles.coverLetterPath;

    // Launch browser with tracing enabled
    console.log(`🌐 Launching browser (headless: ${config.RUNNER_HEADLESS})`);
    browser = await chromium.launch({
      headless: config.RUNNER_HEADLESS,
    });

    context = await browser.newContext();

    // Start tracing for error diagnostics
    await context.tracing.start({ screenshots: true, snapshots: true });

    const page = await context.newPage();

    // Navigate to apply URL
    console.log(`🔗 Navigating to ${packet.applyUrl}`);
    await page.goto(packet.applyUrl, { waitUntil: 'networkidle' });

    // Screenshot 1: Initial page load
    const initialScreenshot = await takeScreenshot(page, '01-initial', config);
    report.artifacts.push({
      type: 'screenshot',
      filePath: initialScreenshot,
      description: 'Initial page load',
    });

    // Fill identity fields
    await fillIdentityFields(page, packet, report);

    // Upload files (CRITICAL: resume must succeed)
    const uploadSuccess = await uploadFiles(
      page,
      resumePath,
      coverLetterPath,
      report
    );

    if (!uploadSuccess) {
      // CRITICAL FAILURE - cannot proceed without resume upload
      report.status = 'critical_error';

      // Take error screenshot
      const errorScreenshot = await takeScreenshot(page, '99-error', config);
      report.artifacts.push({
        type: 'screenshot',
        filePath: errorScreenshot,
        description: 'Error state - resume upload failed',
      });

      // Save DOM snapshot
      const domSnapshot = await saveDOMSnapshot(page, 'error-dom', config);
      report.artifacts.push({
        type: 'html',
        filePath: domSnapshot,
        description: 'DOM snapshot at error',
      });

      // Save trace
      const tracePath = join(config.RUNNER_ARTIFACT_DIR, `error-trace-${Date.now()}.zip`);
      await context.tracing.stop({ path: tracePath });
      report.artifacts.push({
        type: 'json',
        filePath: tracePath,
        description: 'Playwright trace for error diagnostics',
      });

      console.log(`❌ CRITICAL ERROR: Resume upload failed`);
      return report;
    }

    // Screenshot 2: After file uploads
    const afterUploadsScreenshot = await takeScreenshot(page, '02-after-uploads', config);
    report.artifacts.push({
      type: 'screenshot',
      filePath: afterUploadsScreenshot,
      description: 'After file uploads',
    });

    // Handle work authorization (if provided and unambiguous)
    await handleWorkAuthorization(page, packet, report);

    // Check for and skip ambiguous questions
    await skipAmbiguousQuestions(page, report);

    // Screenshot 3: Before stopping (final state)
    const beforeStopScreenshot = await takeScreenshot(page, '03-before-stop', config);
    report.artifacts.push({
      type: 'screenshot',
      filePath: beforeStopScreenshot,
      description: 'Before stopping - final form state',
    });

    // Save final DOM snapshot
    const finalDomSnapshot = await saveDOMSnapshot(page, 'final-dom', config);
    report.artifacts.push({
      type: 'html',
      filePath: finalDomSnapshot,
      description: 'Final DOM snapshot',
    });

    // Verify submit button exists but DON'T click it
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

    // Stop tracing (success path - no need to save)
    await context.tracing.stop();

    console.log(`✅ Runner completed successfully without clicking submit`);
    console.log(`📊 Summary: ${report.errors.length} errors, ${report.warnings.length} warnings`);

  } catch (error) {
    console.error(`❌ Runner error:`, error);
    report.status = 'critical_error';
    report.errors.push(
      error instanceof Error ? error.message : 'Unknown error occurred'
    );

    // Try to capture error artifacts
    try {
      if (context) {
        const page = context.pages()[0];
        if (page) {
          // Error screenshot
          const errorScreenshot = await takeScreenshot(page, '99-error', config);
          report.artifacts.push({
            type: 'screenshot',
            filePath: errorScreenshot,
            description: 'Error state',
          });

          // DOM snapshot
          const domSnapshot = await saveDOMSnapshot(page, 'error-dom', config);
          report.artifacts.push({
            type: 'html',
            filePath: domSnapshot,
            description: 'DOM snapshot at error',
          });
        }

        // Save trace on error
        const tracePath = join(config.RUNNER_ARTIFACT_DIR, `error-trace-${Date.now()}.zip`);
        await context.tracing.stop({ path: tracePath });
        report.artifacts.push({
          type: 'json',
          filePath: tracePath,
          description: 'Playwright trace for error diagnostics',
        });
      }
    } catch (artifactError) {
      console.error(`⚠️  Could not capture error artifacts: ${artifactError}`);
    }
  } finally {
    // Cleanup browser
    if (browser) {
      await browser.close();
    }

    // Cleanup temp files
    if (resumePath && coverLetterPath) {
      await cleanupTempFiles(resumePath, coverLetterPath);
    }
  }

  return report;
}
