import test from 'node:test';
import assert from 'node:assert/strict';
import { MockProvider } from '../src/lib/llm/providers/mock';

test('MockProvider returns default JSON for jsonMode', async () => {
  const provider = new MockProvider();

  const text = await provider.generateText('Analyze artist "Björk"', { jsonMode: true });
  const data = JSON.parse(text);

  assert.equal(typeof data.summary, 'string');
  assert.ok(Array.isArray(data.keyTraits));
  assert.equal(typeof data.deepDive, 'string');
});

test('MockProvider returns custom mock response when provided', async () => {
  const custom = '{"summary":"custom","keyTraits":[],"deepDive":"x"}';
  const provider = new MockProvider(custom);

  const text = await provider.generateText('ignored', { jsonMode: true });

  assert.equal(text, custom);
});
