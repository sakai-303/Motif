import { GoogleGenAI } from '@google/genai';
import type { LLMProvider, LLMRequestOptions } from '../types';

export class GeminiProvider implements LLMProvider {
  private ai: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model = 'gemini-2.0-flash') {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async generateText(prompt: string, options: LLMRequestOptions = {}): Promise<string> {
    const result = await this.ai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: options.jsonMode ? { responseMimeType: 'application/json' } : undefined,
    });
    return result.text ?? '';
  }
}
