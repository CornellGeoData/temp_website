import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { ReactNode } from 'react';
import type { GlobeEngine } from '../lib/globeEngine';
import type { GlobeSite } from '../lib/sites';
import { lonToX } from '../lib/mercator';
import TileMap, { type MapTarget } from './TileMap';
import { RESIPLE } from '../styles/theme';

// The whole network fits in about 3.3 km - a hundredth of a degree. There is no
// globe zoom at which those seven probes are separable, so the globe does not
// try: it carries one marker for the site, and the individual sensors exist
// only on the imagery below, where they sit at their true coordinates.
const WORLD_ZOOM = 1.45;
const DIVE_ZOOM = 2.6;
// the map opens wide and closes to the whole network, so the descent lands on
// something you can read rather than on one roof
const MAP_OPEN_Z = 12.4;
const MAP_NET_Z = 14.8;
// where the descent lands: hand-tuned framing, a touch west of the sites'
// centroid so campus and the Gamefarm cluster share the screen
const LAND = { lat: 42.44742, lon: -76.46413 };
const FADE_MS = 900;

// where the detached readings card parks: inset from the side, clear of the
// title and the top-right controls
const EDGE = 16;
const CARD_TOP = 74;

const CTRL: React.CSSProperties = {
  appearance: 'none', cursor: 'pointer', padding: '7px 15px',
  border: '1px solid #ffffff', background: 'rgba(14,20,28,0.72)',
  color: '#ffffff', fontFamily: RESIPLE, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase',
};

export default function SensorGlobe({ sites, selectedIds, onSelect, accent, cards, onMapChange, descendRef }: {
  sites: GlobeSite[];
  selectedIds: string[];
  onSelect: (id: string | null) => void;
  accent: string;
  // one floating readings card per open sensor
  cards?: { id: string; node: ReactNode }[];
  // fires when the view crosses between globe and imagery, so the page can
  // restyle itself (e.g. swap the title chrome) around the map
  onMapChange?: (onMap: boolean) => void;
  // filled with the descent trigger, so page chrome (the tip's link) can start it
  descendRef?: { current: (() => void) | null };
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLButtonElement>(null);
  const mapViewRef = useRef<{ lat: number; lon: number; zoom: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GlobeEngine | null>(null);
  const [noWebGL, setNoWebGL] = useState(false);
  // phones get the plain list; three.js is never downloaded there
  const [isMobile] = useState(() => window.matchMedia('(max-width: 720px)').matches);

  const [onMap, setOnMap] = useState(false);
  useEffect(() => { onMapChange?.(onMap); }, [onMap, onMapChange]);
  const nonce = useRef(0);

  const centre = useMemo(() => ({
    lat: sites.reduce((a, s) => a + s.lat, 0) / sites.length,
    lon: sites.reduce((a, s) => a + s.lon, 0) / sites.length,
  }), [sites]);
  // The map is mounted from the start, invisible under the globe, so its
  // tiles are already loaded and decoded by the time anyone descends - the
  // cross-fade lands on imagery, never on a dark void filling in tile by tile.
  const [mapTarget, setMapTarget] = useState<MapTarget>(() => ({
    lat: LAND.lat, lon: LAND.lon, zoom: MAP_OPEN_Z, nonce: 0,
  }));
  const centreRef = useRef(centre);
  centreRef.current = centre;
  const sitesRef = useRef(sites);
  sitesRef.current = sites;

  useEffect(() => {
    if (isMobile) return;
    let cancelled = false;
    const canvasEl = canvasRef.current!;

    // the marker rides the globe, so it is repositioned against the frame that
    // was just drawn rather than through React state
    const onFrame = () => {
      const eng = engineRef.current;
      const el = markerRef.current;
      if (!eng || !el) return;
      const p = eng.project(centreRef.current.lat, centreRef.current.lon);
      if (!p || !p.visible) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; return; }
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
      el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
    };

    import('../lib/globeEngine').then((mod) => {
      if (cancelled) return;
      const e = new mod.GlobeEngine({
        aimLat: centreRef.current.lat,
        aimLon: centreRef.current.lon,
        yaw: 0, pitch: 0, zoom: WORLD_ZOOM,
        minZoom: 0.7, maxZoom: DIVE_ZOOM,
        userZoom: false, // rotation only - the descent's flyTo is the sole zoom

        sizeMode: 'element', cameraZ: 3.2,
        onFrame,
      });
      e.mount({ canvasEl, onNoWebGL: () => setNoWebGL(true) });
      engineRef.current = e;
    });
    return () => {
      cancelled = true;
      engineRef.current?.unmount();
      engineRef.current = null;
    };
  }, [isMobile]);

  // ---- the fall, and the climb back out ----
  const pauseTimer = useRef(0);
  const descend = () => {
    setMapTarget({
      lat: LAND.lat,
      lon: LAND.lon,
      zoom: MAP_NET_Z,
      nonce: ++nonce.current,
    });
    // keep driving the globe in under the cross-fade so the motion never stalls
    engineRef.current?.flyTo(centre.lat, centre.lon, DIVE_ZOOM, FADE_MS);
    setOnMap(true);
    window.clearTimeout(pauseTimer.current);
    pauseTimer.current = window.setTimeout(() => engineRef.current?.pause(), FADE_MS + 120);
  };
  if (descendRef) descendRef.current = descend;

  const ascend = () => {
    onSelect(null);
    // a quick round trip must not leave the pending pause to freeze the ascent
    window.clearTimeout(pauseTimer.current);
    engineRef.current?.resume();
    engineRef.current?.flyTo(centre.lat, centre.lon, WORLD_ZOOM, FADE_MS);
    setOnMap(false);
  };

  // WebGL blocked: there is no globe to fall from, so open on the imagery
  useEffect(() => {
    if (!noWebGL) return;
    setMapTarget({ lat: LAND.lat, lon: LAND.lon, zoom: MAP_NET_Z, nonce: ++nonce.current });
    setOnMap(true);
  }, [noWebGL, centre.lat, centre.lon]);


  const pinDot = (tone: string, on: boolean, retired?: boolean) => (
    <span style={{
      width: on ? 13 : 9, height: on ? 13 : 9, borderRadius: 999, flexShrink: 0,
      background: retired ? 'transparent' : tone,
      border: `2px solid ${tone}`,
      boxShadow: on ? `0 0 0 5px ${tone}33` : 'none',
      transition: 'width .18s, height .18s, box-shadow .18s',
    }} />
  );

  // no 3D on phones - the page is otherwise nothing but the globe, so without
  // this there would be no way to reach a sensor at all
  if (isMobile) {
    return (
      <div style={{ marginTop: 24, border: `1px solid ${accent}`, background: '#141c26' }}>
        {sites.map((s, i) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
              appearance: 'none', cursor: 'pointer', padding: '14px 18px',
              borderTop: i ? '1px solid rgba(255,255,255,0.09)' : 'none', borderLeft: 0, borderRight: 0, borderBottom: 0,
              background: selectedIds.includes(s.id) ? 'rgba(255,255,255,0.06)' : 'transparent',
            }}
          >
            {pinDot(s.tone, selectedIds.includes(s.id), s.retired)}
            <span style={{ fontFamily: RESIPLE, fontSize: 14.5, color: '#e6ecf0' }}>{s.name}</span>
            <span style={{ fontFamily: RESIPLE, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7c909b', marginLeft: 'auto' }}>{s.sub}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={rootRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* ---- globe stage ---- */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: onMap ? 0 : 1,
        transform: onMap ? 'scale(1.6)' : 'scale(1)',
        transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
        pointerEvents: onMap ? 'none' : 'auto',
      }}>
        {!noWebGL && <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />}

        {!noWebGL && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {/* the same dot the map draws, so orbit and imagery speak one
                language: solid glowing dot, one thin fixed ring, name beneath */}
            <button
              ref={markerRef}
              onClick={() => descend()}
              aria-label={`Ithaca, NY - ${sites.length} sensors`}
              style={{
                position: 'absolute', top: 0, left: 0, opacity: 0, width: 46, height: 46, overflow: 'visible',
                display: 'grid', placeItems: 'center',
                appearance: 'none', cursor: 'pointer', background: 'transparent', border: 'none', padding: 0,
              }}
            >
              <span style={{ width: 14, height: 14, borderRadius: 999, background: '#ffffff', border: '2px solid #0e141c', boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }} />
              <span style={{
                position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 1,
                fontFamily: RESIPLE, fontSize: 12.5, letterSpacing: '0.16em', textTransform: 'uppercase',
                color: '#e6ecf0', textShadow: '0 1px 6px rgba(0,0,0,0.9)', whiteSpace: 'nowrap',
              }}>
                Ithaca
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ---- imagery stage: always mounted, so its tiles are warm ---- */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: onMap ? 1 : 0,
        transform: onMap ? 'scale(1)' : 'scale(1.35)',
        transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
        pointerEvents: onMap ? 'auto' : 'none',
      }}>
        <TileMap
          sites={sites}
          selectedIds={selectedIds}
          onSelect={onSelect}
          target={mapTarget}
          initial={{ lat: LAND.lat, lon: LAND.lon, zoom: MAP_OPEN_Z }}
          onView={(v) => { mapViewRef.current = v; }}
          dur={FADE_MS + 500}
        />
      </div>

      {/* ---- the readings: one card per open sensor, each auto-parked in a
          cascade until dragged by its header ---- */}
      {onMap && cards?.map(({ id, node }, i) => (
        <FloatingCard key={id} index={i} node={node} site={sites.find((s) => s.id === id)} rootRef={rootRef} mapViewRef={mapViewRef} />
      ))}

      {/* ---- the one map control: the way back. Zoom is wheel and pinch. ---- */}
      {onMap && !noWebGL && (
        <button onClick={ascend} style={{ ...CTRL, position: 'absolute', top: 24, right: 24, zIndex: 7 }}>Back</button>
      )}
    </div>
  );
}

// bring-to-front counter shared by every floating card on the stage
let zTop = 10;

// One sensor's readings card: parks in whichever top corner is away from its
// pin (cascaded by index so stacked cards stay reachable), until the user
// drags it by its header - from then on their placement wins, clamped to the
// stage so it can never be lost off-screen. Clicking anywhere on a card
// raises it above its siblings.
function FloatingCard({ site, index, node, rootRef, mapViewRef }: {
  site?: GlobeSite;
  index: number;
  node: ReactNode;
  rootRef: { current: HTMLDivElement | null };
  mapViewRef: { current: { lat: number; lon: number; zoom: number } | null };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  // a card opens on top of the stack, not under it
  useEffect(() => { if (ref.current) ref.current.style.zIndex = String(++zTop); }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = ref.current, box = rootRef.current;
      if (!el || !box) return;
      const w = box.clientWidth;
      let x: number, y: number;
      if (pos.current) {
        ({ x, y } = pos.current);
      } else {
        const v = mapViewRef.current;
        let px = 0;
        if (v && site) {
          const Z = Math.max(11, Math.min(20, Math.round(v.zoom)));
          const k = 2 ** (v.zoom - Z);
          px = (lonToX(site.lon, Z) - lonToX(v.lon, Z)) * k + w / 2;
        }
        const left = px >= w / 2;
        x = (left ? EDGE : w - el.offsetWidth - EDGE) + (left ? 1 : -1) * index * 36;
        y = CARD_TOP + index * 36;
      }
      x = Math.max(EDGE, Math.min(w - el.offsetWidth - EDGE, x));
      y = Math.max(EDGE, Math.min(box.clientHeight - 56, y));
      el.style.transform = `translate(${x}px, ${y}px)`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [site, index, rootRef, mapViewRef]);

  const endDrag = () => {
    drag.current = null;
    if (ref.current) ref.current.style.transition = 'transform 350ms ease';
  };

  return (
    <div
      ref={ref}
      onPointerDownCapture={() => { if (ref.current) ref.current.style.zIndex = String(++zTop); }}
      onPointerDown={(e) => {
        const t = e.target as HTMLElement;
        if (!t.closest('[data-drag-handle]') || t.closest('button')) return;
        const el = ref.current!;
        const r = el.getBoundingClientRect();
        const br = rootRef.current!.getBoundingClientRect();
        drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
        pos.current = { x: r.left - br.left, y: r.top - br.top };
        el.setPointerCapture(e.pointerId);
        el.style.transition = 'none';
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const br = rootRef.current!.getBoundingClientRect();
        pos.current = { x: e.clientX - br.left - d.dx, y: e.clientY - br.top - d.dy };
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ position: 'absolute', top: 0, left: 0, zIndex: 6, willChange: 'transform', transition: 'transform 350ms ease' }}
    >
      {node}
    </div>
  );
}
