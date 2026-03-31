export interface LLMRequestOptions {
  /** JSON モードを強制する (対応プロバイダーのみ) */
  jsonMode?: boolean;
}

export interface LLMProvider {
  generateText(prompt: string, options?: LLMRequestOptions): Promise<string>;
}

export type LLMProviderName = 'gemini' | 'anthropic' | 'openai' | 'mock';
