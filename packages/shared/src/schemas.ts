import { z } from 'zod';

/**
 * UUID string for job posting identification
 */
export const JobPostingIdSchema = z.string().uuid();

export type JobPostingId = z.infer<typeof JobPostingIdSchema>;

/**
 * Packet sent to runner CLI to execute automation
 * (placeholder - will be expanded in future steps)
 */
export const RunnerPacketSchema = z.object({});

export type RunnerPacket = z.infer<typeof RunnerPacketSchema>;

/**
 * Report returned by runner CLI after automation completes
 * (placeholder - will be expanded in future steps)
 */
export const RunnerReportSchema = z.object({});

export type RunnerReport = z.infer<typeof RunnerReportSchema>;
