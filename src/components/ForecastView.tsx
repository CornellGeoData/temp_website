import { useEffect, useRef, useState } from 'react';
import TileMap, { type MapTarget, type Overlay } from './TileMap';
import { type GlobeSite } from '../lib/sites';
import { RESIPLE } from '../styles/theme';

// The weather feed: rendered on the lab's DGX Spark every 6 hours and
// force-pushed to the geodata-wx repo's gh-pages branch. Served with open
// CORS, so dev and prod both read it live - no local sync needed.
const WX_BASE = 'https://cornellgeodata.github.io/geodata-wx';

// Esri's light-gray canvas: keyless like the imagery layer, white enough that
// conventional weather colors carry all the meaning. Levels stop at 16.
const LIGHT_TILES = (z: number, x: number, y: number) =>
  `https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/${z}/${y}/${x}`;
const LIGHT_ATTR = 'Basemap: Esri, weather: NOAA via dynamical.org';

// the larger Finger Lakes framing (fixed by decision; matches render_wx.py BBOX)
const SMALL = window.matchMedia('(max-width: 720px)').matches;
const HOME = { lat: 42.75, lon: -76.6, zoom: SMALL ? 8.2 : 9 };

interface Frame { file: string; valid: string; data?: string }
// per-layer regular grid of point values (row 0 = north edge, row-major),
// published next to the PNGs so a click can read the actual number
interface ValuesMeta { n: number; s: number; w: number; e: number; rows: number; cols: number; unit: string }
// the colour scale as data - rendered as a real DOM element, not a raster
interface Scale {
  type: 'steps' | 'gradient';
  label: string;
  bounds?: number[];
  colors?: string[];
  over?: string;
  min?: number;
  max?: number;
  stops?: string[];
}
interface WxLayer {
  id: string;
  label: string;
  source: string;
  kind: 'obs' | 'forecast';
  init: string | null;
  stale_minutes: number;
  opacity: number;
  bounds: { n: number; s: number; w: number; e: number };
  scale?: Scale;
  values?: ValuesMeta;
  frames: Frame[];
}

// the key sits straight on the map - no card. Black ink with a white halo
// reads on the light basemap and any overlay alike. Vertical, highest value
// at the top, numbers inboard of the bar.
const HALO = '0 0 4px rgba(255,255,255,0.95), 0 0 2px rgba(255,255,255,0.9)';
function ColorScale({ scale }: { scale: Scale }) {
  // the bar shrinks on short windows so the key never climbs into the burger
  // dropdown's zone (~380px of chrome above it: menu, anchor, caption)
  const H = Math.max(160, Math.min(SMALL ? 230 : 300, window.innerHeight - 380));
  const ring = '0 0 0 1px rgba(255,255,255,0.9), 0 1px 4px rgba(0,0,0,0.5)';
  let bar = null;
  let ticks: { frac: number; v: number }[] = [];
  if (scale.type === 'steps' && scale.bounds && scale.colors) {
    const n = scale.colors.length;
    bar = (
      <div style={{ display: 'flex', flexDirection: 'column-reverse', width: 10, height: H, boxShadow: ring }}>
        {scale.colors.map((c, i) => <span key={i} style={{ flex: 1, background: c }} />)}
      </div>
    );
    const every = scale.bounds.length > 12 ? 2 : 1;
    ticks = scale.bounds.map((v, i) => ({ frac: i / n, v })).filter((_, i) => i % every === 0);
  } else if (scale.type === 'gradient' && scale.stops) {
    bar = <div style={{ width: 10, height: H, background: `linear-gradient(to top, ${scale.stops.join(',')})`, boxShadow: ring }} />;
    const { min = 0, max = 1 } = scale;
    ticks = Array.from({ length: 5 }, (_, i) => ({ frac: i / 4, v: min + ((max - min) * i) / 4 }));
  }
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : Math.abs(v) >= 10 ? String(Math.round(v)) : String(v));
  return (
    <div style={{ fontFamily: RESIPLE, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: 7 }}>
        <div style={{ position: 'relative', width: 26, height: H }}>
          {ticks.map((t) => (
            // edge ticks align inward, so the top and bottom numbers sit beside
            // the bar instead of hanging past its ends
            <span key={`${t.frac}`} style={{ position: 'absolute', right: 0, top: `${(1 - t.frac) * 100}%`, transform: t.frac === 0 ? 'translateY(-100%)' : t.frac === 1 ? 'none' : 'translateY(-50%)', fontSize: 10, color: '#0e141c', textShadow: HALO, whiteSpace: 'nowrap' }}>
              {fmt(t.v)}
            </span>
          ))}
        </div>
        {bar}
      </div>
      {/* caption stays horizontal under the bar, right-aligned to the edge */}
      {/* "since init" is obvious for an accumulation layer - drop it */}
      <div style={{ fontSize: 10, letterSpacing: '0.05em', color: '#0e141c', textShadow: HALO, marginTop: 7, maxWidth: 130, textAlign: 'right' }}>{scale.label.replace(' since init', '')}</div>
    </div>
  );
}
interface Manifest { version: number; generated: string; layers: WxLayer[] }

const PANEL: React.CSSProperties = {
  background: 'rgba(14,20,28,0.82)', backdropFilter: 'blur(6px)',
  border: '1px solid rgba(255,255,255,0.25)', color: '#e6ecf0', fontFamily: RESIPLE,
};

const fmtValid = (iso: string) =>
  new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
// plain local time, matching the timebar (the UTC-cycle "06Z" form confused readers)
const fmtInit = (iso: string) => fmtValid(iso);

export default function ForecastView() {
  const [manifest, setManifest] = useState<Manifest | 'loading' | 'error'>('loading');
  const [layerId, setLayerId] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  // the point probe: click the map to pin it, click the pin to clear it. It
  // survives layer switches and scrubbing, so you can watch one spot evolve.
  const [probe, setProbe] = useState<{ lat: number; lon: number } | null>(null);
  const valueCache = useRef(new Map<string, (number | null)[] | 'pending' | 'failed'>()).current;
  const [, bump] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(`${WX_BASE}/latest.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((m: Manifest) => {
        if (!alive) return;
        setManifest(m);
        setLayerId(m.layers[0]?.id ?? null);
      })
      .catch(() => alive && setManifest('error'));
    return () => { alive = false; };
  }, []);

  const layers = typeof manifest === 'object' ? manifest.layers : [];
  const layer = layers.find((l) => l.id === layerId) ?? null;
  // scrub position survives layer switches (compare the same hour across
  // variables); clamped for layers with fewer frames, like radar's single one
  const idx = layer ? Math.min(frame, layer.frames.length - 1) : 0;

  // warm the browser cache so scrubbing never flashes white
  useEffect(() => {
    layer?.frames.forEach((f) => { new Image().src = `${WX_BASE}/${f.file}`; });
  }, [layer]);

  const overlays: Overlay[] = layer
    ? [{ url: `${WX_BASE}/${layer.frames[idx].file}`, bounds: layer.bounds, opacity: layer.opacity }]
    : [];

  const stale = typeof manifest === 'object' && layer
    ? Date.now() - Date.parse(manifest.generated) > layer.stale_minutes * 60_000
    : false;

  // the map wants a target; the forecast stage just parks on the region
  const target = useRef<MapTarget>({ ...HOME, nonce: 0 }).current;

  // the number under the probe for the active layer+frame; fetches the frame's
  // value grid on demand and caches it, so scrubbing re-reads instantly
  const valueAt = (lat: number, lon: number): string => {
    const meta = layer?.values;
    const data = layer?.frames[idx]?.data;
    if (!meta || !data) return '–';
    const url = `${WX_BASE}/${data}`;
    const hit = valueCache.get(url);
    if (hit === undefined) {
      valueCache.set(url, 'pending');
      fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((j: { v: (number | null)[] }) => { valueCache.set(url, j.v); bump((n) => n + 1); })
        .catch(() => { valueCache.set(url, 'failed'); bump((n) => n + 1); });
      return '…';
    }
    if (hit === 'pending') return '…';
    if (hit === 'failed') return '–';
    const row = Math.round(((meta.n - lat) / (meta.n - meta.s)) * (meta.rows - 1));
    const col = Math.round(((lon - meta.w) / (meta.e - meta.w)) * (meta.cols - 1));
    if (row < 0 || row >= meta.rows || col < 0 || col >= meta.cols) return '–';
    const v = hit[row * meta.cols + col];
    return v == null ? '–' : `${v} ${meta.unit}`;
  };

  // the probe rides TileMap's existing pin machinery: a white dot whose
  // always-on label IS the readout
  const probeSites: GlobeSite[] = probe
    ? [{ id: 'probe', name: valueAt(probe.lat, probe.lon), sub: 'point reading', lat: probe.lat, lon: probe.lon, tone: '#ffffff' }]
    : [];

  return (
    // userSelect none inherits everywhere: no long-press text selection or
    // copy callouts on chips, labels, scales, or the map - it's an app, not a page
    <div className="wxview" style={{ position: 'absolute', inset: 0, background: '#e8e8e6', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
      <style>{'.wxview button, .wxview input{-webkit-tap-highlight-color:transparent}.wxview ::-webkit-scrollbar{display:none}'}</style>
      <TileMap
        sites={probeSites}
        selectedIds={probe ? ['probe'] : []}
        onSelect={() => setProbe(null)}
        onPick={(lat, lon) => setProbe({ lat, lon })}
        showLegend={false}
        target={target}
        initial={HOME}
        dur={1}
        tileUrl={LIGHT_TILES}
        attribution={LIGHT_ATTR}
        minZ={8}
        maxZ={15}
        overlays={overlays}
      />

      {/* top-left: the layer picker, with the run provenance as a footnote
          under it rather than a title bar */}
      <div style={{ position: 'absolute', top: SMALL ? 18 : 24, left: SMALL ? 12 : 24, zIndex: 4, display: 'flex', flexDirection: 'column', gap: 7, maxWidth: SMALL ? 'calc(100vw - 74px)' : 'calc(100% - 110px)' }}>
        {layers.length > 0 && (
          // phones: a two-row carousel swiped sideways - shows ~7 layers at a
          // glance without burying the map, and the cut-off chip at the edge
          // is the scroll affordance
          <div style={{
            ...(SMALL
              ? { display: 'grid', gridAutoFlow: 'column' as const, gridTemplateRows: 'auto auto', gap: 6, overflowX: 'auto' as const, scrollbarWidth: 'none' as const, paddingBottom: 2, justifyContent: 'start' as const }
              : { display: 'flex', flexWrap: 'wrap' as const, gap: 6 }),
          }}>
            {layers.map((l) => (
              <button
                key={l.id}
                onClick={() => setLayerId(l.id)}
                style={{
                  ...PANEL, appearance: 'none', cursor: 'pointer', padding: '6px 11px',
                  fontSize: 11.5, letterSpacing: '0.1em', textTransform: 'uppercase',
                  whiteSpace: 'nowrap', flexShrink: 0,
                  background: l.id === layerId ? '#e6ecf0' : (PANEL.background as string),
                  color: l.id === layerId ? '#0e141c' : '#e6ecf0',
                  // the active pick goes light, so it needs a dark line to hold
                  // its edge against the light basemap
                  border: l.id === layerId ? '1px solid #0e141c' : (PANEL.border as string),
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
        {layer && (
          <div style={{ fontFamily: RESIPLE, fontSize: 10.5, letterSpacing: '0.06em', color: stale ? '#8a5f10' : '#3d4a55', textShadow: HALO }}>
            {/* the manifest's source strings carry separator dots; the line
                rendered here stays plain: name, then the init cycle */}
            Forecast: {layer.source.includes('StormCast') ? 'Local StormCast run' : layer.source.replace(/\s*·\s*/g, ', ')}
            {layer.kind === 'forecast' && layer.init ? `, init ${fmtInit(layer.init)}` : ''}
          </div>
        )}
      </div>

      {/* right side: the active layer's colour scale, straight on the map.
          Anchored off the bottom so the burger's dropdown never reaches it */}
      {layer?.scale && (
        <div style={{ position: 'absolute', right: SMALL ? 14 : 26, bottom: SMALL ? 90 : 110, zIndex: 4, pointerEvents: 'none' }}>
          <ColorScale scale={layer.scale} />
        </div>
      )}

      {/* bottom-center: the timebar - a native range input is the whole widget */}
      {layer && layer.frames.length > 1 && (
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: SMALL ? 30 : 34, zIndex: 4, ...PANEL, padding: '10px 16px', width: 'min(560px, calc(100vw - 32px))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range"
              min={0}
              max={layer.frames.length - 1}
              step={1}
              value={idx}
              onChange={(e) => setFrame(Number(e.target.value))}
              aria-label="Forecast hour"
              style={{ flex: 1, accentColor: '#e6ecf0' }}
            />
            <span style={{ fontSize: 12, whiteSpace: 'nowrap', minWidth: SMALL ? 74 : 92, textAlign: 'right' }}>{fmtValid(layer.frames[idx].valid)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#8fa0ab', marginTop: 3 }}>
            <span>{fmtValid(layer.frames[0].valid)}</span>
            <span>{fmtValid(layer.frames[layer.frames.length - 1].valid)}</span>
          </div>
        </div>
      )}
      {/* single-frame layers (radar) get the valid time where the bar would be */}
      {layer && layer.frames.length === 1 && (
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: SMALL ? 30 : 34, zIndex: 4, ...PANEL, padding: '8px 14px', fontSize: 12 }}>
          {fmtValid(layer.frames[0].valid)}{stale && <span style={{ color: '#d9a13c' }}> (stale)</span>}
        </div>
      )}

      {manifest === 'loading' && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: 4, ...PANEL, padding: '10px 16px', fontSize: 13 }}>
          Fetching the latest weather&hellip;
        </div>
      )}
      {(manifest === 'error' || (typeof manifest === 'object' && layers.length === 0)) && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: 4, ...PANEL, padding: '10px 16px', fontSize: 13 }}>
          The forecast feed is offline right now. Check back soon.
        </div>
      )}
    </div>
  );
}
