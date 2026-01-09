# @job-application-agent/runner

Node CLI automation tool for applying to jobs using Playwright.

## Overview

The runner package is a command-line tool that automates the job application process. It:
1. Fetches approved job packets from the web application API
2. Navigates to application forms using Playwright
3. Takes screenshots and saves artifacts for debugging
4. Currently stops before clicking submit (v0 safety feature)

## Installation

From the monorepo root:

```bash
pnpm install
pnpm exec playwright install chromium
```

## Configuration

Create a `.env` file in the runner package directory (use `.env.example` as a template):

```bash
# Base URL of the web application API
RUNNER_APP_BASE_URL="http://localhost:3000"

# API key for authenticating with the web app
# This must match the RUNNER_API_KEY in apps/web/.env
RUNNER_API_KEY="your-secure-runner-api-key-here"

# Directory to store artifacts (screenshots, HTML, etc.)
RUNNER_ARTIFACT_DIR="./artifacts"

# Whether to run browser in headless mode (true/false)
RUNNER_HEADLESS="true"
```

## Usage

### CLI Command

```bash
# From the monorepo root
pnpm --filter @job-application-agent/runner build
pnpm --filter @job-application-agent/runner runner apply --job <jobPostingId>

# Or using the built CLI directly
cd packages/runner
node dist/cli.js apply --job <jobPostingId>
```

### Programmatic API

```typescript
import { applyToJob, loadConfig } from '@job-application-agent/runner';

const config = loadConfig();
const report = await applyToJob('job-posting-id', config);

console.log(report.status); // 'stopped_before_submit', 'success', 'failed', etc.
console.log(report.artifacts); // Screenshots, HTML, etc.
```

## Testing

### Run Integration Tests

```bash
# From monorepo root
pnpm test:runner

# Or from runner package
cd packages/runner
pnpm test
```

### Fixture Server

The package includes a fixture server that serves static HTML forms for testing:

```bash
# Build and start fixture server
pnpm build
pnpm fixture-server

# Server runs at http://localhost:3456
# Simple form: http://localhost:3456/jobs/simple-form
```

## Architecture

### Files

- `src/cli.ts` - CLI entry point and command parser
- `src/config.ts` - Zod-based environment configuration
- `src/apply.ts` - Main runner logic with Playwright automation
- `src/fixtures/` - Test fixtures (HTML forms, servers)
- `src/apply.test.ts` - Integration tests

### Runner Flow

1. **Fetch Packet**: GET `/api/runner/packets/:jobPostingId` with Bearer token
2. **Launch Browser**: Start Playwright Chromium instance
3. **Navigate**: Open the application URL from packet
4. **Capture**: Take screenshots and save HTML
5. **Analyze**: Check for submit buttons (but don't click in v0)
6. **Report**: Return structured report with status and artifacts

### Artifacts

The runner saves artifacts to the configured directory:

- **Screenshots**: `initial-{timestamp}.png` - Full page screenshots
- **HTML**: `initial-{timestamp}.html` - Raw page HTML for debugging
- More artifact types coming in future versions

## Development

### Build

```bash
pnpm build
```

### Type Check

```bash
pnpm typecheck
```

### Watch Mode (Tests)

```bash
pnpm test:watch
```

## Future Enhancements

- [ ] Form field filling based on packet data
- [ ] ATS-specific handlers (Greenhouse, Lever, Workday)
- [ ] Actual submit functionality (with confirmation)
- [ ] Better error recovery and retries
- [ ] Captcha handling
- [ ] Video recording of sessions
- [ ] Report submission back to web app

## Security Notes

- The RUNNER_API_KEY must be kept secure and match the web app configuration
- All packets are fetched over authenticated HTTPS in production
- Screenshots may contain sensitive information - handle artifacts carefully
- Currently stops before submit as a safety feature (v0)
