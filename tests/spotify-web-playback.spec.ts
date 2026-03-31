import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayRequest, buildTransferRequest } from '../src/lib/spotifyPlayback';

test('buildPlayRequest includes uri and optional start offset in ms', () => {
  assert.deepEqual(buildPlayRequest('spotify:track:abc123'), {
    uris: ['spotify:track:abc123'],
  });

  assert.deepEqual(buildPlayRequest('spotify:track:abc123', 75), {
    uris: ['spotify:track:abc123'],
    position_ms: 75000,
  });
});

test('buildTransferRequest targets the sdk device with play disabled', () => {
  assert.deepEqual(buildTransferRequest('device_1'), {
    device_ids: ['device_1'],
    play: false,
  });
});
