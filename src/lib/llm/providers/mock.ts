import type { LLMProvider, LLMRequestOptions } from '../types';

const DEFAULT_MOCK_JSON_RESPONSE = JSON.stringify({
  summary: 'デバッグ用モックレスポンスです。実際のLLM呼び出しは行っていません。',
  keyTraits: [
    {
      title: 'ドライなリズム処理',
      description: 'キックとスネアを前面に出し、余韻を短くしてグルーヴを際立たせる。',
      exampleTrack: 'Debug Track 01',
    },
    {
      title: '空間系のレイヤリング',
      description: 'ステレオの奥行きを段階的に設計し、各帯域の役割を明確化する。',
      exampleTrack: 'Debug Track 02',
    },
  ],
  deepDive:
    'これはモックです。\\n\\n- 実APIを叩かずにUI確認できます。\\n- トラックリンク形式: [Debug Track 01](track:Debug Track 01)',
});

export class MockProvider implements LLMProvider {
  constructor(private readonly mockResponse = DEFAULT_MOCK_JSON_RESPONSE) {}

  async generateText(_prompt: string, options: LLMRequestOptions = {}): Promise<string> {
    if (options.jsonMode) {
      return this.mockResponse;
    }
    return 'Debug mock response from MockProvider.';
  }
}
