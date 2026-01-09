/**
 * Validation for resume variants to ensure guardrails are maintained
 */

/**
 * Scope escalation keywords that should not be introduced
 */
const SCOPE_ESCALATION_KEYWORDS = [
  'led',
  'lead',
  'owned',
  'own',
  'managed',
  'manage',
  'directed',
  'direct',
  'spearheaded',
  'spearhead',
  'drove',
  'drive',
  'oversaw',
  'oversee',
] as const;

export interface ValidationError {
  type: 'number_changed' | 'new_tech_term' | 'scope_escalation';
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidateResumeVariantInput {
  originalBullet: {
    text: string;
    tags: string[];
  };
  generatedVariant: string;
  allowedTechTerms: string[]; // Includes tags from bullet + global dictionary
}

/**
 * Extract numbers from text (integers and decimals)
 */
export function extractNumbers(text: string): string[] {
  const numberRegex = /\d+\.?\d*/g;
  return text.match(numberRegex) || [];
}

/**
 * Extract tech terms from tags (normalized to lowercase)
 */
export function extractTechTerms(tags: string[]): string[] {
  return tags.map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ''));
}

/**
 * Extract scope escalation keywords from text
 */
export function extractScopeKeywords(text: string): string[] {
  const textLower = text.toLowerCase();
  return SCOPE_ESCALATION_KEYWORDS.filter((keyword) => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    return regex.test(textLower);
  });
}

/**
 * Validate resume variant against original bullet
 * Returns validation result with specific errors
 */
export function validateResumeVariant(
  input: ValidateResumeVariantInput
): ValidationResult {
  const { originalBullet, generatedVariant, allowedTechTerms } = input;
  const errors: ValidationError[] = [];

  // 1. Check if numbers changed
  const originalNumbers = extractNumbers(originalBullet.text);
  const variantNumbers = extractNumbers(generatedVariant);

  // Sort for comparison
  const originalSorted = [...originalNumbers].sort();
  const variantSorted = [...variantNumbers].sort();

  if (JSON.stringify(originalSorted) !== JSON.stringify(variantSorted)) {
    errors.push({
      type: 'number_changed',
      message: `Numbers changed: original [${originalSorted.join(', ')}] vs variant [${variantSorted.join(', ')}]`,
    });
  }

  // 2. Check for new tech terms
  const variantLower = generatedVariant.toLowerCase();
  const allowedTermsNormalized = extractTechTerms(allowedTechTerms);

  // Common tech terms that might appear in variants
  const globalTechTerms = [
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
    'redis',
    'graphql',
    'rest',
    'api',
    'microservices',
    'ci',
    'cd',
    'git',
  ];

  // Check each global tech term
  for (const term of globalTechTerms) {
    if (variantLower.includes(term)) {
      const isAllowed =
        allowedTermsNormalized.includes(term) ||
        originalBullet.text.toLowerCase().includes(term);

      if (!isAllowed) {
        errors.push({
          type: 'new_tech_term',
          message: `New tech term introduced: "${term}" not in original bullet or allowed tags`,
        });
      }
    }
  }

  // 3. Check for scope escalation
  const originalScopeKeywords = extractScopeKeywords(originalBullet.text);
  const variantScopeKeywords = extractScopeKeywords(generatedVariant);

  // Find keywords in variant that weren't in original
  const newScopeKeywords = variantScopeKeywords.filter(
    (kw) => !originalScopeKeywords.includes(kw)
  );

  for (const keyword of newScopeKeywords) {
    errors.push({
      type: 'scope_escalation',
      message: `Scope escalation keyword added: "${keyword}" was not in original bullet`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
