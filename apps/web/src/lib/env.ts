import { z } from 'zod';

/**
 * Environment variable schema for apps/web
 * Validates at startup and provides type-safe access
 */
const EnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis (optional - enables queue mode)
  REDIS_URL: z.string().optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(), // Optional for local dev without LLM

  // Runner API Key (for runner to post results back)
  RUNNER_API_KEY: z.string().min(1, 'RUNNER_API_KEY is required'),

  // App URL (for runner to know where to post)
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default('http://localhost:3000'),

  // Node environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Validate and parse environment variables
 * Throws if validation fails with clear error messages
 */
export function validateEnv(): Env {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const errorMessages = Object.entries(errors)
      .map(([field, messages]) => `  ${field}: ${messages?.join(', ')}`)
      .join('\n');

    throw new Error(
      `Environment validation failed:\n${errorMessages}\n\nPlease check your .env file.`
    );
  }

  return result.data;
}

/**
 * Cached validated environment (lazy loaded)
 */
let _env: Env | undefined;

/**
 * Get validated environment variables (validates on first access)
 * Use this in code that requires strict validation
 */
export function getEnv(): Env {
  if (!_env) {
    _env = validateEnv();
  }
  return _env;
}

/**
 * Validated environment variables (lazy proxy)
 * Use this instead of process.env for type safety
 *
 * NOTE: Validation runs on first property access, not at module import time.
 * This allows routes like /api/health to load without requiring all env vars.
 */
export const env = new Proxy({} as Env, {
  get(_, prop) {
    return getEnv()[prop as keyof Env];
  }
});

/**
 * Check if queue mode is enabled (Redis available)
 */
export function isQueueModeEnabled(): boolean {
  return !!getEnv().REDIS_URL;
}
