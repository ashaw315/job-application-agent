# Job Application Agent v0

AI-powered job application assistant to help you find, track, and apply to jobs. This v0 implements the core pipeline: **Ingest → Score → Draft → Review/Approve → Runner Autofill** with optional async queue processing.

---

## Quick Start (Inline Mode - No Redis)

Get up and running in under 5 minutes:

### 1. Prerequisites

- **Node.js** 20+ and **pnpm** 8+
- **PostgreSQL** 14+ running locally
- (Optional) **Redis** 6+ for queue mode
- (Optional) **OpenAI API key** for LLM-powered drafting

⚠️ **IMPORTANT: This project uses pnpm workspaces. `npm install` will fail.**

If you don't have pnpm installed:
```bash
corepack enable
corepack prepare pnpm@8.15.0 --activate
```

### 2. Install Dependencies

```bash
# From repo root
pnpm install
```

**Clean reinstall** (if you have dependency issues):
```bash
# Remove all node_modules and lockfiles
rm -rf node_modules apps/*/node_modules packages/*/node_modules pnpm-lock.yaml

# Reinstall from scratch
pnpm install
```

### 3. Configure Environment

```bash
# Copy example env files
cp apps/web/.env.example apps/web/.env
cp packages/runner/.env.example packages/runner/.env
```

**Edit `apps/web/.env`:**
- Set `DATABASE_URL` to your PostgreSQL connection string
- Set `RUNNER_API_KEY` to a random secret (e.g., `openssl rand -hex 32`)
  - Required for runner operations and full pipeline
  - Health endpoint works without it
- (Optional) Remove or comment out `REDIS_URL` for inline mode
- (Optional) Set `OPENAI_API_KEY` if you have one

**Edit `packages/runner/.env`:**
- Set `RUNNER_API_KEY` to match the web app
- Set `RUNNER_APP_BASE_URL="http://localhost:3000"`

### 4. Setup Database

```bash
cd apps/web

# Run migrations to create tables
pnpm db:push

# Seed initial data (user profile + KB bullets)
pnpm db:seed

cd ../..
```

### 5. Start Web App

```bash
cd apps/web
pnpm dev
```

Visit **http://localhost:3000** - you should see the Job Application Agent homepage.

### 6. Smoke Test

1. Navigate to `/jobs` (currently empty)
2. Use the API or UI to ingest a job (see "Usage" section below)
3. Run the pipeline to generate materials
4. Approve the job and run the runner CLI

---

## Queue Mode (with Redis)

For production-like async processing with BullMQ:

### 1. Start Redis

```bash
# macOS with Homebrew:
brew services start redis

# Or run in foreground:
redis-server
```

### 2. Enable Queue Mode

Edit `apps/web/.env` and set:
```bash
REDIS_URL="redis://localhost:6379"
```

### 3. Start Worker Process

In a **separate terminal**:

```bash
cd apps/web
pnpm worker
```

You should see logs like:
```
{"level":30,"time":...,"component":"worker","msg":"Starting queue workers..."}
{"level":30,"time":...,"queue":"score","msg":"Score queue initialized"}
```

### 4. Start Web App

In your **main terminal**:

```bash
cd apps/web
pnpm dev
```

### 5. Test Async Processing

When you run a job pipeline (`POST /api/jobs/:id/runPipeline`), jobs are enqueued and processed asynchronously by the worker. Check worker logs to see job processing in real-time.

**To stop the worker gracefully:**
- Press `Ctrl+C` (SIGINT)
- Worker will finish current jobs and shut down

---

## Runner (Local CLI)

The runner CLI automates form filling using Playwright.

### 1. Build Runner

```bash
cd packages/runner
pnpm build
```

This compiles TypeScript to `dist/` and creates the `runner` CLI.

### 2. Configure Runner

Ensure `packages/runner/.env` is set correctly:
- `RUNNER_APP_BASE_URL` points to your web app (default: `http://localhost:3000`)
- `RUNNER_API_KEY` matches the web app's `RUNNER_API_KEY`
- `RUNNER_ARTIFACT_DIR` is where screenshots/traces will be saved (default: `./artifacts`)
- `RUNNER_HEADLESS=false` to see the browser in action (useful for debugging)

### 3. Approve a Job

Before running the runner, you must **approve** a job in the web UI or via API:

```bash
POST http://localhost:3000/api/jobs/:jobId/approve
```

This creates approved material versions and sets `status='approved'`.

### 4. Run the Runner

```bash
cd packages/runner
node dist/cli.js apply --job <jobPostingId>

# Or if you've linked it globally:
runner apply --job <jobPostingId>
```

**What happens:**
1. Runner fetches the approved materials from `/api/runner/packets/:jobPostingId`
2. Opens the job's `applyUrl` in a Playwright browser
3. Fills name, email, phone
4. Uploads resume and cover letter
5. Takes screenshots at key steps
6. **Stops before clicking submit** (v0 safety)
7. Saves artifacts to `RUNNER_ARTIFACT_DIR`
8. Posts report back to `/api/runner/runs`

### 5. Review Artifacts

Check `packages/runner/artifacts/` for:
- `01-initial-*.png` - Initial page load
- `02-after-uploads-*.png` - After file uploads
- `03-before-stop-*.png` - Final form state
- `final-dom-*.html` - Full page HTML
- `error-trace-*.zip` - Playwright trace (on errors)

---

## Testing

### Run All Tests

From the **root** of the monorepo:

```bash
# Run all tests in all packages
pnpm test

# Run tests in watch mode
pnpm test:watch
```

### Run Tests by Package

```bash
# Web app tests (API routes, services)
cd apps/web
pnpm test

# Shared package tests (normalization, scoring, extraction)
cd packages/shared
pnpm test

# Runner tests (Playwright fixtures)
cd packages/runner
pnpm test
```

### Test Coverage

Tests cover:
- ✅ Job ingestion (manual, Greenhouse, generic URL)
- ✅ Deduplication logic
- ✅ Fit scoring
- ✅ Pipeline (score + draft)
- ✅ Material approval
- ✅ Runner packet generation
- ✅ Runner report persistence
- ✅ Follow-up suggestions and emails

**Total test files:** 174 (as of last audit)

---

## Run the v0 Smoke Test

A comprehensive end-to-end smoke test validates the entire "north star flow" from job ingestion to runner execution.

**For full smoke test documentation:** See [`scripts/README.md`](scripts/README.md)

### Quick Run

```bash
# Ensure web app is running
cd apps/web
pnpm dev &

# In another terminal, run the smoke test (from repo root)
export RUNNER_API_KEY="$(grep RUNNER_API_KEY apps/web/.env | cut -d= -f2 | tr -d '"')"
pnpm tsx scripts/smoke_v0.ts
```

**What it tests:**
1. ✅ Health check (app is alive)
2. ✅ Ingest test job (manual entry)
3. ✅ Run pipeline (score + draft materials)
4. ✅ Approve job
5. ✅ Fetch runner packet (with authentication)
6. ✅ Build runner CLI
7. ✅ Execute runner
8. ✅ Verify job persists after runner execution

**Expected output:**

```
🚀 Starting North Star Smoke Test (v0)
   Web API: http://localhost:3000
   Runner Key: abc12345...

▶️  Health Check...
   Version: 0.1.0
   Queue mode: disabled
   Database: ok
✅ Health Check completed in 45ms

▶️  Ingest Test Job...
   Job ID: 8f3e4567-e89b-12d3-a456-426614174000
✅ Ingest Test Job completed in 123ms

▶️  Run Pipeline...
   Materials created: 2 versions
   Status: in_review
✅ Run Pipeline completed in 3456ms

▶️  Approve Job...
   Job approved
✅ Approve Job completed in 89ms

▶️  Fetch Runner Packet...
   Packet fetched for job: 8f3e4567-e89b-12d3-a456-426614174000
   Apply URL: https://boards.greenhouse.io/...
   User: Default User <user@example.com>
✅ Fetch Runner Packet completed in 67ms

▶️  Build Runner...
   Building runner in packages/runner...
   Runner built successfully
✅ Build Runner completed in 2341ms

▶️  Run Runner CLI...
   Executing runner for job 8f3e4567-e89b-12d3-a456-426614174000...
   Runner execution completed (may have errors on form fill)
✅ Run Runner CLI completed in 5678ms

▶️  Verify Runner Run...
   Final job status: approved
   Job verification complete
✅ Verify Runner Run completed in 134ms

======================================================================
📊 SMOKE TEST SUMMARY
======================================================================
✅ Health Check                            45ms (0.4%)
✅ Ingest Test Job                        123ms (1.0%)
✅ Run Pipeline                          3456ms (28.5%)
✅ Approve Job                             89ms (0.7%)
✅ Fetch Runner Packet                     67ms (0.6%)
✅ Build Runner                          2341ms (19.3%)
✅ Run Runner CLI                        5678ms (46.8%)
✅ Verify Runner Run                      134ms (1.1%)
──────────────────────────────────────────────────────────────────────
   Total time: 12133ms (12.13s)
   Success: 8/8 phases
======================================================================

🎉 North Star Smoke Test PASSED
   Job ID: 8f3e4567-e89b-12d3-a456-426614174000
   View at: http://localhost:3000/jobs/8f3e4567-e89b-12d3-a456-426614174000
```

**Troubleshooting:**

If the smoke test fails:

1. **"RUNNER_API_KEY is required"**: Set the environment variable:
   ```bash
   export RUNNER_API_KEY="your-secret-key-from-.env"
   # Or add to apps/web/.env and source it
   ```

2. **"Health check failed"**: Ensure the web app is running on localhost:3000

3. **"Database is not healthy"**: Ensure PostgreSQL is running and seeded:
   ```bash
   cd apps/web
   pnpm db:push
   pnpm db:seed
   ```

4. **Runner execution errors**: The runner may fail on actual form filling (expected in smoke test), but should still post a report

**Time Budget:**

Target: **< 15 seconds** for full smoke test on local dev machine

- Health check: < 100ms
- Ingest: < 200ms
- Pipeline: < 5s (inline mode) or < 10s (with LLM)
- Approve: < 200ms
- Fetch packet: < 200ms
- Build runner: < 5s (first time) or < 1s (cached)
- Run runner: < 10s (fixture mode)
- Verify: < 200ms

---

## Queue Mode Verification

Validate that BullMQ queue mode works correctly with asynchronous job processing.

### Prerequisites

1. **Redis running**:
   ```bash
   # macOS with Homebrew:
   brew services start redis

   # Or run in foreground:
   redis-server
   ```

2. **REDIS_URL configured** in `apps/web/.env`:
   ```bash
   REDIS_URL="redis://localhost:6379"
   ```

3. **Web app running**:
   ```bash
   cd apps/web
   pnpm dev
   ```

4. **Worker running** (in separate terminal):
   ```bash
   cd apps/web
   pnpm worker
   ```

### Run Queue Mode Test

```bash
# From repo root
pnpm tsx scripts/queue_mode_check.ts
```

### What It Tests

1. ✅ **Queue mode enabled** - Verifies REDIS_URL is configured
2. ✅ **Job enqueueing** - Submits test job to BullMQ queues
3. ✅ **Worker processing** - Polls database for score computation
4. ✅ **Material generation** - Waits for draft worker to complete
5. ✅ **Idempotency** - Re-enqueues same job, verifies no duplicates
6. ✅ **Final state** - Validates job status and database records

### Expected Output (Success)

```
======================================================================
🔄 QUEUE MODE INTEGRATION TEST
======================================================================
[13:45:23.123] Web API: http://localhost:3000
[13:45:23.124] Max wait: 30000ms
[13:45:23.124] Poll interval: 500ms

[13:45:23.125] Step 1: Checking queue mode configuration...
[13:45:23.178] ✅ Queue mode is enabled
[13:45:23.178] ✅ Redis configured, database: ok

[13:45:23.179] Step 2: Ingesting test job...
[13:45:23.345] ✅ Job ingested: 8f3e4567-e89b-12d3-a456-426614174000

[13:45:23.346] Step 3: Enqueueing pipeline jobs...
[13:45:23.412] ✅ Pipeline jobs enqueued
[13:45:23.412]   Score job ID: score:8f3e4567-e89b-12d3-a456-426614174000
[13:45:23.412]   Draft job ID: draft:8f3e4567-e89b-12d3-a456-426614174000

[13:45:23.413] Step 4: Waiting for worker to compute score...
[13:45:23.413] (If this times out, check that worker is running)
[13:45:24.567] ✅ Score computed in 1154ms
[13:45:24.567]   Score: 78/100

[13:45:24.568] Step 5: Waiting for worker to draft materials...
[13:45:27.234] ✅ Materials created in 2666ms
[13:45:27.234]   Versions: 2
[13:45:27.235] ✅ Both cover letter and resume variants created

[13:45:27.236] Step 6: Testing idempotency (re-enqueue same job)...
[13:45:30.345] ✅ Idempotency PASSED: material count unchanged (2)

[13:45:30.346] Step 7: Verifying final job status...
[13:45:30.412] ✅ Final job status: in_review
[13:45:30.412]   Fit score: 78/100
[13:45:30.412]   Material versions: 2
[13:45:30.413] ✅ Job status is correct for completed pipeline

======================================================================
📊 TEST SUMMARY
======================================================================
✅ Passed: 8
❌ Failed: 0
📝 Job ID: 8f3e4567-e89b-12d3-a456-426614174000
🔗 View at: http://localhost:3000/jobs/8f3e4567-e89b-12d3-a456-426614174000
======================================================================

🎉 QUEUE MODE TEST PASSED

Queue mode is working correctly:
  ✅ Jobs are enqueued via BullMQ
  ✅ Worker processes score and draft jobs
  ✅ Database is updated with results
  ✅ Idempotency prevents duplicate processing
```

**Performance Target:** < 10 seconds (excluding LLM calls)

**For more details:** See [`scripts/README.md`](scripts/README.md) for full documentation of smoke test and queue mode verification scripts.

### Troubleshooting

#### "Queue mode is NOT enabled"

**Problem:** REDIS_URL not configured

**Fix:**
```bash
# Add to apps/web/.env:
echo 'REDIS_URL="redis://localhost:6379"' >> apps/web/.env

# Restart web app
cd apps/web
pnpm dev
```

#### "Score not computed after 30000ms"

**Problem:** Worker not running or Redis connection failed

**Fix:**
```bash
# Check Redis is running:
redis-cli ping
# Should return: PONG

# Start worker in separate terminal:
cd apps/web
pnpm worker
```

#### "Idempotency FAILED: material count increased"

**Problem:** Duplicate processing occurred (bug in idempotency logic)

**Fix:**
- Check BullMQ job IDs in queue files (`apps/web/src/lib/queues/*Queue.ts`)
- Verify workers check for existing records before creating
- Report issue if this persists

#### "Worker logs show errors"

**Check worker terminal for:**
- Database connection errors → Check DATABASE_URL
- Redis connection errors → Check REDIS_URL and Redis status
- OpenAI API errors → Optional, workers should create placeholder materials without API key

### Performance Expectations

**Target:** < 10 seconds for full test

- Queue mode check: < 100ms
- Job ingest: < 200ms
- Job enqueue: < 200ms
- Score processing: 1-3s
- Draft processing: 2-5s (without LLM) or 5-15s (with LLM)
- Idempotency check: 3s
- Verification: < 200ms

If test takes significantly longer:
- Check Redis is running locally (not remote)
- Check worker logs for delays
- Check database connection performance

---

## Usage Examples

### Health Check

Verify the application is running and check its configuration:

```bash
curl http://localhost:3000/api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-09T13:45:00.000Z",
  "version": "0.1.0",
  "queueModeEnabled": false,
  "database": "ok"
}
```

**Fields:**
- `status`: Always `"ok"` (endpoint is reachable)
- `timestamp`: Current server time in ISO 8601 format
- `version`: Application version from package.json
- `queueModeEnabled`: `true` if REDIS_URL is configured (queue mode), `false` otherwise (inline mode)
- `database`: `"ok"` if PostgreSQL connection is healthy, `"error"` if database is unreachable

**Note:** This endpoint always returns HTTP 200, even if the database is down. Check the `database` field explicitly to verify DB health. This design makes local development easier when the database is temporarily unavailable.

---

### Ingest a Job (Manual Entry)

```bash
curl -X POST http://localhost:3000/api/jobs/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "manual",
    "manual": {
      "companyName": "Acme Corp",
      "title": "Senior Software Engineer",
      "location": "Remote",
      "description": "We are looking for an experienced engineer..."
    }
  }'
```

Returns: `{ "success": true, "jobId": "..." }`

### Ingest from Greenhouse URL

```bash
curl -X POST http://localhost:3000/api/jobs/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "greenhouse",
    "greenhouse": {
      "url": "https://boards.greenhouse.io/company/jobs/123456"
    }
  }'
```

### Run Pipeline (Score + Draft)

```bash
curl -X POST http://localhost:3000/api/jobs/{jobId}/runPipeline
```

**Inline mode:** Returns after materials are generated (~10-30s with OpenAI)

**Queue mode:** Returns immediately with job IDs; check worker logs for progress

### Approve Job

```bash
curl -X POST http://localhost:3000/api/jobs/{jobId}/approve
```

### Run Automation

```bash
cd packages/runner
runner apply --job {jobId}
```

---

## Deploy to Vercel (Production)

This monorepo deploys to Vercel with Next.js auto-detection. Follow these steps for a successful production deployment.

### Prerequisites

- **Vercel account** (free tier works for v0)
- **Supabase project** (free tier works for v0)
- **Upstash Redis** (optional, for queue mode)
- **OpenAI API key** (optional, for real LLM-powered drafting)

### Step 1: Set Up Supabase Database

1. **Create a new Supabase project:**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Click "New Project"
   - Choose a name, database password, and region
   - Wait for project to provision (~2 minutes)

2. **Get your connection string:**
   - Go to Project Settings → Database
   - Copy the "Connection pooling" URI (recommended for serverless)
   - Format: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true`
   - Save this as `DATABASE_URL`

3. **Initialize database schema:**

   Because PgBouncer connection pooling doesn't support migrations, you need to create tables manually:

   ```bash
   # From repo root
   cd apps/web

   # Generate SQL schema from Prisma
   npx prisma migrate dev --name init --create-only

   # This creates a migration file in prisma/migrations/
   # Copy the SQL content and run it in Supabase SQL Editor
   ```

   **Alternative:** Use the Supabase SQL Editor to run the schema from `prisma/migrations/` directly.

4. **Seed initial data:**

   After schema is created, seed from your local machine:

   ```bash
   # Set DATABASE_URL to Supabase (use direct connection, not pooler)
   export DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

   cd apps/web
   pnpm db:seed
   ```

   This creates:
   - User profile (Default User)
   - ~15 KB bullets for resume bullet selection
   - 3 sample job postings (optional, can delete after deploy)

### Step 2: Set Up Upstash Redis (Optional - Queue Mode)

**Skip this step if you want inline mode (synchronous) for v0.**

1. **Create Upstash Redis database:**
   - Go to [https://console.upstash.com/](https://console.upstash.com/)
   - Click "Create Database"
   - Choose a name and region (pick closest to your Vercel region)
   - Select "TLS (SSL) Enabled"

2. **Get your connection string:**
   - Click on your database
   - Copy the "Redis URL" (starts with `rediss://`)
   - Format: `rediss://default:[PASSWORD]@[ENDPOINT].upstash.io:6379`
   - Save this as `REDIS_URL`

### Step 3: Deploy to Vercel

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "feat: prepare for production deployment"
   git push origin main
   ```

2. **Import project to Vercel:**
   - Go to [https://vercel.com/new](https://vercel.com/new)
   - Click "Import Project"
   - Select your GitHub repository

3. **Configure Vercel project settings:**

   **IMPORTANT:** This is a monorepo. Set these in the Vercel UI during import:

   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `apps/web` ⚠️ **Required for monorepo**
   - **Build Command:** (leave as override OFF - uses vercel.json)
   - **Install Command:** `pnpm install` (auto-detected)
   - **Output Directory:** (leave as override OFF - uses .next)

   The `vercel.json` in `apps/web/` handles the custom build command to compile the shared package first.

4. **Configure environment variables in Vercel:**

   Go to Project Settings → Environment Variables and add:

   **Required:**
   ```
   DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
   RUNNER_API_KEY=<generate with: openssl rand -hex 32>
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   ```

   **Optional:**
   ```
   REDIS_URL=rediss://default:[PASSWORD]@[ENDPOINT].upstash.io:6379
   OPENAI_API_KEY=sk-...
   ```

   **Generate RUNNER_API_KEY:**
   ```bash
   openssl rand -hex 32
   ```

5. **Deploy:**
   - Click "Deploy"
   - Vercel will build and deploy (takes ~2-3 minutes)
   - Build command runs: `pnpm --filter @job-application-agent/shared build && pnpm build`
   - On success, you'll get a URL like `https://your-app.vercel.app`

### Step 4: Verify Deployment

**Test the health endpoint:**
```bash
curl https://your-app.vercel.app/api/health | jq .

# Expected output:
{
  "status": "ok",
  "timestamp": "2026-01-09T...",
  "version": "0.1.0",
  "queueModeEnabled": true,  // or false if no REDIS_URL
  "database": "ok"
}
```

**Test job ingestion:**
```bash
curl -X POST https://your-app.vercel.app/api/jobs/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://boards.greenhouse.io/example/jobs/123",
    "title": "Senior Software Engineer",
    "company": "Example Corp",
    "location": "San Francisco, CA",
    "description": "We are hiring...",
    "applyUrl": "https://boards.greenhouse.io/example/jobs/123/apply"
  }' | jq .

# Expected output:
{
  "success": true,
  "job": { "id": "...", "title": "Senior Software Engineer", ... }
}
```

**Test pipeline execution:**
```bash
# Get a job ID from ingestion above
curl -X POST https://your-app.vercel.app/api/jobs/{JOB_ID}/runPipeline | jq .

# Expected output:
{
  "success": true,
  "message": "Pipeline completed"
}
```

### Step 5: Configure Local Runner

Update `packages/runner/.env` to point to production:

```bash
RUNNER_APP_BASE_URL="https://your-app.vercel.app"
RUNNER_API_KEY="<same key from Vercel env>"
RUNNER_ARTIFACT_DIR="./artifacts"
RUNNER_HEADLESS=false
```

**Test runner against production:**
```bash
# First, approve a job in production UI or via API:
curl -X POST https://your-app.vercel.app/api/jobs/{JOB_ID}/approve

# Then run the runner locally:
cd packages/runner
pnpm build
node dist/cli.js apply --job {JOB_ID}

# Runner will:
# 1. Fetch packet from production
# 2. Open browser and fill form
# 3. Stop before submitting
# 4. Post report back to production
```

### Queue Mode Worker (Optional)

**If you enabled REDIS_URL in Vercel:**

The web app will enqueue jobs to BullMQ, but **workers don't run on Vercel** (no background processes). You have two options:

**Option A: Run worker locally (v0 recommended)**
```bash
# On your dev machine, set env vars to production:
export DATABASE_URL="your-supabase-connection-string"
export REDIS_URL="your-upstash-redis-url"
export RUNNER_API_KEY="your-runner-api-key"
export OPENAI_API_KEY="your-openai-key"  # optional

cd apps/web
pnpm worker

# Worker will process jobs from production queue
# Keep this terminal running
```

**Option B: Deploy worker to separate service**
- Use Railway, Render, or Heroku
- Deploy `apps/web` with `pnpm worker` as the start command
- Set same env vars as Vercel
- Recommended: Use cron job or manual trigger instead of long-running process for v0

**For v0, Option A (local worker) is simplest.**

### Production Checklist

Before going live:

- ✅ **Vercel Settings:**
  - Root Directory = `apps/web`
  - Framework Preset = Next.js (auto-detected)
  - Build/Install/Output overrides = OFF (uses vercel.json)
- ✅ **Database:**
  - Supabase schema created (13 tables)
  - Seed data loaded (user profile + KB bullets)
- ✅ **Environment Variables:**
  - `DATABASE_URL` set (with `?pgbouncer=true`)
  - `RUNNER_API_KEY` is strong random string (32+ chars)
  - `NEXT_PUBLIC_APP_URL` set to Vercel URL
  - `RUNNER_API_KEY` matches between Vercel and local runner
- ✅ **Deployment:**
  - Build succeeds on Vercel
  - Health endpoint returns 200
  - Test job ingestion → pipeline → approval → runner flow
  - Check Vercel logs for errors: `vercel logs --follow`
- ✅ **(Queue mode only)** Worker running and processing jobs

### Troubleshooting Production

**"No Next.js version detected" or "404 NOT_FOUND" on Vercel**

This is usually a Root Directory misconfiguration:

1. **Check Root Directory setting:**
   - Go to Vercel Project Settings → General → Root Directory
   - Must be set to: `apps/web`
   - If blank or set to `.`, Vercel looks for Next.js at repo root (won't find it in monorepo)

2. **Verify vercel.json exists in apps/web:**
   ```bash
   ls apps/web/vercel.json
   # Should exist with buildCommand
   ```

3. **Check Framework Preset:**
   - Go to Vercel Project Settings → General → Framework Preset
   - Should say "Next.js" (auto-detected when Root Directory is correct)
   - If it says "Other", Next.js routing won't work (404 errors)

4. **Redeploy after fixing settings:**
   - Go to Deployments tab
   - Click "..." on latest deployment → Redeploy
   - Or trigger new deployment: `git commit --allow-empty -m "redeploy" && git push`

**"Database connection failed"**
```bash
# Test Supabase connection locally:
psql "your-supabase-connection-string"

# Check Vercel logs:
vercel logs --follow

# Verify DATABASE_URL includes ?pgbouncer=true
# Verify you're using pooler URL (port 6543), not direct (port 5432)
```

**"Worker not processing jobs"**
```bash
# Check Redis connection:
redis-cli -u "your-upstash-redis-url" ping

# Check worker logs (if running locally):
# Worker should show "Starting queue workers..." on startup
```

**"Runner can't fetch packet (401 Unauthorized)"**
- Check RUNNER_API_KEY matches between Vercel and packages/runner/.env
- Ensure RUNNER_API_KEY is set in Vercel environment variables
- Restart local runner after changing .env

**"Build succeeds but pages return 500 errors"**
- Check Vercel Function Logs for runtime errors
- Verify all environment variables are set
- Check database connection: `curl https://your-app.vercel.app/api/health`
- Look for "prepared statement does not exist" → add `export const dynamic = 'force-dynamic'` to page

**"Module not found: @job-application-agent/shared"**
- Verify buildCommand in vercel.json builds shared package first
- Check vercel.json exists in apps/web (not repo root)
- Redeploy after fixing vercel.json

### Updating Production

**Code changes:**
```bash
git push origin main
# Vercel auto-deploys on push to main
```

**Database schema changes:**
```bash
# 1. Create migration locally:
cd apps/web
pnpm db:migrate

# 2. Deploy migration to production:
export DATABASE_URL="your-supabase-connection-string"
pnpm db:migrate:deploy

# 3. Push code to trigger Vercel rebuild:
git push origin main
```

### Costs (Free Tier Limits)

- **Vercel:** 100GB bandwidth/month (plenty for v0 single-user)
- **Supabase:** 500MB database, 2GB bandwidth/month
- **Upstash Redis:** 10,000 commands/day (enough for ~100 jobs/day)
- **OpenAI:** Pay per token (~$0.01-0.10 per job application)

**Total estimated cost for v0 (10 applications/day): $0-5/month**

---

## Architecture (v0)

### Core Flow

```
┌─────────┐     ┌───────┐     ┌───────┐     ┌─────────┐     ┌────────┐
│ Ingest  │────▶│ Score │────▶│ Draft │────▶│ Approve │────▶│ Runner │
│  Job    │     │  Fit  │     │ Mtrls │     │ (Human) │     │ Autofill│
└─────────┘     └───────┘     └───────┘     └─────────┘     └────────┘
     │               │             │              │               │
     ▼               ▼             ▼              ▼               ▼
JobPosting      FitScore   MaterialVersion   status=     RunnerRun
status=new    status=scored  stage=generated  'approved'  + artifacts
```

### Inline vs Queue Mode

| Feature | Inline Mode (no Redis) | Queue Mode (with Redis) |
|---------|------------------------|-------------------------|
| **REDIS_URL** | Not set | Set to Redis URL |
| **Execution** | Synchronous (blocks HTTP request) | Asynchronous (via BullMQ) |
| **Latency** | Response after completion | Immediate response |
| **Worker** | Not needed | Must run `pnpm worker` |
| **Use Case** | Local dev, low volume | Production, high volume |
| **Retry** | None (request fails) | 3 attempts, exponential backoff |

### Key Design Principles

1. **Approval Gates Runner**: Only approved jobs can be automated (status must be `'approved'`)
2. **Runner Never Auto-Submits**: Always stops before final submit for v0 safety
3. **Idempotency**: Repeated pipeline runs don't duplicate materials
4. **Conservative Deduplication**: Only dedupe on exact `dedupeKey` match to avoid false merges
5. **Validation Errors → Needs Attention**: Resume guardrail violations set `status='needs_attention'`

### Database Schema

Core models:
- `JobPosting` - Job data with unique `dedupeKey`
- `FitScore` - Computed fit score (0-100) with reasoning
- `MaterialPacket` - Container for application materials
- `MaterialVersion` - Versioned materials with stages: `generated` → `edited` → `approved`
- `RunnerRun` - Execution record with status and artifacts
- `StatusEvent` - Audit trail of status transitions

---

## Troubleshooting

### 1. **Error: `DATABASE_URL` is required**

**Cause:** Missing or invalid `DATABASE_URL` in `apps/web/.env`

**Fix:**
```bash
# Edit apps/web/.env
DATABASE_URL="postgresql://postgres:password@localhost:5432/jobagent?schema=public"
```

Ensure PostgreSQL is running:
```bash
# macOS:
brew services start postgresql

# Check connection:
psql -U postgres -h localhost
```

---

### 2. **Error: Database connection failed**

**Cause:** PostgreSQL not running or wrong credentials

**Fix:**
```bash
# Check if PostgreSQL is running:
pg_isready -h localhost -p 5432

# If not running, start it:
brew services start postgresql  # macOS
sudo systemctl start postgresql # Linux

# Create database if it doesn't exist:
psql -U postgres -c "CREATE DATABASE jobagent;"
```

---

### 3. **Error: Queue mode not enabled**

**Cause:** Trying to use queue operations without `REDIS_URL` set

**Fix:**
- **To enable queue mode:** Set `REDIS_URL="redis://localhost:6379"` in `apps/web/.env` and start Redis
- **To use inline mode:** Remove or comment out `REDIS_URL` in `.env`

---

### 4. **Error: Worker crashes with Redis connection error**

**Cause:** Redis not running or wrong `REDIS_URL`

**Fix:**
```bash
# Check if Redis is running:
redis-cli ping
# Should return: PONG

# If not running, start Redis:
brew services start redis  # macOS
sudo systemctl start redis # Linux

# Or run in foreground:
redis-server
```

---

### 5. **Error: Runner 401 Unauthorized**

**Cause:** `RUNNER_API_KEY` mismatch between web app and runner

**Fix:**
```bash
# Ensure both files have the SAME key:

# apps/web/.env
RUNNER_API_KEY="your-secret-key"

# packages/runner/.env
RUNNER_API_KEY="your-secret-key"

# Restart web app after changing .env
```

---

### 6. **Error: No approved materials found**

**Cause:** Trying to run runner on a job that hasn't been approved

**Fix:**
```bash
# Approve the job first:
curl -X POST http://localhost:3000/api/jobs/{jobId}/approve

# Then run the runner:
runner apply --job {jobId}
```

---

### 7. **Error: Prisma migrations out of sync**

**Cause:** Database schema doesn't match Prisma schema

**Fix:**
```bash
cd apps/web

# Push schema to database (dev only):
pnpm db:push

# Or run migrations (production):
pnpm db:migrate

# If database is corrupted, reset (WARNING: deletes all data):
npx prisma migrate reset
pnpm db:seed
```

---

### 8. **Error: OpenAI API key invalid**

**Cause:** Invalid or missing `OPENAI_API_KEY`

**Fix:**
- **If you don't have an API key:** Comment out `OPENAI_API_KEY` in `.env` - the app will create placeholder materials
- **If you have a key:** Ensure it's valid and starts with `sk-` (get one at https://platform.openai.com/api-keys)

---

### 9. **Error: Runner browser crashes**

**Cause:** Playwright browsers not installed

**Fix:**
```bash
cd packages/runner

# Install Playwright browsers:
npx playwright install

# Or install just Chromium:
npx playwright install chromium
```

---

### 10. **Error: Port 3000 already in use**

**Cause:** Another process is using port 3000

**Fix:**
```bash
# Find and kill the process:
lsof -ti:3000 | xargs kill -9

# Or change the port:
# In apps/web, run:
PORT=3001 pnpm dev

# Update RUNNER_APP_BASE_URL in packages/runner/.env to match
```

---

## Project Structure

```
job-application-agent/
├── apps/
│   └── web/                   # Next.js web app
│       ├── prisma/            # Database schema + migrations
│       ├── src/
│       │   ├── app/           # Next.js App Router (pages + API routes)
│       │   ├── lib/           # Services, logger, queues, env
│       │   └── workers/       # BullMQ worker processes
│       └── package.json       # Scripts: dev, test, worker, db:*
├── packages/
│   ├── shared/                # Framework-agnostic core logic
│   │   ├── src/               # Zod schemas, extractors, scoring
│   │   └── test/              # Unit tests + HTML fixtures
│   └── runner/                # Playwright CLI automation
│       ├── src/               # CLI, apply logic, config
│       └── dist/              # Compiled TypeScript (after build)
├── .gitignore
├── package.json               # Workspace root
└── README.md
```

---

## Environment Variables Reference

### `apps/web/.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | - | PostgreSQL connection string |
| `REDIS_URL` | ❌ | - | Redis URL (enables queue mode) |
| `OPENAI_API_KEY` | ❌ | - | OpenAI API key (enables LLM drafting) |
| `RUNNER_API_KEY` | ✅ | - | Shared secret for runner auth |
| `NEXT_PUBLIC_APP_URL` | ❌ | `http://localhost:3000` | Public app URL |
| `NODE_ENV` | ❌ | `development` | Node environment |

### `packages/runner/.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RUNNER_APP_BASE_URL` | ✅ | - | Web app API base URL |
| `RUNNER_API_KEY` | ✅ | - | Must match web app's key |
| `RUNNER_ARTIFACT_DIR` | ❌ | `./artifacts` | Artifact save directory |
| `RUNNER_HEADLESS` | ❌ | `true` | Browser headless mode |
| `RUNNER_POST_RESULTS` | ❌ | `true` | Post reports to web app |

---

## Common Workflows

### Add KB Bullets (Manual)

```bash
curl -X POST http://localhost:3000/api/kb/bullets \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Built scalable microservices handling 1M+ requests/day",
    "tags": ["backend", "scalability", "microservices"]
  }'
```

### Check Job Status

```bash
curl http://localhost:3000/api/jobs/{jobId}
```

### Reject a Job

```bash
curl -X POST http://localhost:3000/api/jobs/{jobId}/reject \
  -H "Content-Type: application/json" \
  -d '{ "reason": "Not a good fit" }'
```

### Edit Material

```bash
curl -X POST http://localhost:3000/api/materials/{materialVersionId}/edit \
  -H "Content-Type: application/json" \
  -d '{
    "content": { "text": "Updated cover letter text..." }
  }'
```

---

## Contributing

This is a v0 implementation focused on core functionality. Future enhancements may include:
- Multi-user auth and tenancy
- Additional ATS adapters (Lever, Workday, etc.)
- Scheduled job polling
- Full metrics and observability
- Hosted runner service

For now, keep changes focused on:
1. Test coverage improvements
2. Bug fixes
3. Documentation clarity
4. Performance optimizations

---

## License

MIT

---

## Support

For issues or questions:
1. Check the **Troubleshooting** section above
2. Review test files for usage examples
3. Open an issue on GitHub with:
   - Steps to reproduce
   - Error messages (from logs)
   - Environment details (OS, Node version, PostgreSQL version)
