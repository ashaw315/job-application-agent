/*
  Warnings:

  - You are about to drop the column `metadata` on the `runner_artifacts` table. All the data in the column will be lost.
  - You are about to drop the column `errorMessage` on the `runner_runs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "status_events" ADD COLUMN "actor" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_runner_artifacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runnerRunId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "filePath" TEXT,
    "content" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "runner_artifacts_runnerRunId_fkey" FOREIGN KEY ("runnerRunId") REFERENCES "runner_runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_runner_artifacts" ("artifactType", "content", "createdAt", "filePath", "id", "runnerRunId") SELECT "artifactType", "content", "createdAt", "filePath", "id", "runnerRunId" FROM "runner_artifacts";
DROP TABLE "runner_artifacts";
ALTER TABLE "new_runner_artifacts" RENAME TO "runner_artifacts";
CREATE INDEX "runner_artifacts_runnerRunId_idx" ON "runner_artifacts"("runnerRunId");
CREATE INDEX "runner_artifacts_artifactType_idx" ON "runner_artifacts"("artifactType");
CREATE TABLE "new_runner_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobPostingId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errors" TEXT NOT NULL DEFAULT '[]',
    "warnings" TEXT NOT NULL DEFAULT '[]',
    "stoppedReason" TEXT,
    "appliedAt" DATETIME,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "runner_runs_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "job_postings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_runner_runs" ("completedAt", "createdAt", "id", "jobPostingId", "startedAt", "status", "updatedAt") SELECT "completedAt", "createdAt", "id", "jobPostingId", "startedAt", "status", "updatedAt" FROM "runner_runs";
DROP TABLE "runner_runs";
ALTER TABLE "new_runner_runs" RENAME TO "runner_runs";
CREATE INDEX "runner_runs_jobPostingId_idx" ON "runner_runs"("jobPostingId");
CREATE INDEX "runner_runs_status_idx" ON "runner_runs"("status");
CREATE INDEX "runner_runs_startedAt_idx" ON "runner_runs"("startedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
