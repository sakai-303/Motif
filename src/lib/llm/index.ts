import type { LLMProvider, LLMProviderName } from './types';
import { GeminiProvider } from './providers/gemini';

export type { LLMProvider, LLMProviderName };

/**
 * 環境変数 VITE_LLM_PROVIDER でプロバイダーを切り替える。
 * 未設定の場合は gemini にフォールバック。
 *
 * 例:
 *   VITE_LLM_PROVIDER=gemini     VITE_GEMINI_API_KEY=...
 *   VITE_LLM_PROVIDER=anthropic  VITE_ANTHROPIC_API_KEY=...
 *   VITE_LLM_PROVIDER=openai     VITE_OPENAI_API_KEY=...
 */
export function createLLMProvider(): LLMProvider {
  const providerName = (import.meta.env.VITE_LLM_PROVIDER ?? 'gemini') as LLMProviderName;

  switch (providerName) {
    case 'anthropic': {
      const { AnthropicProvider } = require('./providers/anthropic');
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY ?? '';
      const model = import.meta.env.VITE_ANTHROPIC_MODEL;
      return new AnthropicProvider(apiKey, model);
    }
    case 'openai': {
      const { OpenAIProvider } = require('./providers/openai');
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY ?? '';
      const model = import.meta.env.VITE_OPENAI_MODEL;
      return new OpenAIProvider(apiKey, model);
    }
    case 'gemini':
    default: {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY ?? import.meta.env.GEMINI_API_KEY ?? '';
      const model = import.meta.env.VITE_GEMINI_MODEL;
      return new GeminiProvider(apiKey, model);
    }
  }
}
