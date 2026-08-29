import { useEffect, useRef, useState } from 'react';
import { TILE, lonToX, latToY, xToLon, yToLat } from '../lib/mercator';
import { AIR, SOIL, type GlobeSite } from '../lib/sites';
import { RESIPLE } from '../styles/theme';

// Esri World Imagery: keyless, and the only free source that actually reaches
// street level over Tompkins County - the USGS National Map is public domain
// but its imagery stops at z16 here (~1.8 m/px). Swap these two lines to change
// provider; the {z}/{y}/{x} path order is Esri's own.
const TILE_URL = (z: number, x: number, y: number) =>
  `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
const ATTRIBUTION = 'Imagery: Esri, Maxar, Earthstar Geographics';

const MIN_Z = 11;
const MAX_Z = 20;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export interface MapTarget { lat: number; lon: number; zoom: number; nonce: number }

export default function TileMap({ sites, selectedIds, onSelect, target, initial, onView, dur = 1400 }: {
  sites: GlobeSite[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  // the map eases to this whenever `nonce` changes
  target: MapTarget;
  // where the map opens before easing to the first target - a wide framing, so
  // arriving from the globe continues the fall instead of cutting to the ground
  initial?: { lat: number; lon: number; zoom: number };
  // reports the live view, so an overlay anchored to a pin can follow it
  onView?: (v: { lat: number; lon: number; zoom: number }) => void;
  dur?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // tiles fade in on arrival instead of popping; once seen, a tile stays
  // opaque across re-renders (the set outlives the onLoad DOM write)
  const seen = useRef(new Set<string>()).current;
  const [view, setView] = useState(initial ?? { lat: target.lat, lon: target.lon, zoom: target.zoom });
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ease to each new target rather than jumping, so arriving from the globe and
  // moving between sensors read as the same continuous descent
  useEffect(() => {
    const from = { ...viewRef.current };
    const t0 = performance.now();
    let raf = 0;
    const step = () => {
      const k = easeInOut(Math.min(1, (performance.now() - t0) / dur));
      setView({
        lat: from.lat + (target.lat - from.lat) * k,
        lon: from.lon + (target.lon - from.lon) * k,
        zoom: from.zoom + (target.zoom - from.zoom) * k,
      });
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.nonce]);

  // ---- panning ----
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    let last: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      last = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    };
    const move = (e: PointerEvent) => {
      if (!last) return;
      const v = viewRef.current;
      const z = v.zoom;
      const cx = lonToX(v.lon, z) - (e.clientX - last.x);
      const cy = latToY(v.lat, z) - (e.clientY - last.y);
      last = { x: e.clientX, y: e.clientY };
      setView({ lat: yToLat(cy, z), lon: xToLon(cx, z), zoom: z });
    };
    const up = (e: PointerEvent) => {
      last = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      el.style.cursor = 'grab';
    };
    // unlike the globe, the map owns a plain wheel too: the imagery fills the
    // page, so scrolling reads as zoom, not as leaving
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      setView({ ...v, zoom: clamp(v.zoom - e.deltaY * 0.01, MIN_Z, MAX_Z) });
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, []);

  useEffect(() => { onView?.(view); }, [view, onView]);

  const { w, h } = size;
  const midX = w / 2;
  const Z = clamp(Math.round(view.zoom), MIN_Z, MAX_Z);
  const scale = 2 ** (view.zoom - Z);

  // one integer zoom level's worth of tiles, centred on the view
  const layer = (lvl: number) => {
    if (!w || !h) return null;
    const s = 2 ** (view.zoom - lvl);
    const cx = lonToX(view.lon, lvl);
    const cy = latToY(view.lat, lvl);
    const halfW = w / 2 / s + TILE;
    const halfH = h / 2 / s + TILE;
    const n = 2 ** lvl;
    const out = [];
    for (let x = Math.floor((cx - halfW) / TILE); x <= Math.floor((cx + halfW) / TILE); x++) {
      for (let y = Math.floor((cy - halfH) / TILE); y <= Math.floor((cy + halfH) / TILE); y++) {
        if (y < 0 || y >= n) continue;
        const wx = ((x % n) + n) % n;
        const url = TILE_URL(lvl, wx, y);
        out.push(
          <img
            key={`${lvl}/${wx}/${y}`}
            src={url}
            alt=""
            draggable={false}
            decoding="async"
            onLoad={(e) => { seen.add(url); e.currentTarget.style.opacity = '1'; }}
            style={{ position: 'absolute', left: x * TILE - cx, top: y * TILE - cy, width: TILE, height: TILE, userSelect: 'none', opacity: seen.has(url) ? 1 : 0, transition: 'opacity 250ms ease' }}
          />,
        );
      }
    }
    return (
      <div style={{ position: 'absolute', left: midX, top: h / 2, transform: `scale(${s})`, transformOrigin: '0 0' }}>
        {out}
      </div>
    );
  };

  const cx = lonToX(view.lon, Z);
  const cy = latToY(view.lat, Z);
  const screen = (s: GlobeSite) => ({
    x: (lonToX(s.lon, Z) - cx) * scale + midX,
    y: (latToY(s.lat, Z) - cy) * scale + h / 2,
  });

  return (
    <div ref={boxRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: 'grab', background: '#0e141c', touchAction: 'pan-y' }}>
      {/* the parent level sits underneath so a zoom step never shows through to
          nothing while the finer tiles are still arriving */}
      {Z > MIN_Z && layer(Z - 1)}
      {layer(Z)}

      {/* Jefferson-style markers: the color is the information - a solid dot
          per family, hollow for retired, no names printed on the map. The
          name fades in on hover and stays while selected; the legend below
          decodes the colors. */}
      <style>{'.pin-label{opacity:0;transition:opacity .15s ease}button:hover>.pin-label{opacity:1}'}</style>
      {sites.map((s) => {
        const p = screen(s);
        if (!w || p.x < -80 || p.y < -40 || p.x > w + 80 || p.y > h + 40) return null;
        const on = selectedIds.includes(s.id);
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            aria-label={`${s.name} - ${s.sub}`}
            style={{
              position: 'absolute', left: p.x, top: p.y, width: 0, height: 0, overflow: 'visible',
              appearance: 'none', cursor: 'pointer', background: 'transparent', border: 'none', padding: 0,
            }}
          >
            <span style={{
              position: 'absolute', left: -8, top: -8, width: 16, height: 16, borderRadius: 999,
              background: s.retired ? 'transparent' : s.tone,
              border: s.retired ? `2px solid ${s.tone}` : '2px solid rgba(14,20,28,0.9)',
              // retired rings are hollow, so they get a dark line on both faces
              // of the tone ring to hold their edge against any imagery
              boxShadow:
                (s.retired ? 'inset 0 0 0 1.5px rgba(14,20,28,0.9), 0 0 0 1.5px rgba(14,20,28,0.9), ' : '') +
                (on ? `0 0 0 ${s.retired ? 4.5 : 3}px #ffffff, 0 0 16px ${s.tone}` : `0 0 9px ${s.tone}80, 0 1px 4px rgba(0,0,0,0.5)`),
              transition: 'box-shadow .18s',
            }} />
            <span className="pin-label" style={{
              position: 'absolute', left: 0, top: s.labelBelow ? 14 : -32, transform: 'translateX(-50%)', whiteSpace: 'nowrap',
              fontFamily: RESIPLE, fontSize: 12.5, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: '#ffffff', textShadow: '0 1px 4px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.6)',
              opacity: on ? 1 : undefined, pointerEvents: 'none',
            }}>
              {s.name}
            </span>
          </button>
        );
      })}

      {/* the legend that lets the dots stay wordless */}
      <div style={{
        position: 'absolute', left: 14, bottom: 12, display: 'flex', gap: 18, alignItems: 'center',
        padding: '8px 14px', background: 'rgba(14,20,28,0.72)', backdropFilter: 'blur(6px)',
        border: '1px solid #ffffff', pointerEvents: 'none',
      }}>
        {([
          [AIR, 'Air quality'],
          [SOIL, 'Soil moisture'],
        ] as const).map(([tone, name]) => (
          <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: RESIPLE, fontSize: 11.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ffffff' }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: tone, border: '1px solid rgba(14,20,28,0.9)' }} />
            {name}
          </span>
        ))}
      </div>

      <span style={{ position: 'absolute', right: 12, bottom: 12, fontFamily: RESIPLE, fontSize: 10.5, color: 'rgba(230,236,240,0.75)', textShadow: '0 1px 3px rgba(0,0,0,0.9)', pointerEvents: 'none' }}>
        {ATTRIBUTION}
      </span>
    </div>
  );
}
