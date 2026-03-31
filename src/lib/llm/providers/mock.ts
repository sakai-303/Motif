import type { LLMProvider, LLMRequestOptions } from '../types';

const DEFAULT_MOCK_JSON_RESPONSE = JSON.stringify({
  summary: 'デバッグ用モックレスポンスです。実際のLLM呼び出しは行っていません。',
  keyTraits: [
    {
      title: 'ドライなリズム処理',
      description: 'キックとスネアを前面に出し、余韻を短くしてグルーヴを際立たせる。',
      exampleTrack: '秒針を噛む',
    },
    {
      title: '空間系のレイヤリング',
      description: 'ステレオの奥行きを段階的に設計し、各帯域の役割を明確化する。',
      exampleTrack: 'TAIDADA',
    },
  ],
  deepDive:
    'これはモックです。\n\n- 実APIを叩かずにUI確認できます。\n- 時刻+再生秒数キュー形式: [Aメロ直後のハイハットの粒立ち](cue:%E7%A7%92%E9%87%9D%E3%82%92%E5%99%9B%E3%82%80?t=00:32&d=10)\n- 旧形式も利用可能: [サビのシンセ層](track:TAIDADA)',
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
