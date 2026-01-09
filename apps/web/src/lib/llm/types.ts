/**
 * LLM task types for application material generation
 */
export type LlmTask = 'cover_letter' | 'resume_variant';

/**
 * Input for LLM text generation
 */
export interface LlmGenerateTextInput {
  task: LlmTask;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Output from LLM text generation
 */
export interface LlmGenerateTextOutput {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

/**
 * Provider-agnostic LLM client interface
 * Implementations: OpenAI, Anthropic, etc.
 */
export interface LlmClient {
  /**
   * Generate text for a specific task
   */
  generateText(input: LlmGenerateTextInput): Promise<LlmGenerateTextOutput>;
}
