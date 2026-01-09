/**
 * Pure functions for building LLM prompts
 */

export interface JobForPrompt {
  title: string;
  company: string;
  description: string;
  location?: string | null;
}

export interface BulletForPrompt {
  id: string;
  text: string;
  tags: string[]; // Already parsed JSON array
}

export interface UserProfileForPrompt {
  name: string;
  email: string;
  phone?: string | null;
}

export interface CoverLetterPromptInput {
  job: JobForPrompt;
  selectedBullets: BulletForPrompt[];
  userProfile: UserProfileForPrompt;
}

/**
 * Build a cover letter generation prompt
 */
export function buildCoverLetterPrompt(
  input: CoverLetterPromptInput
): string {
  const { job, selectedBullets, userProfile } = input;

  const bulletsList =
    selectedBullets.length > 0
      ? selectedBullets
          .map((b, idx) => {
            const tagsStr = b.tags.length > 0 ? ` [${b.tags.join(', ')}]` : '';
            return `${idx + 1}. ${b.text}${tagsStr}`;
          })
          .join('\n')
      : 'No specific experience bullets provided.';

  const locationStr = job.location ? ` (${job.location})` : '';

  return `You are writing a professional cover letter for ${userProfile.name}.

Job Details:
- Title: ${job.title}
- Company: ${job.company}${locationStr}
- Description: ${job.description}

Candidate's Relevant Experience (from resume):
${bulletsList}

Instructions:
1. Write a compelling cover letter that highlights how the candidate's experience matches this specific role
2. ONLY use the experience bullets provided above - do not invent or fabricate any experiences
3. Connect specific experiences to job requirements where relevant
4. Keep the tone professional but personable
5. The letter should be 3-4 paragraphs
6. Address it to the hiring team at ${job.company}
7. Sign it with "${userProfile.name}"

IMPORTANT: Do not invent any experience, skills, or achievements that are not in the provided experience bullets.

Generate the cover letter now:`;
}

/**
 * Build system prompt for cover letter generation
 */
export function buildCoverLetterSystemPrompt(): string {
  return `You are a professional resume and cover letter writer. Your role is to help job seekers create compelling application materials that honestly represent their experience. Never fabricate or exaggerate experiences.`;
}

export interface ResumeVariantPromptInput {
  job: JobForPrompt;
  selectedBullets: BulletForPrompt[];
}

/**
 * Build a resume variant generation prompt with strict guardrails
 */
export function buildResumeVariantPrompt(
  input: ResumeVariantPromptInput
): string {
  const { job, selectedBullets } = input;

  const bulletsList =
    selectedBullets.length > 0
      ? selectedBullets
          .map((b, idx) => {
            const tagsStr = b.tags.length > 0 ? ` [${b.tags.join(', ')}]` : '';
            return `${idx + 1}. "${b.text}"${tagsStr}`;
          })
          .join('\n')
      : 'No experience bullets provided.';

  return `You are creating a tailored resume variant for a specific job application.

Job Details:
- Title: ${job.title}
- Company: ${job.company}
- Description: ${job.description}

Original Resume Bullets (to be lightly rewritten):
${bulletsList}

Instructions - STRICT GUARDRAILS:
1. LIGHT REWRITING ONLY - make minor word choice improvements to better match the job
2. NEVER CHANGE NUMBERS OR METRICS - keep all numbers (percentages, counts, sizes) exactly as they appear
3. NEVER ADD NEW TECH/TOOLS - only use technologies and tools that appear in the original bullet's tags or text
4. NO SCOPE ESCALATION - do not add words like "led", "owned", "managed", "directed" unless they were in the original bullet
5. Keep the same level of responsibility and scope as the original
6. Focus on relevance to the job without embellishing

Output format:
For each bullet, output ONLY the rewritten text, one per line.
Do not include bullet numbers or any other formatting.

CRITICAL: Violating these guardrails will cause the resume to be rejected. Be conservative and truthful.

Generate the rewritten bullets now:`;
}

/**
 * Build system prompt for resume variant generation
 */
export function buildResumeVariantSystemPrompt(): string {
  return `You are a professional resume writer who specializes in tailoring resumes for specific jobs. You MUST follow strict guardrails: never change numbers, never add new technologies not in the original text, never add scope escalation words like "led" or "owned" unless present in original. Your job is light rewriting only to improve relevance.`;
}
