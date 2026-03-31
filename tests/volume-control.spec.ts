import test from 'node:test';
import assert from 'node:assert/strict';
import { clampVolumePercent, toPlayerVolume } from '../src/lib/volumeControl';

test('clampVolumePercent keeps values in 0-100 range', () => {
  assert.equal(clampVolumePercent(45), 45);
  assert.equal(clampVolumePercent(-10), 0);
  assert.equal(clampVolumePercent(120), 100);
});

test('toPlayerVolume converts percent to sdk volume in 0-1 range', () => {
  assert.equal(toPlayerVolume(0), 0);
  assert.equal(toPlayerVolume(80), 0.8);
  assert.equal(toPlayerVolume(100), 1);
  assert.equal(toPlayerVolume(-20), 0);
  assert.equal(toPlayerVolume(150), 1);
});
