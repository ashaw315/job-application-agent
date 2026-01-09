import { z } from 'zod';

/**
 * Runner configuration schema
 * Validates environment variables required for runner operation
 */
export const RunnerConfigSchema = z.object({
  /** Base URL of the web application API */
  RUNNER_APP_BASE_URL: z
    .string()
    .url('RUNNER_APP_BASE_URL must be a valid URL')
    .default('http://localhost:3000'),

  /** API key for authenticating with the web app */
  RUNNER_API_KEY: z
    .string()
    .min(1, 'RUNNER_API_KEY is required for authentication'),

  /** Directory to store artifacts (screenshots, HTML, etc.) */
  RUNNER_ARTIFACT_DIR: z
    .string()
    .min(1, 'RUNNER_ARTIFACT_DIR must be specified')
    .default('./artifacts'),

  /** Whether to run browser in headless mode */
  RUNNER_HEADLESS: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .pipe(z.boolean())
    .default('true'),

  /** Whether to post results back to the app after completion */
  RUNNER_POST_RESULTS: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .pipe(z.boolean())
    .default('false'),
});

export type RunnerConfig = z.infer<typeof RunnerConfigSchema>;

/**
 * Load and validate runner configuration from environment
 */
export function loadConfig(): RunnerConfig {
  const result = RunnerConfigSchema.safeParse({
    RUNNER_APP_BASE_URL: process.env.RUNNER_APP_BASE_URL,
    RUNNER_API_KEY: process.env.RUNNER_API_KEY,
    RUNNER_ARTIFACT_DIR: process.env.RUNNER_ARTIFACT_DIR,
    RUNNER_HEADLESS: process.env.RUNNER_HEADLESS,
  });

  if (!result.success) {
    console.error('❌ Invalid runner configuration:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}
