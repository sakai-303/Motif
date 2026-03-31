export function clampVolumePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function toPlayerVolume(percent: number): number {
  return clampVolumePercent(percent) / 100;
}
