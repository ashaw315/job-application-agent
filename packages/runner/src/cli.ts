#!/usr/bin/env node

import { loadConfig } from './config.js';
import { applyToJob } from './apply.js';

/**
 * CLI entry point for runner automation
 * Usage: runner apply --job <jobPostingId>
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Runner CLI - Job Application Automation

Usage:
  runner apply --job <jobPostingId>    Apply to a job posting

Options:
  --job <id>        Job posting ID to apply to (required)
  --help, -h        Show this help message

Environment Variables:
  RUNNER_APP_BASE_URL   Base URL of the web app (default: http://localhost:3000)
  RUNNER_API_KEY        API key for authentication (required)
  RUNNER_ARTIFACT_DIR   Directory for artifacts (default: ./artifacts)
  RUNNER_HEADLESS       Run in headless mode (default: true)

Examples:
  runner apply --job 123e4567-e89b-12d3-a456-426614174000
    `);
    process.exit(0);
  }

  const command = args[0];

  if (command !== 'apply') {
    console.error(`❌ Unknown command: ${command}`);
    console.error('Run "runner --help" for usage information');
    process.exit(1);
  }

  // Parse --job flag
  const jobIndex = args.indexOf('--job');
  if (jobIndex === -1 || jobIndex + 1 >= args.length) {
    console.error('❌ Missing required flag: --job <jobPostingId>');
    console.error('Run "runner --help" for usage information');
    process.exit(1);
  }

  const jobPostingId = args[jobIndex + 1];

  if (!jobPostingId || jobPostingId.startsWith('--')) {
    console.error('❌ Invalid job posting ID');
    process.exit(1);
  }

  // Load config (will exit on validation error)
  const config = loadConfig();

  console.log(`🤖 Runner starting...`);
  console.log(`📋 Job: ${jobPostingId}`);
  console.log(`🌐 API: ${config.RUNNER_APP_BASE_URL}`);
  console.log(`📁 Artifacts: ${config.RUNNER_ARTIFACT_DIR}`);
  console.log();

  try {
    const report = await applyToJob(jobPostingId, config);

    console.log();
    console.log(`📊 Runner Report:`);
    console.log(`   Status: ${report.status}`);

    if (report.errors.length > 0) {
      console.log(`   Errors: ${report.errors.length}`);
      report.errors.forEach((err) => console.error(`     - ${err}`));
    }

    if (report.warnings.length > 0) {
      console.log(`   Warnings: ${report.warnings.length}`);
      report.warnings.forEach((warn) => console.warn(`     - ${warn}`));
    }

    if (report.artifacts.length > 0) {
      console.log(`   Artifacts: ${report.artifacts.length}`);
      report.artifacts.forEach((artifact) => {
        console.log(`     - ${artifact.type}: ${artifact.filePath || 'inline'}`);
      });
    }

    if (report.stoppedReason) {
      console.log(`   Stopped: ${report.stoppedReason}`);
    }

    // Output structured JSON report to stdout (for machine parsing)
    console.log();
    console.log('=== RUNNER_REPORT_JSON ===');
    console.log(JSON.stringify(report, null, 2));
    console.log('=== END_RUNNER_REPORT_JSON ===');

    process.exit(report.status === 'success' || report.status === 'stopped_before_submit' ? 0 : 1);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
