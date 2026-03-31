import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTimecodeToSeconds, parseTrackCueHref } from '../src/lib/spotifyCue';

test('parseTimecodeToSeconds handles seconds, mm:ss, and hh:mm:ss', () => {
  assert.equal(parseTimecodeToSeconds('90'), 90);
  assert.equal(parseTimecodeToSeconds('01:15'), 75);
  assert.equal(parseTimecodeToSeconds('1:02:03'), 3723);
});

test('parseTimecodeToSeconds returns null for invalid values', () => {
  assert.equal(parseTimecodeToSeconds(''), null);
  assert.equal(parseTimecodeToSeconds('bad'), null);
  assert.equal(parseTimecodeToSeconds('99:99'), null);
});

test('parseTrackCueHref keeps backward compatibility for track links', () => {
  assert.deepEqual(parseTrackCueHref('track:Debug Track 01'), {
    trackName: 'Debug Track 01',
  });
  assert.deepEqual(parseTrackCueHref('track:Debug%20Track%2002'), {
    trackName: 'Debug Track 02',
  });
});

test('parseTrackCueHref parses cue links with seconds and timecode', () => {
  assert.deepEqual(parseTrackCueHref('cue:Song A?t=65'), {
    trackName: 'Song A',
    startSeconds: 65,
  });
  assert.deepEqual(parseTrackCueHref('cue:Song B?t=01:15'), {
    trackName: 'Song B',
    startSeconds: 75,
  });
  assert.deepEqual(parseTrackCueHref('cue:Song%20C?t=00:32'), {
    trackName: 'Song C',
    startSeconds: 32,
  });
});

test('parseTrackCueHref falls back to track-only cue when time is invalid', () => {
  assert.deepEqual(parseTrackCueHref('cue:Song C?t=bad'), {
    trackName: 'Song C',
  });
});
