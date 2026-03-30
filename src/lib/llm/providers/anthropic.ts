import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMRequestOptions } from '../types';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-6') {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    this.model = model;
  }

  async generateText(prompt: string, options: LLMRequestOptions = {}): Promise<string> {
    const systemPrompt = options.jsonMode
      ? 'You must respond with valid JSON only. No explanation, no markdown fences, just raw JSON.'
      : undefined;

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = message.content[0];
    return block.type === 'text' ? block.text : '';
  }
}
