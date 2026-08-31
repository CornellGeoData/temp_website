import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { RESIPLE, MANTI } from '../styles/theme';
import SensorGlobe from '../components/SensorGlobe';
import ForecastView from '../components/ForecastView';
import { AIR, SOIL, WEATHER, type GlobeSite } from '../lib/sites';
import soilArchive from '../data/soil-archive.json';

// ACTIVE SENSORS - the /api/aqi proxy (server.mjs) passes through the Egg API's
// reduced+grouped JSON. Shape-tolerant on purpose: a portal-side format tweak
// should degrade to "no chart", not a crash.
interface EggPoint { t: number; v: number }

function eggSeries(raw: unknown): { key: string; points: EggPoint[] }[] {
  let obj = raw as Record<string, unknown> | null;
  // unwrap single-key wrappers (e.g. keyed by serial number)
  while (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const keys = Object.keys(obj);
    const inner = keys.length === 1 ? obj[keys[0]] : null;
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) obj = inner as Record<string, unknown>;
    else break;
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const out: { key: string; points: EggPoint[] }[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (!Array.isArray(val)) continue;
    // the Egg reports ~every minute; charts show one sample per 5-minute bucket.
    // no averaging - the kept sample's noise is the instrument's real behaviour
    const points = (val as { t?: string; time?: string; date?: string; v?: unknown; value?: unknown }[])
      .map((p) => ({ t: Date.parse(p?.t ?? p?.time ?? p?.date ?? ''), v: Number(p?.v ?? p?.value) }))
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
      .sort((a, b) => a.t - b.t)
      .filter((p, i, a) => i === 0 || Math.floor(p.t / 300_000) !== Math.floor(a[i - 1].t / 300_000));
    if (points.length > 1) out.push({ key: key.toLowerCase(), points });
  }
  return out;
}

// Dev preview only: with no /api/aqi proxy running the eggs are silent, which
// leaves the charts invisible while styling them. Synthesize three plausible
// days (5-min cadence, diurnal cycles, one PM event) so they render.
// Production builds never call this - see the import.meta.env.DEV gate below.
// days/stepMin let the same generator fake the lifetime feed (a year at 3h)
function fakeEggSeries(seed: number, days = 3, stepMin = 5): { key: string; points: EggPoint[] }[] {
  const now = Date.now();
  const N = (days * 24 * 60) / stepMin;
  const step = stepMin * 60_000;
  const day = (h: number, peak: number) => Math.cos(((h - peak) / 24) * 2 * Math.PI);
  const mk = (f: (h: number, i: number) => number) => {
    const pts: EggPoint[] = [];
    for (let i = 0; i < N; i++) {
      const t = now - days * 86_400_000 + i * step;
      const d = new Date(t);
      pts.push({ t, v: f(d.getHours() + d.getMinutes() / 60, i) });
    }
    return pts;
  };
  const n = (amp: number) => (Math.random() - 0.5) * 2 * amp;
  // a smoke event one afternoon, so the EPA bands have something to rate
  const event = (i: number) => 9 * Math.exp(-(((i - 550 - seed * 90) / 45) ** 2));
  const pm25 = (h: number, i: number) => Math.max(0.2, 4 + seed + 1.8 * day(h, 8) + event(i) + n(1.1));
  return [
    { key: 'pm2p5', points: mk(pm25) },
    { key: 'pm10p0', points: mk((h, i) => pm25(h, i) * 1.6 + n(1)) },
    { key: 'pm1p0', points: mk((h, i) => pm25(h, i) * 0.6 + n(0.5)) },
    { key: 'co2', points: mk((h) => 425 + seed * 6 + 45 * day(h, 4) + n(8)) },
    { key: 'no2', points: mk((h) => Math.max(0, 8 + 5 * day(h, 18) + n(2)) ) },
    { key: 'o3', points: mk((h) => Math.max(0, 32 + 14 * day(h, 15) + n(3)) ) },
    { key: 'so2', points: mk(() => Math.max(0, 0.8 + n(0.5))) },
    { key: 'co', points: mk((h) => Math.max(0.05, 0.3 + 0.1 * day(h, 18) + n(0.05))) },
    { key: 'temperature', points: mk((h) => 22 + seed + 5 * day(h, 15) + n(0.4)) },
    { key: 'humidity', points: mk((h) => Math.min(97, Math.max(20, 68 - 14 * day(h, 15) + n(2)))) },
    { key: 'pressure', points: mk((_h, i) => 1014 + 3 * Math.sin(i / 200) + n(0.3)) },
  ];
}

// channels rendered in this order when present in the feed. PM readings in clean
// air sit near 0 and quantize in ~0.1 steps, so those charts pin the baseline to
// 0 with a minimum y-span instead of autoscaling the noise to full height.
// the first three, with the AQI trace ahead of them, are the four charts a
// card shows at its opening size; the rest follow on scroll
const EGG_CHANNELS: { key: string; label: string; unit: string; scale?: (v: number) => number; y0?: number; minSpan?: number; epaBands?: boolean; footnote?: string }[] = [
  { key: 'pm2p5', label: 'PM2.5', unit: 'µg/m³', epaBands: true, footnote: '* EPA 24-hour safety standard: 9 µg/m³' },
  // pm10p0 isn't charted but still feeds the AQI badge via AQI_BP
  // minSpan keeps a channel's ordinary wiggle from autoscaling to full height:
  // the plot only stretches when something actually happens
  { key: 'co2', label: 'CO2', unit: 'ppm', minSpan: 80 },
  { key: 'temperature', label: 'Temperature', unit: '°C', minSpan: 6 },
  { key: 'pm1p0', label: 'PM1.0', unit: 'µg/m³', y0: 0, minSpan: 15 },
  { key: 'no2', label: 'NO2', unit: 'ppb', y0: 0, minSpan: 50 },
  { key: 'o3', label: 'O3', unit: 'ppb', y0: 0, minSpan: 50 },
  { key: 'so2', label: 'SO2', unit: 'ppb', y0: 0, minSpan: 30 },
  { key: 'co', label: 'CO', unit: 'ppm', y0: 0, minSpan: 4 },
  { key: 'humidity', label: 'Humidity', unit: '%', minSpan: 15 },
  // the Egg has reported pressure in Pa on older firmware and hPa on current, so pick
  // by magnitude: station pressure is ~1013 hPa at sea level and never near 10,000.
  { key: 'pressure', label: 'Pressure', unit: 'hPa', scale: (v) => (v > 10_000 ? v / 100 : v) },
];

// US EPA AQI breakpoints [Clow, Chigh, Ilow, Ihigh] (2024 PM2.5 revision).
// Gas breakpoints are the EPA 8h (O3, CO) / 1h (NO2, SO2) tables applied to
// instantaneous readings, same simplification the PM badge already makes.
const AQI_BP: Record<string, number[][]> = {
  pm2p5: [[0, 9, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150], [55.5, 125.4, 151, 200], [125.5, 225.4, 201, 300], [225.5, 325.4, 301, 500]],
  pm10p0: [[0, 54, 0, 50], [55, 154, 51, 100], [155, 254, 101, 150], [255, 354, 151, 200], [355, 424, 201, 300], [425, 604, 301, 500]],
  o3: [[0, 54, 0, 50], [55, 70, 51, 100], [71, 85, 101, 150], [86, 105, 151, 200], [106, 200, 201, 300], [201, 604, 301, 500]],
  no2: [[0, 53, 0, 50], [54, 100, 51, 100], [101, 360, 101, 150], [361, 649, 151, 200], [650, 1249, 201, 300], [1250, 2049, 301, 500]],
  so2: [[0, 35, 0, 50], [36, 75, 51, 100], [76, 185, 101, 150], [186, 304, 151, 200], [305, 604, 201, 300], [605, 1004, 301, 500]],
  co: [[0, 4.4, 0, 50], [4.5, 9.4, 51, 100], [9.5, 12.4, 101, 150], [12.5, 15.4, 151, 200], [15.5, 30.4, 201, 300], [30.5, 50.4, 301, 500]],
};

function aqiFrom(conc: number, bp: number[][]): number {
  const [cl, ch, il, ih] = bp.find(([lo, hi]) => conc >= lo && conc <= hi) ?? bp[bp.length - 1];
  return Math.round(il + ((Math.min(conc, ch) - cl) / (ch - cl)) * (ih - il));
}

const AQI_CATS: readonly (readonly [number, string, string])[] = [
  [50, 'Good', '#00e400'],
  [100, 'Moderate', '#ffff00'],
  [150, 'Unhealthy for Sensitive Groups', '#ff7e00'],
  [200, 'Unhealthy', '#ff0000'],
  [300, 'Very Unhealthy', '#8f3f97'],
  [Infinity, 'Hazardous', '#7e0023'],
];
const aqiCat = (aqi: number) => AQI_CATS.find(([max]) => aqi <= max)!;

type Rating = (v: number) => readonly [number, string, string];
// every channel with an EPA AQI standard gets a badge; PM1.0, CO2, and the
// weather channels have no standard, so they stay unrated
const RATINGS: Record<string, Rating> = Object.fromEntries(
  Object.keys(AQI_BP).map((k) => [k, (v: number) => aqiCat(aqiFrom(v, AQI_BP[k]))]),
);

const fmtVal = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1));
// "PM2.5 ..." -> PM₂.₅-style label; styled <sub>, since the custom fonts ship no
// subscript glyphs. Only the number goes down - a suffix like "Lifetime" stays up.
const subPM = (label: string) => {
  if (!label.startsWith('PM')) return label;
  const [head, ...rest] = label.split(' ');
  return <>PM<sub style={{ fontSize: '0.72em' }}>{head.slice(2)}</sub>{rest.length > 0 && ` ${rest.join(' ')}`}</>;
};
const fmtTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const fmtDay = (t: number) => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
const fmtMoYr = (t: number) => new Date(t).toLocaleDateString([], { month: 'short', year: 'numeric' });
const fmtTick = (v: number) => (Math.abs(v % 1) < 1e-9 ? Math.round(v).toLocaleString() : v.toFixed(1));

// dark-native figure plates: elevation comes from the slightly lighter
// surface and a hairline, not from borders or colored frames, so the charts
// read as one instrument panel over the night imagery
const PLATE = { paper: '#151c26', rule: 'rgba(230,236,240,0.55)', grid: 'rgba(255,255,255,0.07)', ink: '#e6ecf0', muted: '#8fa0ab' };
// the PM2.5 y-axis is anchored to the EPA health scale (top of the Moderate band);
// the 9 µg/m³ standard itself is explained in the plate's footnote
const PM_TOP = 35.4;

// round tick values on a 1-2-5 ladder, so the axis reads in numbers a person
// would choose, never in data-derived extremes
function niceTicks(lo: number, hi: number, n = 4): number[] {
  const span = hi - lo || 1;
  const mag = 10 ** Math.floor(Math.log10(span / n));
  const step = [1, 2, 5, 10].map((c) => c * mag).find((s) => span / s <= n) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) out.push(v);
  return out;
}

const CHART_H = 172;
const M = { l: 46, r: 18, t: 10, b: 24 };

function SensorChart({ label, unit, points, y0, minSpan, epaBands, rating, footnote }: { label: string; unit: string; points: EggPoint[]; y0?: number; minSpan?: number; epaBands?: boolean; rating?: Rating; footnote?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  // real pixel coordinates: the path is regenerated at the measured width, so the
  // geometry is never non-uniformly stretched and slope means rate of change
  const [w, setW] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const vs = points.map((p) => p.v);
  const dmin = Math.min(...vs);
  const dmax = Math.max(...vs);
  let lo: number, hi: number;
  if (epaBands) {
    // anchored to the health scale, expanding only if readings exceed Moderate
    lo = 0;
    hi = Math.max(PM_TOP, dmax * 1.05);
  } else if (y0 != null) {
    lo = y0;
    hi = y0 + (Math.max(dmax - y0, minSpan ?? 0) || 1) * 1.08;
  } else {
    const pad = Math.max((dmax - dmin) * 0.15, (minSpan ?? 0) / 2, 1e-9);
    lo = dmin - pad;
    hi = dmax + pad;
  }
  // a trace pinned to the floor (clean-air PM reads a flat 0.00, AQI 0) would
  // draw exactly on the axis line and vanish - undershoot the domain a hair
  // so a legitimate zero stays visible just above the baseline
  if (dmin <= lo) lo -= (hi - lo) * 0.03;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const tspan = t1 - t0 || 1;
  const plotW = Math.max(w - M.l - M.r, 1);
  const plotH = CHART_H - M.t - M.b;
  const X = (t: number) => M.l + ((t - t0) / tspan) * plotW;
  const Y = (v: number) => M.t + (1 - (v - lo) / (hi - lo)) * plotH;
  // no line across a data gap: a step far beyond the series' own cadence starts
  // a new segment, so outages read as blank stretches
  const dts = points.slice(1).map((p, i) => p.t - points[i].t).sort((a, b) => a - b);
  const gapMs = 5 * (dts[Math.floor(dts.length / 2)] || Infinity);
  const path = points.map((p, i) => `${i && p.t - points[i - 1].t <= gapMs ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join('');
  const cur = points[points.length - 1];
  const hp = hover != null ? points[hover] : null;
  const ticks = niceTicks(lo, hi);

  // x ticks on 6h boundaries; the midnight rule runs the full plot and carries the
  // date. Past ~3 days the 6h grid overcrowds, so ticks step in whole days instead.
  const xticks: { t: number; midnight: boolean }[] = [];
  const spanDays = tspan / 86_400_000;
  const first = new Date(t0);
  first.setMinutes(0, 0, 0);
  if (spanDays > 3) {
    const stepDays = Math.ceil(spanDays / 6);
    first.setHours(24); // next midnight
    for (let d = new Date(first); d.getTime() <= t1; d.setDate(d.getDate() + stepDays)) xticks.push({ t: d.getTime(), midnight: true });
  } else {
    const step6h = 6 * 3600_000;
    first.setHours(Math.ceil(first.getHours() / 6) * 6);
    for (let t = first.getTime(); t <= t1; t += step6h) xticks.push({ t, midnight: new Date(t).getHours() === 0 });
  }

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = t0 + ((e.clientX - rect.left - M.l) / plotW) * tspan;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i].t - t) < Math.abs(points[best].t - t)) best = i;
    setHover(best);
  };

  return (
    <div style={{ background: PLATE.paper, border: '1px solid rgba(255,255,255,0.08)', padding: '16px 18px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
          <div style={{ fontFamily: RESIPLE, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: PLATE.ink, whiteSpace: 'nowrap' }}>
            {subPM(label)}{unit && <> <span style={{ textTransform: 'none', letterSpacing: 0, color: PLATE.muted }}>({unit})</span></>}
          </div>
          {rating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: RESIPLE, fontSize: 11.5, color: PLATE.muted, whiteSpace: 'nowrap' }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: rating((hp ?? cur).v)[2], border: '1px solid rgba(255,255,255,0.25)', flexShrink: 0 }} />
              {rating((hp ?? cur).v)[1]}{footnote && '*'}
            </div>
          )}
        </div>
        {hp && (
          <div style={{ fontFamily: RESIPLE, fontSize: 12, color: PLATE.muted, whiteSpace: 'nowrap' }}>
            {fmtVal(hp.v)} at {fmtTime(hp.t)}
          </div>
        )}
      </div>
      <div
        ref={wrapRef}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        style={{ position: 'relative', marginTop: 8, touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      >
        <svg width={w || '100%'} height={CHART_H} style={{ display: 'block' }} aria-label={`${label} history`}>
          {w > 0 && (
            <>
              {ticks.map((v) => (
                <g key={v}>
                  <line x1={M.l} x2={M.l + plotW} y1={Y(v)} y2={Y(v)} stroke={PLATE.grid} strokeWidth={1} />
                  <text x={M.l - 7} y={Y(v)} fontSize={10.5} fill={PLATE.muted} textAnchor="end" dominantBaseline="middle" fontFamily="Resiple, sans-serif">{fmtTick(v)}</text>
                </g>
              ))}
              {/* never let time labels crowd: keep every k-th tick so what
                  remains fits the measured width */}
              {xticks.filter((_, ti, a) => ti % Math.max(1, Math.ceil(a.length / Math.max(2, Math.floor(plotW / 70)))) === 0).map(({ t, midnight }) => (
                <g key={t}>
                  <line x1={X(t)} x2={X(t)} y1={M.t + plotH} y2={M.t + plotH + 4} stroke={PLATE.rule} strokeWidth={1} />
                  <text x={X(t)} y={CHART_H - 7} fontSize={10} fill={PLATE.muted} textAnchor="middle" fontFamily="Resiple, sans-serif">
                    {spanDays > 300 ? fmtMoYr(t) : midnight ? fmtDay(t) : fmtTime(t)}
                  </text>
                </g>
              ))}
              {/* the measurement frame: a real L-axis, not floating hairlines */}
              <line x1={M.l} x2={M.l} y1={M.t} y2={M.t + plotH} stroke={PLATE.rule} strokeWidth={1.2} />
              <line x1={M.l} x2={M.l + plotW} y1={M.t + plotH} y2={M.t + plotH} stroke={PLATE.rule} strokeWidth={1.2} />
              <path d={path} fill="none" stroke={PLATE.ink} strokeWidth={1.4} />
              {hp && (
                <>
                  <line x1={X(hp.t)} x2={X(hp.t)} y1={M.t} y2={M.t + plotH} stroke={PLATE.ink} strokeWidth={0.8} opacity={0.35} />
                  <circle cx={X(hp.t)} cy={Y(hp.v)} r={3.2} fill={PLATE.ink} stroke={PLATE.paper} strokeWidth={1.5} />
                </>
              )}
            </>
          )}
        </svg>
      </div>
      {footnote && (
        <div style={{ fontFamily: RESIPLE, fontSize: 10.5, color: PLATE.muted, marginTop: 2 }}>
          {footnote}
        </div>
      )}
    </div>
  );
}

// ---- CSV export: every channel, one row per 5-minute bucket ----
type Table = { cols: { label: string; unit: string }[]; rows: { t: number; vals: (number | null)[] }[] };

const TABLE_META: Record<string, { label: string; unit: string }> = Object.fromEntries([
  ...EGG_CHANNELS.map((c) => [c.key, { label: c.label, unit: c.unit }]),
  ['pm10p0', { label: 'PM10', unit: 'µg/m³' }],
]);
const TABLE_ORDER = ['pm2p5', 'co2', 'temperature', 'pm10p0', 'pm1p0', 'no2', 'o3', 'so2', 'co', 'humidity', 'pressure'];

function eggTable(series: { key: string; points: EggPoint[] }[], unit: 'C' | 'F'): Table {
  const keys = TABLE_ORDER.filter((k) => series.some((s) => s.key === k && s.points.length));
  const by = new Map<number, (number | null)[]>();
  keys.forEach((k, ci) => {
    const scale = EGG_CHANNELS.find((c) => c.key === k)?.scale;
    for (const p of series.find((s) => s.key === k)!.points) {
      let v = scale ? scale(p.v) : p.v;
      if (k === 'temperature' && unit === 'F') v = (v * 9) / 5 + 32;
      const b = Math.floor(p.t / 300_000) * 300_000;
      const row = by.get(b) ?? Array<number | null>(keys.length + 1).fill(null);
      row[ci + 1] = v;
      by.set(b, row);
    }
  });
  // AQI leads each row: the worse of the two PM sub-indices, same as the chart
  for (const row of by.values()) {
    const subs = (['pm2p5', 'pm10p0'] as const).flatMap((k) => {
      const i = keys.indexOf(k);
      const v = i >= 0 ? row[i + 1] : null;
      return v == null ? [] : [aqiFrom(v, AQI_BP[k])];
    });
    if (subs.length) row[0] = Math.max(...subs);
  }
  return {
    cols: [{ label: 'AQI', unit: '' }, ...keys.map((k) => (k === 'temperature' ? { label: 'Temperature', unit: unit === 'F' ? '°F' : '°C' } : TABLE_META[k]))],
    rows: [...by.entries()].sort((a, b) => b[0] - a[0]).map(([t, vals]) => ({ t, vals })),
  };
}

function soilTable(points: EggPoint[]): Table {
  return {
    cols: [{ label: 'Soil moisture', unit: '% VWC' }],
    rows: [...points].sort((a, b) => b.t - a.t).map((p) => ({ t: p.t, vals: [p.v] })),
  };
}

function downloadCsv(name: string, table: Table) {
  const head = ['time', ...table.cols.map((c) => (c.unit ? `${c.label} (${c.unit})` : c.label))];
  const lines = [head.join(','), ...[...table.rows].reverse().map((r) => [new Date(r.t).toISOString(), ...r.vals.map((v) => v ?? '')].join(','))];
  const a = document.createElement('a');
  // BOM so Excel reads the unit glyphs as UTF-8
  a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv' }));
  a.download = `${name.toLowerCase().replace(/\s+/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// square utility button, shared by the card headers and the static sheet
const BTN: CSSProperties = { appearance: 'none', cursor: 'pointer', padding: '5px 11px', border: '1px solid rgba(255,255,255,0.22)', background: 'transparent', color: '#a9bcc6', fontFamily: RESIPLE, fontSize: 11.5, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 };

// one Soilmote card: the same soilmoisture trace at three zooms. Month tells the
// story, day answers "is it wet right now". Battery voltage is in the feed too,
// deliberately not charted.
// a chart only needs ~1 point per plot pixel: keep the first sample per bucket,
// same idiom as eggSeries' 5-minute pass
function thin(pts: EggPoint[]): EggPoint[] {
  if (pts.length < 2) return pts;
  const b = (pts[pts.length - 1].t - pts[0].t) / 1500;
  return b <= 300_000 ? pts : pts.filter((p, i, a) => i === 0 || Math.floor(p.t / b) !== Math.floor(a[i - 1].t / b));
}

// the static sheet's time window, shared by charts, log, and download
const RANGES = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['life', 'Lifetime']] as const;
type Range = (typeof RANGES)[number][0];
const RANGE_MS: Record<string, number> = { day: 86_400_000, week: 7 * 86_400_000, month: 31 * 86_400_000 };
// windows anchor to the newest sample, not the wall clock, so an offline
// sensor's last day still shows something
function clip(pts: EggPoint[], r: Range): EggPoint[] {
  if (r === 'life' || pts.length === 0) return pts;
  const newest = pts[pts.length - 1].t;
  return pts.filter((p) => p.t >= newest - RANGE_MS[r]);
}

function SoilCharts({ points, lifetime }: { points: EggPoint[]; lifetime?: EggPoint[] }) {
  const newest = points[points.length - 1].t;
  // lifetime pops in when the slow archive fetch lands
  const windows = [
    { label: 'Lifetime', pts: lifetime ?? [] },
    { label: 'Month', pts: points.filter((p) => p.t >= newest - 31 * 86_400_000) },
    { label: 'Week', pts: points.filter((p) => p.t >= newest - 7 * 86_400_000) },
    { label: 'Day', pts: points.filter((p) => p.t >= newest - 86_400_000) },
  ]
    .map((w) => ({ ...w, pts: w.pts.length > 1 ? thin(w.pts) : w.pts }))
    .filter((w) => w.pts.length > 1);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(320px,100%),1fr))', gap: 18 }}>
      {windows.map((w) => (
        <SensorChart key={w.label} label={w.label} unit="% VWC" points={w.pts} y0={0} minSpan={20} />
      ))}
    </div>
  );
}

// "N 42\u00b0 27.060' W 76\u00b0 26.863'" -> decimal degrees. Degrees-and-decimal-
// minutes is how the team records positions in the field, so it stays the stored
// form and the globe derives its pins from it rather than keeping a second copy.
function dm(coords: string): { lat: number; lon: number } {
  const [lat, lon] = [...coords.matchAll(/([NSEW])\s*(\d+)\u00b0\s*([\d.]+)'/g)]
    .map(([, hem, deg, min]) => (Number(deg) + Number(min) / 60) * (hem === 'S' || hem === 'W' ? -1 : 1));
  return { lat, lon };
}

// one card per egg. Ids are the slot names /api/aqi assigns in EGG_SERIAL order,
// so adding an egg = append its serial to EGG_SERIAL on the server + an entry here.
const EGGS = [
  { id: 'egg1', name: 'Snee Egg', location: 'Snee Hall roof', coords: "N 42\u00b0 26.613' W 76\u00b0 29.105'" },
  { id: 'egg2', name: 'ELL Egg', location: 'GeoData workbench', coords: "N 42\u00b0 26.636' W 76\u00b0 28.971'" },
];

// Zynect Soilmotes ride the same Wicked Device API as the eggs, but the grouped
// feed is keyed by internal serial (the portal name, e.g. GRASP, is an alias).
// That API needs no key and allows any origin, so the client fetches it directly.
const SOILMOTES = [
  { id: 'egge82d1055169daf2b', name: 'GRASP', location: 'Gamefarm', lifeFrom: Date.parse('2025-05-14T00:00:00Z'), coords: "N 42\u00b0 27.060' W 76\u00b0 26.863'" },
];
// retired probes: their history never changes, so it's cataloged once into
// soil-archive.json (thinned to ~900 pts each) instead of refetched from the
// slow archive API. NINJA's range set by the team; the rest are as probed.
const ARCHIVE: Record<string, EggPoint[]> = Object.fromEntries(
  // a 0% reading means the probe wasn't reading, not dry soil - drop them
  Object.entries(soilArchive as unknown as Record<string, [number, number][]>).map(([k, v]) => [k, v.map(([t, x]) => ({ t, v: x })).filter((p) => p.v !== 0)]),
);
const RETIRED = [
  // labelBelow: these two sit under GLITZ/CAMPS, so their names drop beneath
  // the dot instead of landing on a neighbor
  { coords: "N 42\u00b0 26.924' W 76\u00b0 26.812'", name: 'CENSE', from: '3/18/25', to: '6/18/26', labelBelow: true },
  { coords: "N 42\u00b0 26.926' W 76\u00b0 26.757'", name: 'NINJA', from: '3/21/26', to: '6/3/26' },
  { coords: "N 42\u00b0 27.032' W 76\u00b0 26.729'", name: 'CAMPS', from: '4/18/25', to: '4/19/26' },
  { coords: "N 42\u00b0 26.949' W 76\u00b0 26.816'", name: 'GLITZ', from: '3/18/25', to: '4/13/26' },
];

// Regional NEWA weather stations around Cayuga Lake, served by the Northeast
// Regional Climate Center (hrly.nrcc.cornell.edu - keyless, CORS-open, hourly
// with a 1-2 h lag). sid is the NRCC "<station> <network>" pair; lat/lon come
// from their station list, already decimal.
const NEWA_STATIONS = [
  { id: 'wx-itha', sid: 'ny_itha nwon', name: 'Cornell Orchards (NEWA)', location: 'Ithaca', lat: 42.443624, lon: -76.463274 },
  { id: 'wx-itbl', sid: 'ny_itbl nwon', name: 'Bluegrass Lane (NEWA)', location: 'Ithaca', lat: 42.461956, lon: -76.463891 },
  { id: 'wx-lans', sid: 'ny_lans nwon', name: 'Lansing (NEWA)', location: 'Cornell Orchards', lat: 42.572295, lon: -76.595127 },
  { id: 'wx-aur', sid: 'aur newa', name: 'Aurora (NEWA)', location: 'East shore, Cayuga Lake', lat: 42.73367, lon: -76.65383 },
  { id: 'wx-int', sid: 'int newa', name: 'Interlaken (NEWA)', location: 'Airy Acres', lat: 42.636288, lon: -76.725271 },
];

// charted in this order when the station reports them. Leaf wetness rides the
// feed but isn't charted, same call as battery voltage.
// temp/dwpt arrive in °F and stay stored that way - the °C pick converts at
// render, mirroring the eggs (stored °C, converted to °F).
const NEWA_CHANNELS: { key: string; label: string; unit: string; y0?: number; minSpan?: number }[] = [
  { key: 'temp', label: 'Temperature', unit: '°F', minSpan: 10 },
  { key: 'dwpt', label: 'Dew point', unit: '°F', minSpan: 10 },
  { key: 'rhum', label: 'Humidity', unit: '%', minSpan: 15 },
  { key: 'prcp', label: 'Precipitation', unit: 'in/hr', y0: 0, minSpan: 0.25 },
  { key: 'wspd', label: 'Wind speed', unit: 'mph', y0: 0, minSpan: 12 },
  // wdir draws as a wind rose, not a line; the entry also names its CSV column
  { key: 'wdir', label: 'Wind direction', unit: 'deg' },
  { key: 'srad', label: 'Solar radiation', unit: 'W/m²', y0: 0, minSpan: 400 },
];

// {hrlyFields, hrlyData} columns -> one series per channel. Everything is
// strings; "M" and "NaN" (missing) drop out through the finite filter.
function newaSeries(raw: unknown): { key: string; points: EggPoint[] }[] {
  const r = raw as { hrlyFields?: string[]; hrlyData?: string[][] } | null;
  if (!Array.isArray(r?.hrlyFields) || !Array.isArray(r?.hrlyData)) return [];
  const di = r.hrlyFields.indexOf('date');
  return r.hrlyFields.flatMap((f, ci) => {
    if (f === 'date' || f === 'flags') return [];
    const points = r.hrlyData!
      // NEWA reports solar radiation in langleys per hour; 1 ly/hr = 11.6 W/m²
      .map((row) => ({ t: Date.parse(row[di]), v: Number(row[ci]) * (f === 'srad' ? 11.6 : 1) }))
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));
    return points.length > 1 ? [{ key: f, points }] : [];
  });
}

// wind rose: the window's hours binned into 16 compass sectors by the heading
// the wind blew FROM (meteorological convention), petal length proportional to
// the busiest sector. Cardinal labels, intercardinal ticks.
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

function WindRose({ points }: { points: EggPoint[] }) {
  const SECT = 16;
  const [hover, setHover] = useState<number | null>(null);
  const bins = Array<number>(SECT).fill(0);
  for (const p of points) bins[Math.round(p.v / (360 / SECT)) % SECT]++;
  const max = Math.max(...bins, 1);
  const W = 220;
  const cx = W / 2;
  const cy = CHART_H / 2;
  const R = CHART_H / 2 - 18;
  const pt = (a: number, r: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)] as const;
  // one sector's wedge path at radius r; trim < 1 stops the petal a hair short
  // of the sector edge, so neighbors read apart
  const wedge = (i: number, r: number, trim = 1) => {
    const a = (i * 2 * Math.PI) / SECT;
    const half = (Math.PI / SECT) * trim;
    const [x0, y0] = pt(a - half, r);
    const [x1, y1] = pt(a + half, r);
    return `M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z`;
  };
  return (
    <div style={{ background: PLATE.paper, border: '1px solid rgba(255,255,255,0.08)', padding: '16px 18px 12px' }}>
      <div style={{ fontFamily: RESIPLE, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: PLATE.ink, whiteSpace: 'nowrap' }}>
        Wind rose <span style={{ textTransform: 'none', letterSpacing: 0, color: PLATE.muted }}>
          {hover != null ? `${COMPASS[hover]}: ${Math.round((bins[hover] / points.length) * 100)}% of hours` : '(share of hours by heading)'}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${CHART_H}`} width="100%" height={CHART_H} style={{ display: 'block', marginTop: 8 }} aria-label="Wind rose" onPointerLeave={() => setHover(null)}>
        {[1 / 3, 2 / 3, 1].map((f) => (
          <circle key={f} cx={cx} cy={cy} r={R * f} fill="none" stroke={PLATE.grid} strokeWidth={1} />
        ))}
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          const [x0, y0] = pt(a, R);
          const [x1, y1] = pt(a, R + 4);
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={PLATE.rule} strokeWidth={i % 2 ? 0.6 : 1} />;
        })}
        {(['N', 'E', 'S', 'W'] as const).map((c, i) => {
          const [x, y] = pt((i * Math.PI) / 2, R + 11);
          return <text key={c} x={x} y={y} fontSize={10.5} fill={PLATE.muted} textAnchor="middle" dominantBaseline="middle" fontFamily="Resiple, sans-serif">{c}</text>;
        })}
        {bins.map((b, i) => b > 0 && (
          <path key={i} d={wedge(i, (b / max) * R, 0.82)} fill={PLATE.ink} opacity={hover == null ? 0.9 : hover === i ? 1 : 0.45} style={{ transition: 'opacity .15s ease' }} />
        ))}
        {/* full-radius invisible sectors catch the pointer, so a short petal
            is as hoverable as a long one */}
        {bins.map((_, i) => (
          <path key={`hit-${i}`} d={wedge(i, R)} fill="transparent" onPointerEnter={() => setHover(i)} />
        ))}
      </svg>
    </div>
  );
}

const isF = (key: string) => key === 'temp' || key === 'dwpt';
const toC = (pts: EggPoint[]) => pts.map((p) => ({ t: p.t, v: ((p.v - 32) * 5) / 9 }));

function WeatherCharts({ series, unit }: { series: { key: string; points: EggPoint[] }[]; unit: 'C' | 'F' }) {
  const charts = NEWA_CHANNELS.map((c) => ({ ...c, s: series.find((x) => x.key === c.key) })).filter((c) => c.s);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(320px,100%),1fr))', gap: 18 }}>
      {charts.map((c) => c.key === 'wdir' ? <WindRose key={c.key} points={c.s!.points} /> : (
        <SensorChart
          key={c.key}
          label={c.label}
          unit={isF(c.key) ? `°${unit}` : c.unit}
          points={thin(isF(c.key) && unit === 'C' ? toC(c.s!.points) : c.s!.points)}
          y0={c.y0}
          minSpan={isF(c.key) && unit === 'C' ? (c.minSpan! * 5) / 9 : c.minSpan}
        />
      ))}
    </div>
  );
}

// one weather station's channels as rows, one per hour - feeds the CSV
function newaTable(series: { key: string; points: EggPoint[] }[], unit: 'C' | 'F'): Table {
  const cols = NEWA_CHANNELS.filter((c) => series.some((s) => s.key === c.key && s.points.length));
  const by = new Map<number, (number | null)[]>();
  cols.forEach((c, ci) => {
    const pts = series.find((s) => s.key === c.key)!.points;
    for (const p of isF(c.key) && unit === 'C' ? toC(pts) : pts) {
      const row = by.get(p.t) ?? Array<number | null>(cols.length).fill(null);
      row[ci] = p.v;
      by.set(p.t, row);
    }
  });
  return {
    cols: cols.map((c) => ({ label: c.label, unit: isF(c.key) ? `°${unit}` : c.unit })),
    rows: [...by.entries()].sort((a, b) => b[0] - a[0]).map(([t, vals]) => ({ t, vals })),
  };
}

// US AQI as a trace, not a badge: the per-sample sub-index for PM2.5 and
// PM10, worse of the two at each timestamp
function aqiSeries(series: { key: string; points: EggPoint[] }[]): EggPoint[] {
  const by = new Map<number, number>();
  (['pm2p5', 'pm10p0'] as const).forEach((k) => {
    series.find((s) => s.key === k)?.points.forEach((p) => {
      by.set(p.t, Math.max(by.get(p.t) ?? 0, aqiFrom(p.v, AQI_BP[k])));
    });
  });
  return [...by.entries()].map(([t, v]) => ({ t, v })).sort((a, b) => a.t - b.t);
}

function EggCharts({ series, unit }: { series: { key: string; points: EggPoint[] }[]; unit: 'C' | 'F' }) {
  const charts = EGG_CHANNELS.map((c) => ({ ...c, series: series.find((s) => s.key === c.key) })).filter((c) => c.series);
  const aqiPts = thin(aqiSeries(series));
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(320px,100%),1fr))', gap: 18 }}>
        {aqiPts.length > 1 && (
          <SensorChart label="Air Quality Index" unit="" points={aqiPts} y0={0} minSpan={100} rating={(v) => aqiCat(v)} />
        )}
        {charts.map((c) => {
          let points = c.scale ? c.series!.points.map((p) => ({ t: p.t, v: c.scale!(p.v) })) : c.series!.points;
          let chartUnit = c.unit;
          let minSpan = c.minSpan;
          if (c.key === 'temperature' && unit === 'F') {
            points = points.map((p) => ({ t: p.t, v: (p.v * 9) / 5 + 32 }));
            chartUnit = '°F';
            minSpan = minSpan != null ? (minSpan * 9) / 5 : undefined;
          }
          return <SensorChart key={c.key} label={c.label} unit={chartUnit} points={thin(points)} y0={c.y0} minSpan={minSpan} epaBands={c.epaBands} rating={RATINGS[c.key]} footnote={c.footnote} />;
        })}
      </div>
    </div>
  );
}

// hard minimums the corner grip can shrink to (one chart plate exactly)
const EGG_MIN = { w: 420, h: 309 };
const SOIL_MIN = { w: 420, h: 309 };
// opening sizes: two charts wide, two tall, so a card lands showing four
// plates - for the eggs that's AQI, PM2.5, CO2, and Temperature
const EGG_OPEN = { w: 700, h: 580 };
const SOIL_OPEN = { w: 700, h: 560 };
// retired probes carry a single lifetime plate - one-chart height, just wide
// enough that the header row (name, coords, buttons) fits untruncated
const RET_OPEN = { w: 500, h: 309 };

// the static sheet's tabs wear their family's tone
const TAB_TONE = { air: AIR, soil: SOIL, weather: WEATHER } as const;

export function SensorsPage() {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'error' } | { status: 'ready'; raw: Record<string, unknown> }
  >({ status: 'loading' });
  const [unit, setUnit] = useState<'C' | 'F'>('F');
  // the imagery stage swaps the globe chrome (placard, tip) for its own
  const [mapActive, setMapActive] = useState(false);
  // the globe is the whole page; readings exist only for picked sensors.
  // Several can be open at once - each gets its own floating card.
  const [open, setOpen] = useState<string[]>([]);
  // phones run the same stages; isMobile only reshapes the chrome (insets,
  // the bottom-sheet card) rather than forking the page
  const [isMobile] = useState(() => window.matchMedia('(max-width: 720px)').matches);
  // the page footer goes away for the whole page - scrolling onto it from
  // either stage reads as jarring. It lives in App, so it's toggled directly.
  useEffect(() => {
    const f = document.getElementById('partners');
    if (f) f.style.display = 'none';
    return () => { if (f) f.style.display = ''; };
  }, []);
  // the static sheet: the pre-globe sensors page (Air Quality / Soil Moisture
  // tabs, every chart with its lifetime twin) laid over the map stage. Holds
  // the open tab, or null while closed.
  // deep links: #/sensors/<map|air|soil|weather|forecast> restores a stage on
  // load, and the reflect effect below keeps the hash current for sharing
  const initialStage = window.location.hash.split('/')[2];
  const [staticView, setStaticView] = useState<'air' | 'soil' | 'weather' | null>(
    initialStage === 'air' || initialStage === 'soil' || initialStage === 'weather' ? initialStage : null,
  );
  // the forecast stage: regional weather maps over a light basemap, fed by the
  // lab's render pipeline. A full-screen sheet like staticView, not a globe mode.
  const [forecastView, setForecastView] = useState(initialStage === 'forecast');
  // a card's "Show all data" lands on that sensor's section, not the sheet top
  const [staticFocus, setStaticFocus] = useState<string | null>(null);
  const openStatic = (id: string) => {
    setStaticView(EGGS.some((e) => e.id === id) ? 'air' : NEWA_STATIONS.some((s) => s.id === id) ? 'weather' : 'soil');
    setStaticFocus(id);
  };
  useEffect(() => {
    if (!staticView || !staticFocus) return;
    document.getElementById(`static-${staticFocus}`)?.scrollIntoView({ block: 'start' });
    // scrollIntoView also drags the window; the sheet owns the scrolling
    window.scrollTo(0, 0);
    setStaticFocus(null);
  }, [staticView, staticFocus]);
  // the static sheet's time window
  const [range, setRange] = useState<Range>('month');
  // the bottom-left burger's little menu
  const [menuUp, setMenuUp] = useState(false);
  // the fixed site header stays for the globe stage and slides away while the
  // imagery (and the static sheet over it) has the screen. It lives in App,
  // so it's styled directly.
  useEffect(() => {
    const bar = document.querySelector('.site-header')?.parentElement as HTMLElement | null;
    if (!bar) return;
    bar.style.transition = 'transform 300ms ease';
    bar.style.transform = mapActive || staticView || forecastView ? 'translateY(-100%)' : 'translateY(0)';
    // the header's own dropdown menu hangs below it, so sliding the bar away
    // would leave an open menu floating over the stage - App already closes
    // it on hashchange, so ring that same bell
    if (mapActive || staticView || forecastView) window.dispatchEvent(new Event('hashchange'));
    return () => {
      bar.style.transition = '';
      bar.style.transform = '';
    };
  }, [mapActive, staticView, forecastView]);
  // the tip's "Ithaca" link starts the same descent as clicking the globe pin
  const descendRef = useRef<(() => void) | null>(null);
  // the burger menu's "Sensors" option climbs back out to the globe
  const ascendRef = useRef<(() => void) | null>(null);
  // a direct #/sensors/map load plays the descent once the globe has mounted
  const wantMap = useRef(initialStage === 'map');
  useEffect(() => { if (wantMap.current) descendRef.current?.(); }, []);
  // reflect the current stage into the hash so refresh and copied links land
  // back on it; replaceState adds no history entries, so Back still leaves
  useEffect(() => {
    if (mapActive) wantMap.current = false;
    if (wantMap.current) return; // mid-descent: don't rewrite the hash back to the globe
    const stage = staticView ?? (forecastView ? 'forecast' : mapActive ? 'map' : null);
    history.replaceState(null, '', stage ? `#/sensors/${stage}` : '#/sensors');
  }, [mapActive, staticView, forecastView]);
  // clicking a dot toggles its card: open sensors close on a re-click. On
  // mobile only one sheet fits, so a pick replaces instead of stacking.
  const pick = (id: string | null) => {
    if (id === null) setOpen([]);
    else if (isMobile) setOpen((o) => (o.includes(id) ? [] : [id]));
    else setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  };
  const close = (id: string) => setOpen((o) => o.filter((x) => x !== id));
  // every probe on one globe - the air/soil split is carried by the pin colour
  // rather than by a tab, so the network reads as one network
  const sites: GlobeSite[] = useMemo(() => [
    ...EGGS.map((e) => ({ id: e.id, name: e.name, sub: e.location, tone: AIR, ...dm(e.coords) })),
    ...SOILMOTES.map((m) => ({ id: m.id, name: m.name, sub: m.location, tone: SOIL, ...dm(m.coords) })),
    ...RETIRED.map((r) => ({ id: r.name, name: r.name, sub: `Retired ${r.to}`, tone: SOIL, retired: true, labelBelow: r.labelBelow, ...dm(r.coords) })),
    ...NEWA_STATIONS.map((s) => ({ id: s.id, name: s.name, sub: s.location, tone: WEATHER, lat: s.lat, lon: s.lon })),
  ], []);
  const [soil, setSoil] = useState<
    { status: 'loading' } | { status: 'error' } | { status: 'ready'; raw: Record<string, unknown> }
  >({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    const url =
      `https://zynect.com/api/v2/messages/device/${SOILMOTES.map((m) => m.id).join(',')}` +
      `?dur=P1M&end-date=${new Date().toISOString()}&reduced=1&grouped=1`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((raw) => alive && setSoil({ status: 'ready', raw: (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown> }))
      .catch(() => alive && setSoil({ status: 'error' }));
    return () => {
      alive = false;
    };
  }, []);

  // NEWA stations, one POST each - absent id = still fetching, [] = offline.
  // station-local (NY) YYYYMMDDHH; the API rejects an edate past the current hour
  const stamp = (t: number) => new Date(t).toLocaleString('sv', { timeZone: 'America/New_York' }).replace(/\D/g, '').slice(0, 10);
  const loadWx = (sdate: string, set: React.Dispatch<React.SetStateAction<Record<string, { key: string; points: EggPoint[] }[]>>>, aliveRef: { current: boolean }) => NEWA_STATIONS.forEach((st) => {
    fetch('https://hrly.nrcc.cornell.edu/stnHrly', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sid: st.sid, sdate, edate: stamp(Date.now()) }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((raw) => aliveRef.current && set((m) => ({ ...m, [st.id]: newaSeries(raw) })))
      .catch(() => aliveRef.current && set((m) => ({ ...m, [st.id]: [] })));
  });
  const [wx, setWx] = useState<Record<string, { key: string; points: EggPoint[] }[]>>({});
  useEffect(() => {
    const alive = { current: true };
    loadWx(stamp(Date.now() - 31 * 86_400_000), setWx, alive);
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Lifetime is a set 5 years of hourly rows - ~4MB per station uncompressed,
  // so the archive fetch waits until someone actually picks Lifetime on the
  // weather tab, then runs once; charts show the month feed until it lands.
  // The server proxy keeps the bundle warm and gzipped (~2MB for all five
  // stations vs ~20MB straight from NRCC), so it lands in seconds.
  const [wxLife, setWxLife] = useState<Record<string, { key: string; points: EggPoint[] }[]>>({});
  const wxLifeStarted = useRef(false);
  useEffect(() => {
    if (staticView !== 'weather' || range !== 'life' || wxLifeStarted.current) return;
    wxLifeStarted.current = true;
    const alive = { current: true };
    fetch('/api/wx-lifetime')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((raw) => alive.current && setWxLife(Object.fromEntries(
        NEWA_STATIONS.map((st) => [st.id, newaSeries((raw as Record<string, unknown>)[st.id])]),
      )))
      // no proxy running (plain vite dev): pull each station straight from NRCC
      .catch(() => loadWx(stamp(Date.now() - 5 * 365 * 86_400_000), setWxLife, alive));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staticView, range]);

  const [soilLife, setSoilLife] = useState<Record<string, unknown>>({});
  useEffect(() => {
    let alive = true;
    // the lifetime archive takes Zynect ~a minute to assemble, so it comes through
    // the server proxy (long cache) and the charts pop in when it lands
    fetch('/api/soil-lifetime')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .catch(() => {
        // no proxy running (plain vite dev): fetch the slow archive straight from
        // Zynect. Takes upstream ~a minute; the chart pops in when it lands.
        const url =
          `https://zynect.com/api/v2/messages/device/${SOILMOTES.map((m) => m.id).join(',')}` +
          `?dur=P2Y&end-date=${new Date().toISOString()}&reduced=1&grouped=1`;
        return fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
      })
      .then((raw) => alive && setSoilLife((raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetch('/api/aqi')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((raw) => alive && setState({ status: 'ready', raw: (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown> }))
      .catch(() => alive && setState({ status: 'error' }));
    return () => {
      alive = false;
    };
  }, []);

  // the eggs' year-deep archive, for the static sheet's lifetime charts -
  // null until the fetch settles, so dev fakes don't flash ahead of real data
  const [eggLife, setEggLife] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/aqi-lifetime')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((raw) => alive && setEggLife((raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>))
      .catch(() => alive && setEggLife({}));
    return () => {
      alive = false;
    };
  }, []);

  // parsing the multi-MB feed is expensive - do it once per fetch, not per render
  const parsed = useMemo(
    () => Object.fromEntries(EGGS.map((egg, i) => {
      const real = state.status === 'ready' ? eggSeries(state.raw[egg.id]) : [];
      // dev only: a silent egg gets synthetic charts instead of the offline note
      if (real.length === 0 && state.status !== 'loading' && import.meta.env.DEV) return [egg.id, fakeEggSeries(i)];
      return [egg.id, real];
    })),
    [state],
  );
  const soilParsed = useMemo(
    () => Object.fromEntries(SOILMOTES.map((m) => [m.id, soil.status === 'ready' ? eggSeries(soil.raw[m.id]) : []])),
    [soil],
  );
  const soilLifeParsed = useMemo(
    () => Object.fromEntries(SOILMOTES.map((m) => [m.id, eggSeries(soilLife[m.id])])),
    [soilLife],
  );
  const eggLifeParsed = useMemo(
    () => Object.fromEntries(EGGS.map((egg, i) => {
      const real = eggLife ? eggSeries(eggLife[egg.id]) : [];
      // dev only: a silent lifetime feed gets a synthetic year at 3h cadence
      if (real.length === 0 && eggLife && import.meta.env.DEV) return [egg.id, fakeEggSeries(i, 365, 180)];
      return [egg.id, real];
    })),
    [eggLife],
  );

  // everything one sensor's card (or the mobile panel) needs, from its id -
  // several cards can be open at once, so this cannot live in page-level consts
  const deriveFor = (id: string | null) => {
    const site = sites.find((x) => x.id === id) ?? null;
    const egg = EGGS.find((e) => e.id === id) ?? null;
    const mote = SOILMOTES.find((m) => m.id === id) ?? null;
    const ret = RETIRED.find((r) => r.name === id) ?? null;
    const wxSt = NEWA_STATIONS.find((s) => s.id === id) ?? null;
    const accent = ret || mote ? SOIL : wxSt ? WEATHER : AIR;
    // decimal degrees read cleaner than the field notebook's DDM strings
    const metaLines = site
      ? [`${Math.abs(site.lat).toFixed(2)}° ${site.lat >= 0 ? 'N' : 'S'}, ${Math.abs(site.lon).toFixed(2)}° ${site.lon >= 0 ? 'E' : 'W'}`]
      : [];
    // last report time + liveness, shown in the card header
    let status: { live: boolean; t: number } | null = null;
    if (egg) {
      const ss = parsed[egg.id];
      if (ss.length) {
        const newest = Math.max(...ss.map((s) => s.points[s.points.length - 1].t));
        status = { live: Date.now() - newest < 45 * 60_000, t: newest };
      }
    } else if (mote) {
      const pts = soilParsed[mote.id].find((x) => x.key === 'soilmoisture')?.points.filter((q) => q.v !== 0);
      // ~30 min LoRa cadence, 2 missed reports = offline
      if (pts?.length) status = { live: Date.now() - pts[pts.length - 1].t < 75 * 60_000, t: pts[pts.length - 1].t };
    } else if (wxSt) {
      const ss = wx[wxSt.id];
      if (ss?.length) {
        const newest = Math.max(...ss.map((s) => s.points[s.points.length - 1].t));
        // NRCC serves hourly with a 1-2 h lag, so 3 h of silence = offline
        status = { live: Date.now() - newest < 3 * 3600_000, t: newest };
      }
    }
    const readings = !site ? null : (
      <>
        {egg && (
          state.status === 'loading' ? <Note>Contacting the egg&hellip;</Note>
          : parsed[egg.id].length === 0 ? <Note>The sensor feed is offline right now. Check back soon.</Note>
          : <EggCharts series={parsed[egg.id]} unit={unit} />
        )}
        {mote && (() => {
          // 0% is a non-reading (probe out of soil), not data
          const pts = soilParsed[mote.id].find((x) => x.key === 'soilmoisture')?.points.filter((q) => q.v !== 0);
          return soil.status === 'loading' ? <Note>Contacting the probe&hellip;</Note>
            : !pts || pts.length < 2 ? <Note>The sensor feed is offline right now. Check back soon.</Note>
            : <SoilCharts points={pts} lifetime={soilLifeParsed[mote.id].find((x) => x.key === 'soilmoisture')?.points.filter((q) => q.v !== 0 && q.t >= mote.lifeFrom)} />;
        })()}
        {ret && <SensorChart label="Lifetime" unit="% VWC" points={ARCHIVE[ret.name]} y0={0} minSpan={20} />}
        {wxSt && (() => {
          // the floating card answers "what's it like out": the last day, with
          // the full month behind Show all data
          const day = wxSeriesFor(wxSt.id, 'day');
          return !(wxSt.id in wx) ? <Note>Contacting the station&hellip;</Note>
            : day.length === 0 ? <Note>The station feed is offline right now. Check back soon.</Note>
            : <WeatherCharts series={day} unit={unit} />;
        })()}
      </>
    );
    return { site, accent, metaLines, readings, isEgg: !!egg, status };
  };

  // one egg's series at a time window: the day feed is densest for Day, the
  // year archive for everything longer; each falls back to the other while
  // its fetch is still out
  const eggSeriesFor = (id: string, r: Range) => {
    const life = eggLifeParsed[id];
    const day = parsed[id];
    const src = r === 'day' ? (day.length ? day : life) : (life.length ? life : day);
    return src.map((s) => ({ key: s.key, points: clip(s.points, r) })).filter((s) => s.points.length > 1);
  };
  // one mote's soilmoisture points at a window (0% is a non-reading, not data)
  const soilPtsFor = (id: string, r: Range) => {
    const mote = SOILMOTES.find((m) => m.id === id)!;
    const month = soilParsed[id].find((x) => x.key === 'soilmoisture')?.points.filter((q) => q.v !== 0) ?? [];
    if (r !== 'life') return clip(month, r);
    const life = soilLifeParsed[id].find((x) => x.key === 'soilmoisture')?.points.filter((q) => q.v !== 0 && q.t >= mote.lifeFrom);
    return life?.length ? life : month;
  };

  // one station's channels at a window; Lifetime uses the 5-year archive,
  // falling back to the month feed while that fetch is still out
  const wxSeriesFor = (id: string, r: Range) => {
    const src = r === 'life' && wxLife[id]?.length ? wxLife[id] : wx[id];
    return (src ?? []).map((s) => ({ key: s.key, points: clip(s.points, r) })).filter((s) => s.points.length > 1);
  };

  // all of one sensor's data as rows at a window - feeds the log and the CSV
  const tableFor = (id: string, r: Range): { name: string; table: Table } | null => {
    const s = sites.find((x) => x.id === id);
    if (!s) return null;
    let table: Table | null = null;
    if (EGGS.some((e) => e.id === id)) table = eggTable(eggSeriesFor(id, r), unit);
    else if (SOILMOTES.some((m) => m.id === id)) table = soilTable(soilPtsFor(id, r));
    else if (NEWA_STATIONS.some((s) => s.id === id)) table = newaTable(wxSeriesFor(id, r), unit);
    // retired probes are all history - the window doesn't apply
    else if (RETIRED.some((x) => x.name === id)) table = soilTable(ARCHIVE[id]);
    return table ? { name: s.name, table } : null;
  };
  const download = (id: string, r: Range = range) => {
    const t = tableFor(id, r);
    if (t) downloadCsv(r === 'life' ? t.name : `${t.name} ${r}`, t.table);
  };

  // ---- the globe is the page; each open sensor floats its own card
  // (desktop) or docks as a bottom sheet over the imagery (mobile) ----
  const cardFor = (id: string) => {
    const d = deriveFor(id);
    if (!d.site) return null;
    const size = d.site.retired ? RET_OPEN : d.isEgg ? EGG_OPEN : SOIL_OPEN;
    return (
      <div style={{
        // opens showing four plates (one for retired probes) and the corner
        // grip resizes it to taste; the drag handle is the header bar
        width: size.w, height: size.h,
        maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100dvh - 120px)', display: 'flex', flexDirection: 'column',
        // native corner grip: the card resizes and the charts remeasure to fit
        resize: 'both', overflow: 'hidden', minWidth: (d.isEgg ? EGG_MIN : SOIL_MIN).w, minHeight: (d.isEgg ? EGG_MIN : SOIL_MIN).h,
        // the bottom sheet: full width, map still visible above, no grip
        // the sheet hugs its content and never takes more than 45dvh, so the
        // map stays visible above
        ...(isMobile && { width: '100%', maxWidth: '100%', minWidth: 0, height: 'auto', maxHeight: '45dvh', minHeight: 0, resize: 'none' as const }),
        background: 'rgba(16,23,32,0.95)', backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
      }}>
        <div data-drag-handle style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.09)', cursor: 'grab', userSelect: 'none', touchAction: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ fontFamily: MANTI, fontWeight: 700, fontSize: 21, letterSpacing: '-0.015em', margin: 0, whiteSpace: 'nowrap', flexShrink: 0 }}>{d.site.name}</h3>
            {/* coords and last-updated ride the title's row, one line; on a
                shrunk card the coords give way first, never the buttons */}
            <span style={{ fontFamily: RESIPLE, fontSize: 11.5, letterSpacing: '0.06em', color: '#7c909b', whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.metaLines[0]}</span>
            {d.status && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: RESIPLE, fontSize: 11.5, color: d.status.live ? '#4fae7d' : '#7c909b', whiteSpace: 'nowrap' }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: d.status.live ? '#4fae7d' : '#5f7078' }} />
                {fmtTime(d.status.t)}
              </span>
            )}
            <span style={{ flex: 1 }} />
            <button onClick={() => openStatic(id)} style={BTN}>Show all data</button>
            <button onClick={() => close(id)} aria-label="Close readings" style={{ appearance: 'none', cursor: 'pointer', width: 26, height: 26, lineHeight: 1, flexShrink: 0, border: '1px solid rgba(255,255,255,0.22)', background: 'transparent', color: '#a9bcc6', fontFamily: RESIPLE, fontSize: 14 }}>
              &times;
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>{d.readings}</div>
      </div>
    );
  };
  const cards = open.flatMap((id) => {
    const node = cardFor(id);
    return node ? [{ id, node }] : [];
  });

  // the burger menu's destinations, shared by every stage's burger
  const menuBtns = (line: string) => ([
    ['Globe View', () => { setStaticView(null); setForecastView(false); ascendRef.current?.(); }],
    ['Map View', () => { setStaticView(null); setForecastView(false); descendRef.current?.(); }],
    ['Static View', () => { setForecastView(false); setStaticView('air'); }],
    ['Forecast View', () => { setStaticView(null); setForecastView(true); }],
  ] as const).map(([label, go]) => (
    <button
      key={label}
      // switching stages is a fresh start: any open sensor cards close too
      onClick={() => { setOpen([]); go(); setMenuUp(false); }}
      style={{
        appearance: 'none', cursor: 'pointer', padding: '7px 13px', whiteSpace: 'nowrap',
        border: `1px solid ${line}`, background: 'rgba(14,20,28,0.88)', backdropFilter: 'blur(6px)',
        color: '#e6ecf0', fontFamily: RESIPLE, fontSize: 11.5, letterSpacing: '0.12em', textTransform: 'uppercase',
      }}
    >
      {label}
    </button>
  ));

  return (
    <section style={{ position: 'relative', zIndex: 2, background: '#0e141c', height: '100dvh', overflow: 'hidden' }}>
      {/* the globe has the full screen from the first frame; the header lives
          above it (z 50) and slides in only when summoned to the top edge */}
      {/* zIndex 0 makes this a stacking context, so the cards' ever-growing
          bring-to-front z-indexes can never climb over the page chrome or the
          tabular sheet */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <SensorGlobe sites={sites} selectedIds={open} onSelect={pick} cards={cards} onMapChange={setMapActive} descendRef={descendRef} ascendRef={ascendRef} />
      </div>
      {/* one temperature unit for every card, parked beside Back - white on
          the imagery so it reads at a glance */}
      {mapActive && (
        // phones: the burger drops to a second row, so the bar takes the corner
        <div style={{ position: 'absolute', top: 24, right: isMobile ? 24 : 76, zIndex: 4, display: 'flex', gap: 10 }}>
          <span style={{
            display: 'inline-flex',
            border: '1px solid #ffffff', overflow: 'hidden',
            background: 'rgba(14,20,28,0.72)', backdropFilter: 'blur(6px)',
          }}>
            {(['F', 'C'] as const).map((u) => (
              // height pinned so the bar sits exactly as tall as the burger beside it
              <button key={u} onClick={() => setUnit(u)} style={{ appearance: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 13px', fontFamily: RESIPLE, fontSize: 12, letterSpacing: '0.1em', background: unit === u ? '#ffffff' : 'transparent', color: unit === u ? '#0e141c' : '#ffffff' }}>
                &deg;{u}
              </button>
            ))}
          </span>
        </div>
      )}
      {/* the one instruction the globe needs - parked bottom right, clear of
          the site header up top */}
      {!mapActive && (
        <div style={{
          position: 'absolute', bottom: 36, right: isMobile ? 16 : 48, zIndex: 4, maxWidth: 190,
          padding: '7px 11px', background: 'rgba(14,20,28,0.72)', backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.22)',
          fontFamily: RESIPLE, fontSize: 11, lineHeight: 1.45, color: '#a9bcc6', textAlign: 'right',
        }}>
          Click on{' '}
          <button
            onClick={() => descendRef.current?.()}
            style={{ appearance: 'none', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', letterSpacing: 'inherit', color: '#ffffff', textDecoration: 'underline' }}
          >
            Ithaca
          </button>
          {' '}for a map view of our deployed sensors
        </div>
      )}
      {/* ---- the static sheet: the pre-globe sensors page over the stage ---- */}
      {staticView && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: '#0e141c', overflowY: 'auto', padding: '26px clamp(16px,5vw,48px) 96px' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>
            {/* one line, even at 390px: unlabeled dropdowns (Month / °F speak
                for themselves), compact tabs, burger on the right */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: isMobile ? 6 : 12 }}>
              <div style={{ display: 'inline-flex', border: `2px solid ${TAB_TONE[staticView]}`, overflow: 'hidden' }}>
                {([['air', isMobile ? 'AQ Egg' : 'Air Quality'], ['weather', 'Weather'], ['soil', isMobile ? 'Soil' : 'Soil Moisture']] as const).map(([id, label]) => (
                  <button key={id} onClick={() => setStaticView(id)} style={{ appearance: 'none', border: 'none', cursor: 'pointer', padding: isMobile ? '9px 9px' : '10px 14px', fontFamily: RESIPLE, fontSize: isMobile ? 11 : 13, letterSpacing: isMobile ? '0.06em' : '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap', background: staticView === id ? TAB_TONE[id] : 'transparent', color: staticView === id ? '#0e141c' : '#7c909b' }}>
                    {label}
                  </button>
                ))}
              </div>
              <span style={{ flex: 1 }} />
              {/* the °C/°F pick leads the cluster; it applies to the egg and
                  weather panels, so it sits out the soil tab */}
              {staticView !== 'soil' && (
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as 'C' | 'F')}
                  style={{ appearance: 'none', cursor: 'pointer', height: 33, padding: isMobile ? '0 8px' : '0 14px', border: '1px solid rgba(255,255,255,0.22)', background: '#141c26', color: '#e6ecf0', fontFamily: RESIPLE, fontSize: 12.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}
                >
                  {(['F', 'C'] as const).map((u) => <option key={u} value={u}>&deg;{u}</option>)}
                </select>
              )}
              {/* the window every chart and Download share */}
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as Range)}
                style={{ appearance: 'none', cursor: 'pointer', height: 33, padding: isMobile ? '0 8px' : '0 14px', border: '1px solid rgba(255,255,255,0.22)', background: '#141c26', color: '#e6ecf0', fontFamily: RESIPLE, fontSize: 12.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >
                {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {/* the sheet's burger rides the row's right end, styled and
                  sized like the dropdowns beside it */}
              <span style={{ position: 'relative' }}>
                <button
                  aria-label="Menu"
                  aria-expanded={menuUp}
                  onClick={() => setMenuUp((m) => !m)}
                  style={{
                    display: 'inline-flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 3,
                    height: 33, padding: isMobile ? '0 10px' : '0 14px', appearance: 'none', cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.22)', background: '#141c26',
                  }}
                >
                  {[0, 1, 2].map((i) => <span key={i} style={{ width: 14, height: 2, background: '#e6ecf0' }} />)}
                </button>
                {menuUp && (
                  // inset a hair from the burger's edge, so the boxes never
                  // trace the sensor cards' right border underneath
                  <span style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 10, zIndex: 5, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    {menuBtns('rgba(255,255,255,0.22)')}
                  </span>
                )}
              </span>
            </div>
            {staticView === 'air' && EGGS.map((egg, i) => (
              <details key={egg.id} id={`static-${egg.id}`} open style={{ background: '#141c26', border: `1px solid ${AIR}`, padding: 'clamp(20px,3.5vw,36px)', marginTop: 24, scrollMarginTop: 16 }}>
                <summary style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px 18px' }}>
                  <span className="chev" style={{ color: '#7c909b', alignSelf: 'center' }} />
                  <h3 style={{ fontFamily: MANTI, fontWeight: 700, fontSize: 'clamp(24px,3vw,32px)', letterSpacing: '-0.015em', margin: 0 }}>{egg.name}</h3>
                  <span style={{ fontFamily: RESIPLE, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7c909b' }}>{egg.location}</span>
                  <span style={{ flex: 1 }} />
                  {/* the burger dropdown falls over the first card's corner -
                      that one steps aside while the menu is open */}
                  <button onClick={(e) => { e.preventDefault(); download(egg.id); }} style={{ ...BTN, visibility: menuUp && i === 0 ? 'hidden' : 'visible' }}>Download</button>
                </summary>
                <div style={{ marginTop: 28 }}>
                  {(() => {
                    const series = eggSeriesFor(egg.id, range);
                    return state.status === 'loading' ? <Note>Contacting the egg&hellip;</Note>
                      : series.length === 0 ? <Note>The sensor feed is offline right now. Check back soon.</Note>
                      : <EggCharts series={series} unit={unit} />;
                  })()}
                </div>
              </details>
            ))}
            {staticView === 'soil' && SOILMOTES.map((mote, i) => {
              const pts = soilPtsFor(mote.id, range);
              return (
                <details key={mote.id} id={`static-${mote.id}`} open style={{ background: '#141c26', border: `1px solid ${SOIL}`, padding: 'clamp(20px,3.5vw,36px)', marginTop: 24, scrollMarginTop: 16 }}>
                  <summary style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px 18px' }}>
                    <span className="chev" style={{ color: '#7c909b', alignSelf: 'center' }} />
                    <h3 style={{ fontFamily: MANTI, fontWeight: 700, fontSize: 'clamp(24px,3vw,32px)', letterSpacing: '-0.015em', margin: 0 }}>{mote.name}</h3>
                    {/* coords are dead weight on a phone-width summary line */}
                    <span style={{ fontFamily: RESIPLE, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7c909b' }}>{isMobile ? mote.location : `${mote.location} ${mote.coords}`}</span>
                    <span style={{ flex: 1 }} />
                    <button onClick={(e) => { e.preventDefault(); download(mote.id); }} style={{ ...BTN, visibility: menuUp && i === 0 ? 'hidden' : 'visible' }}>Download</button>
                  </summary>
                  <div style={{ marginTop: 28 }}>
                    {soil.status === 'loading' ? <Note>Contacting the probe&hellip;</Note>
                      : pts.length < 2 ? <Note>The sensor feed is offline right now. Check back soon.</Note>
                      : <SensorChart label={RANGES.find(([v]) => v === range)![1]} unit="% VWC" points={thin(pts)} y0={0} minSpan={20} />}
                  </div>
                </details>
              );
            })}
            {staticView === 'soil' && (
              <div style={{ marginTop: 40 }}>
                <div style={{ fontFamily: RESIPLE, fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7c909b' }}>Inactive Sensors</div>
                {RETIRED.map((r) => (
                  <details key={r.name} id={`static-${r.name}`} open style={{ background: '#141c26', border: '1px solid rgba(193,112,63,0.5)', padding: 'clamp(20px,3.5vw,36px)', marginTop: 24, scrollMarginTop: 16 }}>
                    <summary style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px 18px' }}>
                      <span className="chev" style={{ color: '#7c909b', alignSelf: 'center' }} />
                      <h3 style={{ fontFamily: MANTI, fontWeight: 700, fontSize: 'clamp(24px,3vw,32px)', letterSpacing: '-0.015em', margin: 0 }}>{r.name}</h3>
                      {/* phones: bare date range, so name + dates + Download share one line */}
                      <span style={{ fontFamily: RESIPLE, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7c909b' }}>{isMobile ? `(${r.from} - ${r.to})` : `Active: (${r.from} - ${r.to}) | Coords: ${r.coords}`}</span>
                      <span style={{ flex: 1 }} />
                      <button onClick={(e) => { e.preventDefault(); download(r.name); }} style={BTN}>Download</button>
                    </summary>
                    <div style={{ marginTop: 28 }}>
                      {/* retired probes are all history - the window doesn't apply */}
                      <SensorChart label="Lifetime" unit="% VWC" points={ARCHIVE[r.name]} y0={0} minSpan={20} />
                    </div>
                  </details>
                ))}
              </div>
            )}
            {staticView === 'weather' && NEWA_STATIONS.map((st, i) => {
              const series = wxSeriesFor(st.id, range);
              return (
                <details key={st.id} id={`static-${st.id}`} open style={{ background: '#141c26', border: `1px solid ${WEATHER}`, padding: 'clamp(20px,3.5vw,36px)', marginTop: 24, scrollMarginTop: 16 }}>
                  <summary style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px 18px' }}>
                    <span className="chev" style={{ color: '#7c909b', alignSelf: 'center' }} />
                    <h3 style={{ fontFamily: MANTI, fontWeight: 700, fontSize: 'clamp(24px,3vw,32px)', letterSpacing: '-0.015em', margin: 0 }}>{st.name}</h3>
                    <span style={{ fontFamily: RESIPLE, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7c909b' }}>{isMobile ? st.location : `${st.location} ${Math.abs(st.lat).toFixed(2)}° N, ${Math.abs(st.lon).toFixed(2)}° W`}</span>
                    <span style={{ flex: 1 }} />
                    <button onClick={(e) => { e.preventDefault(); download(st.id); }} style={{ ...BTN, visibility: menuUp && i === 0 ? 'hidden' : 'visible' }}>Download</button>
                  </summary>
                  <div style={{ marginTop: 28 }}>
                    {!(st.id in wx) ? <Note>Contacting the station&hellip;</Note>
                      : series.length === 0 ? <Note>The station feed is offline right now. Check back soon.</Note>
                      : (
                        <>
                          {/* the month feed stands in while the archive is out - say so */}
                          {range === 'life' && !(st.id in wxLife) && <Note>Loading the 5-year archive&hellip; showing the last month until it lands.</Note>}
                          <WeatherCharts series={series} unit={unit} />
                        </>
                      )}
                  </div>
                </details>
              );
            })}
            {staticView === 'weather' && (
              <div style={{ fontFamily: RESIPLE, fontSize: 11.5, letterSpacing: '0.06em', color: '#7c909b', marginTop: 28 }}>
                Regional stations courtesy of NEWA and the Northeast Regional Climate Center at Cornell. Hourly readings, typically 1-2 hours behind.
              </div>
            )}
          </div>
        </div>
      )}
      {/* ---- the forecast stage: light map + weather overlays, own burger ---- */}
      {forecastView && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30 }}>
          <ForecastView />
          <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 5, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <button
              aria-label="Menu"
              aria-expanded={menuUp}
              onClick={() => setMenuUp((m) => !m)}
              style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 3,
                width: 40, height: 30, appearance: 'none', cursor: 'pointer', flexShrink: 0,
                border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(14,20,28,0.82)', backdropFilter: 'blur(6px)',
              }}
            >
              {[0, 1, 2].map((i) => <span key={i} style={{ width: 14, height: 2, background: '#e6ecf0' }} />)}
            </button>
            {menuUp && menuBtns('rgba(255,255,255,0.25)')}
          </div>
        </div>
      )}
      {/* the burger IS the way between the globe, the map, the forecast, and
          the static sheet. Bottom left on the globe (level with the tip); top
          right in white on the imagery, sized to the temp bar. The forecast
          stage and static sheet carry their own copies. */}
      {!staticView && !forecastView && (
        <div style={{
          position: 'absolute', zIndex: 40, display: 'flex', flexDirection: 'column', gap: 8,
          ...(mapActive
            // phones: the temp bar owns the top row, the burger sits under it
            ? { top: isMobile ? 62 : 24, right: 24, alignItems: 'flex-end' }
            : { bottom: 36, left: isMobile ? 16 : 48, alignItems: 'flex-start' }),
        }}>
          {!mapActive && menuUp && menuBtns('rgba(255,255,255,0.22)')}
          <button
            aria-label="Menu"
            aria-expanded={menuUp}
            onClick={() => setMenuUp((m) => !m)}
            style={{
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 3,
              width: mapActive ? 40 : 42, height: mapActive ? 30 : 38, appearance: 'none', cursor: 'pointer', flexShrink: 0,
              border: `1px solid ${mapActive ? '#ffffff' : 'rgba(255,255,255,0.22)'}`, background: 'rgba(14,20,28,0.72)', backdropFilter: 'blur(6px)',
            }}
          >
            {[0, 1, 2].map((i) => <span key={i} style={{ width: 14, height: 2, background: mapActive ? '#ffffff' : '#a9bcc6' }} />)}
          </button>
          {mapActive && menuUp && menuBtns('#ffffff')}
        </div>
      )}
    </section>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <div style={{ fontFamily: RESIPLE, fontSize: 14.5, color: '#7c909b' }}>{children}</div>;
}
