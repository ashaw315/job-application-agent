import { z } from 'zod';

/**
 * Curated skill dictionary for keyword extraction
 */
const SKILL_KEYWORDS = [
  'typescript',
  'javascript',
  'react',
  'node',
  'nodejs',
  'python',
  'java',
  'golang',
  'rust',
  'sql',
  'postgresql',
  'mongodb',
  'aws',
  'docker',
  'kubernetes',
] as const;

/**
 * Evidence pointer format:
 * - kb:bullet:<id> for knowledge base bullet matches
 * - job:keyword:<term> for job keyword matches
 */
export type EvidencePointer = `kb:bullet:${string}` | `job:keyword:${string}`;

/**
 * Bullet match category
 */
export type BulletCategory = 'strong' | 'partial' | 'gap' | 'risk';

/**
 * Matched bullet with evidence
 */
export interface MatchedBullet {
  bulletId: string;
  bulletText: string;
  category: BulletCategory;
  evidence: EvidencePointer[];
  score: number; // 0-100 contribution to overall score
}

/**
 * Score breakdown for explainability
 */
export interface ScoreBreakdown {
  keywordMatches: number; // Points from keyword matching
  bulletMatches: number; // Points from KB bullet matching
  roleTypeBonus: number; // Bonus for matching role type
  seniorityBonus: number; // Bonus for matching seniority
  remoteBonus: number; // Bonus for remote preference
  total: number; // Final score (0-100)
}

/**
 * Fit score result
 */
export interface FitScoreResult {
  score: number; // 0-100
  bullets: MatchedBullet[];
  breakdown: ScoreBreakdown;
  reasoning: string;
}

/**
 * Job posting data for scoring (simplified)
 */
export interface JobForScoring {
  title: string;
  company: string;
  location?: string | null;
  description: string;
}

/**
 * KB bullet for scoring
 */
export interface KbBulletForScoring {
  id: string;
  text: string;
  tags: string; // JSON array stored as string
}

/**
 * Extract keywords from job description using curated dictionary
 */
export function extractKeywords(description: string): string[] {
  const descLower = description.toLowerCase();
  const found: string[] = [];

  for (const keyword of SKILL_KEYWORDS) {
    // Use word boundaries to avoid partial matches (e.g., "java" in "javascript")
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(descLower)) {
      found.push(keyword);
    }
  }

  return found;
}

/**
 * Infer role type from job title
 * Returns: frontend | backend | fullstack | devops | data | other
 */
export function inferRoleType(title: string): string {
  const titleLower = title.toLowerCase();

  if (
    titleLower.includes('frontend') ||
    titleLower.includes('front-end') ||
    titleLower.includes('front end')
  ) {
    return 'frontend';
  }

  if (
    titleLower.includes('backend') ||
    titleLower.includes('back-end') ||
    titleLower.includes('back end')
  ) {
    return 'backend';
  }

  if (
    titleLower.includes('fullstack') ||
    titleLower.includes('full-stack') ||
    titleLower.includes('full stack')
  ) {
    return 'fullstack';
  }

  if (titleLower.includes('devops') || titleLower.includes('sre')) {
    return 'devops';
  }

  if (
    titleLower.includes('data') ||
    titleLower.includes('ml') ||
    titleLower.includes('machine learning')
  ) {
    return 'data';
  }

  return 'other';
}

/**
 * Infer seniority hint from job title
 * Returns: junior | mid | senior | staff | principal
 */
export function inferSeniorityHint(title: string): string {
  const titleLower = title.toLowerCase();

  if (
    titleLower.includes('principal') ||
    titleLower.includes('distinguished')
  ) {
    return 'principal';
  }

  if (titleLower.includes('staff')) {
    return 'staff';
  }

  if (titleLower.includes('senior') || titleLower.includes('sr.')) {
    return 'senior';
  }

  if (
    titleLower.includes('junior') ||
    titleLower.includes('jr.') ||
    titleLower.includes('entry')
  ) {
    return 'junior';
  }

  // Default to mid-level if no explicit seniority marker
  return 'mid';
}

/**
 * Infer remote work type from location
 * Returns: remote | hybrid | onsite
 */
export function inferRemoteType(location?: string | null): string {
  if (!location) {
    return 'onsite';
  }

  const locationLower = location.toLowerCase();

  if (locationLower.includes('remote')) {
    return 'remote';
  }

  if (locationLower.includes('hybrid')) {
    return 'hybrid';
  }

  return 'onsite';
}

/**
 * Compute fit score based on job and KB bullets
 * This is a deterministic, explainable scoring algorithm
 */
export function computeFitScore(
  job: JobForScoring,
  kbBullets: KbBulletForScoring[]
): FitScoreResult {
  // Step 1: Extract keywords from job description
  const jobKeywords = extractKeywords(job.description);

  // Step 2: Infer job characteristics
  const roleType = inferRoleType(job.title);
  const seniority = inferSeniorityHint(job.title);
  const remoteType = inferRemoteType(job.location);

  // Step 3: Match KB bullets to job keywords
  const matchedBullets: MatchedBullet[] = [];
  let bulletMatchScore = 0;

  for (const bullet of kbBullets) {
    const bulletLower = bullet.text.toLowerCase();
    const evidence: EvidencePointer[] = [];
    let matches = 0;

    // Check how many job keywords match this bullet
    for (const keyword of jobKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(bulletLower)) {
        evidence.push(`job:keyword:${keyword}`);
        matches++;
      }
    }

    // Categorize bullet based on match strength
    let category: BulletCategory;
    let score: number;

    if (matches >= 3) {
      category = 'strong';
      score = 15; // Strong matches contribute more
      bulletMatchScore += score;
    } else if (matches >= 2) {
      category = 'partial';
      score = 10;
      bulletMatchScore += score;
    } else if (matches === 1) {
      category = 'partial';
      score = 5;
      bulletMatchScore += score;
    } else {
      category = 'gap';
      score = 0;
    }

    // Add evidence pointer to bullet
    evidence.push(`kb:bullet:${bullet.id}`);

    matchedBullets.push({
      bulletId: bullet.id,
      bulletText: bullet.text,
      category,
      evidence,
      score,
    });
  }

  // Step 4: Calculate keyword match score
  const keywordMatchScore = Math.min(jobKeywords.length * 5, 40); // Cap at 40 points

  // Step 5: Calculate bonuses
  let roleTypeBonus = 0;
  if (roleType === 'fullstack' || roleType === 'backend') {
    roleTypeBonus = 10; // Prefer fullstack/backend roles
  }

  let seniorityBonus = 0;
  if (seniority === 'senior' || seniority === 'staff') {
    seniorityBonus = 10; // Prefer senior roles
  }

  let remoteBonus = 0;
  if (remoteType === 'remote' || remoteType === 'hybrid') {
    remoteBonus = 5; // Prefer remote/hybrid
  }

  // Step 6: Calculate total score
  const total = Math.min(
    keywordMatchScore +
      bulletMatchScore +
      roleTypeBonus +
      seniorityBonus +
      remoteBonus,
    100
  );

  // Step 7: Generate reasoning
  const reasoning = [
    `Found ${jobKeywords.length} matching keywords: ${jobKeywords.join(', ') || 'none'}.`,
    `Role type: ${roleType}. Seniority: ${seniority}. Remote: ${remoteType}.`,
    `Matched ${matchedBullets.filter((b) => b.category === 'strong').length} strong bullets,`,
    `${matchedBullets.filter((b) => b.category === 'partial').length} partial bullets,`,
    `${matchedBullets.filter((b) => b.category === 'gap').length} gaps.`,
  ].join(' ');

  return {
    score: total,
    bullets: matchedBullets,
    breakdown: {
      keywordMatches: keywordMatchScore,
      bulletMatches: bulletMatchScore,
      roleTypeBonus,
      seniorityBonus,
      remoteBonus,
      total,
    },
    reasoning,
  };
}

/**
 * Zod schema for FitScoreResult
 */
export const FitScoreResultSchema = z.object({
  score: z.number().min(0).max(100),
  bullets: z.array(
    z.object({
      bulletId: z.string(),
      bulletText: z.string(),
      category: z.enum(['strong', 'partial', 'gap', 'risk']),
      evidence: z.array(z.string()),
      score: z.number(),
    })
  ),
  breakdown: z.object({
    keywordMatches: z.number(),
    bulletMatches: z.number(),
    roleTypeBonus: z.number(),
    seniorityBonus: z.number(),
    remoteBonus: z.number(),
    total: z.number(),
  }),
  reasoning: z.string(),
});

/**
 * Selected KB bullet with overlap score
 */
export interface SelectedBullet {
  bulletId: string;
  overlapScore: number;
}

/**
 * Result of selectRelevantBullets
 */
export interface RelevantBulletsResult {
  selectedBullets: SelectedBullet[];
  jobKeywords: string[];
}

/**
 * Select relevant KB bullets based on tag overlap with job keywords
 * Uses stable ordering: by overlap desc, then bullet ID asc
 */
export function selectRelevantBullets({
  jobKeywords,
  kbBullets,
  limit = 10,
}: {
  jobKeywords: string[];
  kbBullets: KbBulletForScoring[];
  limit?: number;
}): RelevantBulletsResult {
  // Compute overlap score for each bullet
  const scored = kbBullets.map((bullet) => {
    let tags: string[] = [];
    try {
      tags = JSON.parse(bullet.tags);
      if (!Array.isArray(tags)) {
        tags = [];
      }
    } catch {
      tags = [];
    }

    // Normalize tags to lowercase
    const tagsLower = tags.map((t) => t.toLowerCase());

    // Count how many job keywords appear in the bullet's tags
    const overlap = jobKeywords.filter((kw) => tagsLower.includes(kw)).length;

    return {
      bulletId: bullet.id,
      overlapScore: overlap,
    };
  });

  // Sort by overlap (desc), then by bulletId (asc) for stable ordering
  scored.sort((a, b) => {
    if (a.overlapScore !== b.overlapScore) {
      return b.overlapScore - a.overlapScore; // Higher overlap first
    }
    return a.bulletId.localeCompare(b.bulletId); // Stable tie-breaker
  });

  // Take top N
  const selectedBullets = scored.slice(0, limit);

  return {
    selectedBullets,
    jobKeywords,
  };
}

/**
 * Zod schema for RelevantBulletsResult
 */
export const RelevantBulletsResultSchema = z.object({
  selectedBullets: z.array(
    z.object({
      bulletId: z.string(),
      overlapScore: z.number(),
    })
  ),
  jobKeywords: z.array(z.string()),
});
