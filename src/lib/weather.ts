export interface WeatherClock {
  kind: 'obs' | 'forecast';
  init: string | null;
  stale_minutes: number;
  expected_update_at?: string;
  valid_until?: string;
  frames: { valid: string }[];
}

// Preserve the requested valid time when switching hourly and ten-minute products.
export function nearestFrame(frames: { valid: string }[], time: number): number {
  return frames.reduce((best, frame, i) =>
    Math.abs(Date.parse(frame.valid) - time) < Math.abs(Date.parse(frames[best].valid) - time) ? i : best, 0);
}

export function freshness(layer: WeatherClock, now: number): string | null {
  const end = Date.parse(layer.valid_until ?? layer.frames[layer.frames.length - 1]?.valid ?? '');
  if (layer.kind === 'forecast' && now > end) return 'Forecast ended';
  const due = layer.expected_update_at ? Date.parse(layer.expected_update_at)
    : Date.parse(layer.init ?? layer.frames[0]?.valid ?? '') + layer.stale_minutes * 60_000;
  return now > due ? (layer.kind === 'obs' ? 'Radar delayed' : 'Model update delayed') : null;
}
