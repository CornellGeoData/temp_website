import { useEffect, useRef, useState } from 'react';
import TileMap, { type MapTarget, type Overlay } from './TileMap';
import { type GlobeSite } from '../lib/sites';
import { RESIPLE } from '../styles/theme';
import { nearestFrame, freshness } from '../lib/weather';

// The weather feed: rendered on the lab's DGX Spark and
// force-pushed to the geodata-wx repo's gh-pages branch. Served with open
// CORS, so dev and prod both read it live - no local sync needed.
const WX_BASE = import.meta.env.VITE_WX_BASE || 'https://cornellgeodata.github.io/geodata-wx';

// Esri's light-gray canvas: keyless like the imagery layer, white enough that
// conventional weather colors carry all the meaning. Levels stop at 16.
const LIGHT_TILES = (z: number, x: number, y: number) =>
  `https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/${z}/${y}/${x}`;
const LIGHT_ATTR = 'Basemap: Esri. HRRR: NOAA via dynamical.org';

// Initial position before the selected feed's full grid arrives.
const INITIAL_SMALL = window.matchMedia('(max-width: 720px)').matches;
const HOME = { lat: 42.75, lon: -76.6, zoom: INITIAL_SMALL ? 8.2 : 9 };

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
  group?: string;
  expected_update_at?: string;
  valid_until?: string;
  accumulation_start?: string;
  opacity: number;
  bounds: { n: number; s: number; w: number; e: number };
  tiles?: { width: number; height: number; size: number };
  scale?: Scale;
  values?: ValuesMeta;
  frames: Frame[];
}

// the key sits straight on the map - no card. Black ink with a white halo
// reads on the light basemap and any overlay alike. Vertical, highest value
// at the top, numbers inboard of the bar.
const HALO = '0 0 4px rgba(255,255,255,0.95), 0 0 2px rgba(255,255,255,0.9)';
function ColorScale({ scale, small }: { scale: Scale; small: boolean }) {
  // the bar shrinks on short windows so the key clears the launcher button
  // above and the timebar below
  const H = Math.max(160, Math.min(small ? 230 : 300, window.innerHeight - 260));
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
      <div style={{ fontSize: 10, letterSpacing: '0.05em', color: '#0e141c', textShadow: HALO, marginTop: 7, maxWidth: 130, textAlign: 'right' }}>{scale.label}</div>
    </div>
  );
}
interface Manifest { version: number; generated: string; layers: WxLayer[]; status?: { degraded?: boolean; reason?: string } }

const PANEL: React.CSSProperties = {
  background: 'rgba(14,20,28,0.82)', backdropFilter: 'blur(6px)',
  border: '1px solid rgba(255,255,255,0.25)', color: '#e6ecf0', fontFamily: RESIPLE,
};

const fmtValid = (iso: string) =>
  new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
// plain local time, matching the timebar (the UTC-cycle "06Z" form confused readers)
const fmtInit = (iso: string) => fmtValid(iso);

export default function ForecastView() {
  const [small, setSmall] = useState(INITIAL_SMALL);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 720px)');
    const resize = () => setSmall(media.matches);
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);
  const [manifest, setManifest] = useState<Manifest | 'loading' | 'error'>('loading');
  const [layerId, setLayerId] = useState<string | null>(null);
  const [requestedTime, setRequestedTime] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now);
  const [refreshError, setRefreshError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [ready, setReady] = useState<{ layer: WxLayer; frame: Frame } | null>(null);
  const [imageError, setImageError] = useState(false);
  // the point probe: click the map to pin it, click the pin to clear it. It
  // survives layer switches and scrubbing, so you can watch one spot evolve.
  const [probe, setProbe] = useState<{ lat: number; lon: number } | null>(null);
  const valueCache = useRef(new Map<string, (number | null)[] | 'pending' | 'failed'>()).current;
  const [, bump] = useState(0);

  useEffect(() => {
    let alive = true;
    let fetching = false;
    const refresh = async () => {
      if (fetching || document.hidden) return;
      fetching = true;
      try {
        const response = await fetch(`${WX_BASE}/latest.json`, { cache: 'no-cache', signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error(String(response.status));
        const m: Manifest = await response.json();
        if (!Array.isArray(m.layers) || !m.layers.every(l => Array.isArray(l.frames))) throw new Error('Invalid weather feed');
        if (alive) { setManifest(m); setRefreshError(false); }
      } catch {
        if (alive) {
          setRefreshError(true);
          setManifest(previous => typeof previous === 'object' ? previous : 'error');
        }
      } finally { fetching = false; }
    };
    void refresh();
    const interval = window.setInterval(() => { setNow(Date.now()); void refresh(); }, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { alive = false; clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  }, [retry]);

  const layers = typeof manifest === 'object' ? manifest.layers.filter(l =>
    !['stormcast_rain', 'stormcast_precip'].includes(l.id) && l.frames.length > 0)
    .sort((a, b) => Number(b.id.endsWith('refc')) - Number(a.id.endsWith('refc'))) : [];
  const layer = layers.find(l => l.id === layerId) ?? layers.find(l => l.id === 'stormcast_refc') ?? layers.find(l => l.id === 'radar_refc') ?? layers[0] ?? null;
  const groupOf = (l: WxLayer) => l.id === 'radar_refc' ? 'MRMS' : l.group ??
    (l.source.includes('StormScope') ? 'Nowcast' : l.source.includes('StormCast') ? 'StormCast' : 'HRRR');
  const GROUP_ORDER = ['StormCast', 'Nowcast', 'MRMS', 'HRRR'];
  const groups = [...new Set(layers.map(groupOf))].sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b));
  const [openGroup, setOpenGroup] = useState<string | null | undefined>(undefined);
  const shownGroup = openGroup === undefined ? (layer ? groupOf(layer) : null) : openGroup;
  const idx = layer ? nearestFrame(layer.frames, requestedTime ?? now) : 0;
  const selectedFrame = layer?.frames[idx];

  useEffect(() => {
    if (!layer || !selectedFrame) return;
    let alive = true;
    const img = new Image();
    setImageError(false);
    const timeout = window.setTimeout(() => { if (alive) setImageError(true); }, 15_000);
    img.src = `${WX_BASE}/${selectedFrame.file}`;
    void img.decode().then(() => {
      if (!alive) return;
      clearTimeout(timeout);
      setImageError(false);
      setReady({ layer, frame: selectedFrame });
      // Only warm the next two frames. A 49-hour layer should not download on selection.
      layer.frames.slice(idx + 1, idx + 3).forEach(f => { new Image().src = `${WX_BASE}/${f.file}`; });
    }).catch(() => { if (alive) setImageError(true); });
    return () => { alive = false; clearTimeout(timeout); };
  }, [layer, selectedFrame, idx, retry]);

  const displayed = ready?.layer.id === layer?.id ? ready : null;
  const overlays: Overlay[] = displayed
    ? [{ url: `${WX_BASE}/${displayed.frame.file}`, bounds: displayed.layer.bounds, opacity: displayed.layer.opacity,
      tiles: displayed.layer.tiles ? { ...displayed.layer.tiles, baseUrl: `${WX_BASE}/${displayed.frame.file.replace(/\.webp$/, '')}` } : undefined }]
    : [];
  const stale = layer ? freshness(layer, now) : null;

  // the map wants a target; the forecast stage just parks on the region
  const target = useRef<MapTarget>({ ...HOME, nonce: 0 }).current;

  // the number under the probe for the active layer+frame; fetches the frame's
  // value grid on demand and caches it, so scrubbing re-reads instantly
  const valueAt = (lat: number, lon: number): string => {
    const meta = displayed?.layer.values;
    const data = displayed?.frame.data;
    if (!meta || !data) return '–';
    const url = `${WX_BASE}/${data}`;
    const hit = valueCache.get(url);
    if (hit === undefined && valueCache.size > 12) valueCache.delete(valueCache.keys().next().value!);
    if (hit === undefined) {
      valueCache.set(url, 'pending');
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return data.endsWith('.gz') && r.body
            ? new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json() : r.json();
        })
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
        minZ={2}
        maxZ={15}
        overlays={overlays}
        gridBounds={layer?.bounds}
      />

      {/* top-left: the layer picker, with the run provenance as a footnote
          under it rather than a title bar */}
      <div style={{ position: 'absolute', top: small ? 18 : 24, left: small ? 12 : 24, zIndex: 4, display: 'flex', flexDirection: 'column', gap: 7, maxWidth: small ? 'calc(100vw - 74px)' : 'calc(100% - 110px)' }}>
        {layers.length > 0 && (() => {
          const chip = (active: boolean): React.CSSProperties => ({
            ...PANEL, appearance: 'none', cursor: 'pointer', padding: '6px 11px',
            minHeight: 36, fontSize: 11.5, letterSpacing: '0.1em', textTransform: 'uppercase',
            whiteSpace: 'nowrap', flexShrink: 0,
            background: active ? '#e6ecf0' : (PANEL.background as string),
            color: active ? '#0e141c' : '#e6ecf0',
            // the active pick goes light, so it needs a dark line to hold
            // its edge against the light basemap
            border: active ? '1px solid #0e141c' : (PANEL.border as string),
          });
          return (
            <>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {groups.map((g) => (
                  <button key={g} aria-expanded={shownGroup === g} onClick={() => {
                    setOpenGroup(shownGroup === g ? null : g);
                    if (shownGroup !== g) setLayerId(layers.find(l => groupOf(l) === g)?.id ?? null);
                  }} style={chip(shownGroup === g)}>
                    {g} {shownGroup === g ? '▾' : '▸'}
                  </button>
                ))}
              </div>
              {shownGroup && (
                // phones: one row swiped sideways; the cut-off chip at the edge is the scroll affordance
                <div style={{ display: 'flex', gap: 6, ...(small ? { overflowX: 'auto' as const, scrollbarWidth: 'none' as const, paddingBottom: 2 } : { flexWrap: 'wrap' as const }) }}>
                  {layers.filter((l) => groupOf(l) === shownGroup).map((l) => (
                    <button key={l.id} onClick={() => setLayerId(l.id)} aria-pressed={l.id === layer?.id} style={chip(l.id === layer?.id)}>
                      {l.label.replace(new RegExp(`^${groupOf(l)} `), '')}
                    </button>
                  ))}
                </div>
              )}
            </>
          );
        })()}
        {layer && (
          <div style={{ fontFamily: RESIPLE, fontSize: 10.5, letterSpacing: '0.06em', color: stale ? '#8a5f10' : '#3d4a55', textShadow: HALO }}>
            {layer.kind === 'obs' ? 'Observed: NOAA MRMS radar' : `Forecast: ${layer.source.replace(/\s*·\s*/g, ', ')}`}
            {layer.init ? ` · ${layer.kind === 'obs' ? 'observed' : 'initialized'} ${fmtInit(layer.init)}` : ''}
            {stale && <strong style={{ display: 'block', color: '#8a4d00', marginTop: 5 }}>{stale}</strong>}
            {layer.accumulation_start && <div style={{ marginTop: 5 }}>Accumulated from {fmtInit(layer.accumulation_start)}</div>}
          </div>
        )}
        {(refreshError || imageError) && (
          <div role="status" style={{ fontFamily: RESIPLE, color: '#3d4a55', textShadow: HALO, fontSize: 11 }}>
            {refreshError ? 'Feed refresh failed.' : 'This frame is unavailable.'}{' '}
            <button onClick={() => { valueCache.clear(); setRetry(n => n + 1); }} style={{ appearance: 'none', background: 'none', border: 0, color: 'inherit', font: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>Retry</button>
          </div>
        )}
        {typeof manifest === 'object' && manifest.status?.degraded && layer && ['Nowcast', 'MRMS'].includes(groupOf(layer)) && (
          <div role="status" style={{ fontFamily: RESIPLE, color: '#3d4a55', textShadow: HALO, fontSize: 11 }}>Live radar input is delayed or incomplete.</div>
        )}
      </div>

      {/* right side: the active layer's colour scale, straight on the map,
          centred vertically now that the launcher opens as a panel, not a
          dropdown that could reach it */}
      {displayed?.layer.scale && (
        <div style={{ position: 'absolute', right: small ? 14 : 26, top: '50%', transform: 'translateY(-50%)', zIndex: 4, pointerEvents: 'none' }}>
          <ColorScale small={small} scale={displayed.layer.scale} />
        </div>
      )}

      {/* bottom-center: the timebar - a native range input is the whole widget */}
      {layer && layer.frames.length > 1 && (
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: small ? 30 : 34, zIndex: 4, ...PANEL, padding: '10px 16px', width: 'min(560px, calc(100vw - 32px))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range"
              min={0}
              max={layer.frames.length - 1}
              step={1}
              value={idx}
              onChange={(e) => setRequestedTime(Date.parse(layer.frames[Number(e.target.value)].valid))}
              aria-label="Forecast valid time"
              aria-valuetext={fmtValid(layer.frames[idx].valid)}
              style={{ flex: 1, minWidth: 0, accentColor: '#e6ecf0' }}
            />
            <button
              onClick={() => { setNow(Date.now()); setRequestedTime(null); }}
              aria-pressed={requestedTime === null}
              title="Show the forecast nearest the current time"
              style={{ appearance: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                minWidth: 52, minHeight: 32, padding: '5px 10px', fontFamily: RESIPLE, fontSize: 11, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: requestedTime === null ? '#0e141c' : '#e6ecf0',
                background: requestedTime === null ? '#e6ecf0' : 'transparent', border: '1px solid #8fa0ab', cursor: 'pointer' }}
            >Now</button>
            <span style={{ fontSize: 12, whiteSpace: 'nowrap', minWidth: small ? 74 : 92, textAlign: 'right' }}>{fmtValid(displayed?.frame.valid ?? layer.frames[idx].valid)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#8fa0ab', marginTop: 3 }}>
            <span>{fmtValid(layer.frames[0].valid)}</span>
            <span>{fmtValid(layer.frames[layer.frames.length - 1].valid)}</span>
          </div>
        </div>
      )}
      {/* single-frame layers (radar) get the valid time where the bar would be */}
      {layer && layer.frames.length === 1 && (
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: small ? 30 : 34, zIndex: 4, ...PANEL, padding: '8px 14px', fontSize: 12 }}>
          {fmtValid(layer.frames[0].valid)}{stale && <span style={{ color: '#d9a13c' }}> (stale)</span>}
        </div>
      )}

      {(manifest === 'error' || (typeof manifest === 'object' && layers.length === 0)) && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: 4, fontFamily: RESIPLE, color: '#3d4a55', textShadow: HALO, fontSize: 13 }}>
          The forecast feed could not be loaded. Retrying automatically.
        </div>
      )}
    </div>
  );
}
