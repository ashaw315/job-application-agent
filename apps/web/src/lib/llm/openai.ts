import OpenAI from 'openai';
import {
  LlmClient,
  LlmGenerateTextInput,
  LlmGenerateTextOutput,
} from './types';

/**
 * OpenAI LLM client adapter
 */
export class OpenAiClient implements LlmClient {
  private client: OpenAI;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel = 'gpt-4o-mini') {
    this.client = new OpenAI({ apiKey });
    this.defaultModel = defaultModel;
  }

  async generateText(
    input: LlmGenerateTextInput
  ): Promise<LlmGenerateTextOutput> {
    const {
      prompt,
      systemPrompt = 'You are a professional resume and cover letter writer.',
      maxTokens = 1000,
      temperature = 0.7,
    } = input;

    const completion = await this.client.chat.completions.create({
      model: this.defaultModel,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: maxTokens,
      temperature,
    });

    const text = completion.choices[0]?.message?.content || '';
    const usage = completion.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    return {
      text,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
      model: completion.model,
    };
  }
}
