/**
 * Job data types for BullMQ queues
 * These define the shape of data passed to queue jobs
 */

/**
 * Score job - compute fit score for a job posting
 */
export interface ScoreJobData {
  jobPostingId: string;
  idempotencyKey: string; // Format: "score:{jobPostingId}"
}

/**
 * Draft job - generate application materials (cover letter + resume variant)
 */
export interface DraftJobData {
  jobPostingId: string;
  materialPacketId: string;
  idempotencyKey: string; // Format: "draft:{jobPostingId}"
}

/**
 * Follow-up job - generate follow-up email suggestions and draft
 */
export interface FollowUpJobData {
  jobPostingId: string;
  suggestionId?: string; // If provided, draft email for this suggestion
  idempotencyKey: string; // Format: "followup:{jobPostingId}:{suggestionId?}"
}

/**
 * Job result types
 */
export interface ScoreJobResult {
  success: boolean;
  jobPostingId: string;
  score?: number;
  error?: string;
}

export interface DraftJobResult {
  success: boolean;
  jobPostingId: string;
  materialPacketId?: string;
  coverLetterVersionId?: string;
  resumeVersionId?: string;
  error?: string;
}

export interface FollowUpJobResult {
  success: boolean;
  jobPostingId: string;
  suggestionIds?: string[];
  draftId?: string;
  error?: string;
}
