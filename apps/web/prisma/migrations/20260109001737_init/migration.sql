-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "job_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "atsType" TEXT NOT NULL,
    "scrapedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "job_postings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "jobSourceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "job_postings_jobSourceId_fkey" FOREIGN KEY ("jobSourceId") REFERENCES "job_sources" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "fit_scores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobPostingId" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "reasoning" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "fit_scores_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "job_postings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "kb_bullets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "kb_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "technologies" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "kb_star_stories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "situation" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "material_packets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobPostingId" TEXT NOT NULL,
    "resumeVariantText" TEXT NOT NULL,
    "coverLetterText" TEXT,
    "customAnswers" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "material_packets_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "job_postings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "material_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialPacketId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "material_versions_materialPacketId_fkey" FOREIGN KEY ("materialPacketId") REFERENCES "material_packets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "status_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobPostingId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "status_events_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "job_postings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "follow_up_suggestions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobPostingId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "suggestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "follow_up_suggestions_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "job_postings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "follow_up_email_drafts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "followUpSuggestionId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "follow_up_email_drafts_followUpSuggestionId_fkey" FOREIGN KEY ("followUpSuggestionId") REFERENCES "follow_up_suggestions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "runner_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobPostingId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "runner_runs_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "job_postings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "runner_artifacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runnerRunId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "filePath" TEXT,
    "content" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "runner_artifacts_runnerRunId_fkey" FOREIGN KEY ("runnerRunId") REFERENCES "runner_runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "job_sources_url_idx" ON "job_sources"("url");

-- CreateIndex
CREATE UNIQUE INDEX "job_postings_dedupeKey_key" ON "job_postings"("dedupeKey");

-- CreateIndex
CREATE INDEX "job_postings_status_idx" ON "job_postings"("status");

-- CreateIndex
CREATE INDEX "job_postings_company_idx" ON "job_postings"("company");

-- CreateIndex
CREATE INDEX "job_postings_createdAt_idx" ON "job_postings"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "fit_scores_jobPostingId_key" ON "fit_scores"("jobPostingId");

-- CreateIndex
CREATE INDEX "material_packets_jobPostingId_idx" ON "material_packets"("jobPostingId");

-- CreateIndex
CREATE INDEX "material_versions_materialPacketId_idx" ON "material_versions"("materialPacketId");

-- CreateIndex
CREATE UNIQUE INDEX "material_versions_materialPacketId_version_key" ON "material_versions"("materialPacketId", "version");

-- CreateIndex
CREATE INDEX "status_events_jobPostingId_idx" ON "status_events"("jobPostingId");

-- CreateIndex
CREATE INDEX "status_events_createdAt_idx" ON "status_events"("createdAt");

-- CreateIndex
CREATE INDEX "follow_up_suggestions_jobPostingId_idx" ON "follow_up_suggestions"("jobPostingId");

-- CreateIndex
CREATE INDEX "follow_up_email_drafts_followUpSuggestionId_idx" ON "follow_up_email_drafts"("followUpSuggestionId");

-- CreateIndex
CREATE INDEX "runner_runs_jobPostingId_idx" ON "runner_runs"("jobPostingId");

-- CreateIndex
CREATE INDEX "runner_runs_status_idx" ON "runner_runs"("status");

-- CreateIndex
CREATE INDEX "runner_runs_startedAt_idx" ON "runner_runs"("startedAt");

-- CreateIndex
CREATE INDEX "runner_artifacts_runnerRunId_idx" ON "runner_artifacts"("runnerRunId");

-- CreateIndex
CREATE INDEX "runner_artifacts_artifactType_idx" ON "runner_artifacts"("artifactType");
