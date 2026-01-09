import { z } from 'zod';

/**
 * UUID string for job posting identification
 */
export const JobPostingIdSchema = z.string().uuid();

export type JobPostingId = z.infer<typeof JobPostingIdSchema>;

/**
 * User profile information for job application
 */
export const UserProfileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

/**
 * Application materials ready for submission
 */
export const MaterialsSchema = z.object({
  resumeText: z.string().min(1, 'Resume text is required'),
  coverLetterText: z.string().min(1, 'Cover letter text is required'),
});

export type Materials = z.infer<typeof MaterialsSchema>;

/**
 * Allowed answers for common application questions
 * Runner should only fill these if present in the form
 */
export const AllowedAnswersSchema = z.object({
  workAuthorization: z
    .enum(['US_CITIZEN', 'GREEN_CARD', 'VISA_HOLDER', 'NEED_SPONSORSHIP'])
    .optional(),
  location: z.string().optional(),
  willingToRelocate: z.boolean().optional(),
});

export type AllowedAnswers = z.infer<typeof AllowedAnswersSchema>;

/**
 * Packet sent to runner CLI to execute automation
 * Contains everything needed to apply to a job
 */
export const RunnerPacketSchema = z.object({
  jobPostingId: JobPostingIdSchema,
  applyUrl: z.string().url('Valid application URL is required'),
  userProfile: UserProfileSchema,
  materials: MaterialsSchema,
  allowedAnswers: AllowedAnswersSchema,
});

export type RunnerPacket = z.infer<typeof RunnerPacketSchema>;

/**
 * Artifact produced by runner (screenshot, HTML, etc)
 */
export const RunnerArtifactSchema = z.object({
  type: z.enum(['screenshot', 'html', 'pdf', 'json']),
  filePath: z.string().optional(),
  content: z.string().optional(),
  description: z.string().optional(),
});

export type RunnerArtifact = z.infer<typeof RunnerArtifactSchema>;

/**
 * Report returned by runner CLI after automation completes
 * Contains results, errors, warnings, and artifacts
 */
export const RunnerReportSchema = z.object({
  jobPostingId: JobPostingIdSchema,
  status: z.enum([
    'success',
    'stopped_before_submit',
    'failed',
    'critical_error',
  ]),
  errors: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  artifacts: z.array(RunnerArtifactSchema).default([]),
  stoppedReason: z.string().optional(),
  appliedAt: z.string().datetime().optional(),
});

export type RunnerReport = z.infer<typeof RunnerReportSchema>;
