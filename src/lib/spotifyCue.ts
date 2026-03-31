export interface TrackCue {
  trackName: string;
  startSeconds?: number;
}

const TIMECODE_PATTERN = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/;

function decodeTrackName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseTimecodeToSeconds(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  const match = value.match(TIMECODE_PATTERN);
  if (!match) return null;

  if (match[3] !== undefined) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  return minutes * 60 + seconds;
}

/**
 * Parses cue links used in markdown.
 * Supported formats:
 * - track:Song Title
 * - cue:Song Title?t=75
 * - cue:Song Title?t=01:15
 */
export function parseTrackCueHref(href: string): TrackCue | null {
  if (href.startsWith('track:')) {
    const trackName = decodeTrackName(href.slice('track:'.length).trim());
    return trackName ? { trackName } : null;
  }

  if (!href.startsWith('cue:')) {
    return null;
  }

  const raw = href.slice('cue:'.length).trim();
  if (!raw) return null;

  const [trackPart, query = ''] = raw.split('?');
  const trackName = decodeTrackName(trackPart.trim());
  if (!trackName) return null;

  if (!query) {
    return { trackName };
  }

  const params = new URLSearchParams(query);
  const rawTime = params.get('t') ?? params.get('start') ?? '';
  const parsed = rawTime ? parseTimecodeToSeconds(rawTime) : null;
  if (parsed === null) {
    return { trackName };
  }

  return { trackName, startSeconds: parsed };
}
