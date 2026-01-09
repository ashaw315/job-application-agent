# Scripts

## smoke_v0.ts

North Star smoke test for v0 - validates the entire end-to-end flow.

### Prerequisites

1. Web app running on http://localhost:3000 (or custom URL via WEB_BASE_URL)
2. Database seeded with user profile and KB bullets
3. RUNNER_API_KEY environment variable set

### Usage

```bash
# From repo root
export RUNNER_API_KEY="your-secret-key"
pnpm tsx scripts/smoke_v0.ts
```

### Environment Variables

- `WEB_BASE_URL` (optional, default: http://localhost:3000)
- `RUNNER_API_KEY` (required) - must match web app's RUNNER_API_KEY

### What It Tests

1. **Health Check** - Verifies app is alive and database is healthy
2. **Ingest Test Job** - Creates a test job posting via API
3. **Run Pipeline** - Executes score + draft workflow
4. **Approve Job** - Approves the generated materials
5. **Fetch Runner Packet** - Retrieves runner packet with authentication
6. **Build Runner** - Ensures runner CLI is built
7. **Run Runner CLI** - Executes runner against the test job
8. **Verify Runner Run** - Confirms job persists after runner execution

### Expected Duration

**Target: < 15 seconds**

Typical breakdown:
- Health check: ~50ms
- Ingest: ~100ms  - Pipeline: ~3-5s (inline mode without LLM)
- Approve: ~100ms
- Fetch packet: ~100ms
- Build runner: ~2s (first time) or ~500ms (cached)
- Run runner: ~5-8s
- Verify: ~100ms

### Exit Codes

- `0` - All phases passed
- `1` - One or more phases failed

### Troubleshooting

**"RUNNER_API_KEY is required"**
```bash
export RUNNER_API_KEY="$(grep RUNNER_API_KEY apps/web/.env | cut -d= -f2 | tr -d '"')"
```

**"Health check failed"**
- Ensure web app is running: `cd apps/web && pnpm dev`
- Check health endpoint: `curl http://localhost:3000/api/health`

**"Database is not healthy"**
```bash
cd apps/web
pnpm db:push
pnpm db:seed
```

**Runner execution errors**
- The runner may fail on actual form filling (expected in smoke test without real application forms)
- Check `packages/runner/artifacts/` for error screenshots and traces
- The script considers runner execution successful if it attempts to run and posts a report

### Output Format

The script prints:
1. Progress indicator for each phase (`▶️`, `✅`, `❌`)
2. Timing for each phase
3. Summary table with percentages
4. Total execution time
5. Job ID and URL for manual verification

### Integration with CI/CD

This script can be used in CI/CD pipelines:

```bash
#!/bin/bash
set -e

# Start web app
cd apps/web
pnpm dev &
WEB_PID=$!

# Wait for app to be ready
sleep 5

# Run smoke test
cd ../..
pnpm tsx scripts/smoke_v0.ts

# Cleanup
kill $WEB_PID
```
