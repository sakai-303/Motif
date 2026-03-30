import OpenAI from 'openai';
import type { LLMProvider, LLMRequestOptions } from '../types';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4o') {
    this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    this.model = model;
  }

  async generateText(prompt: string, options: LLMRequestOptions = {}): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      response_format: options.jsonMode ? { type: 'json_object' } : undefined,
    });
    return response.choices[0]?.message.content ?? '';
  }
}
