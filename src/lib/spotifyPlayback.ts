export interface SpotifyPlayRequest {
  uris: string[];
  position_ms?: number;
}

export interface SpotifyTransferRequest {
  device_ids: string[];
  play: boolean;
}

export function buildPlayRequest(trackUri: string, startSeconds?: number): SpotifyPlayRequest {
  if (startSeconds === undefined) {
    return { uris: [trackUri] };
  }

  return {
    uris: [trackUri],
    position_ms: Math.max(0, Math.floor(startSeconds * 1000)),
  };
}

export function buildTransferRequest(deviceId: string): SpotifyTransferRequest {
  return {
    device_ids: [deviceId],
    play: false,
  };
}
