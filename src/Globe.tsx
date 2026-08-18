import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { GlobeEngine } from './globeEngine';

interface Card {
  color: string;
  label: string;
  title: string;
  body: ReactNode;
  stat: string;
}

// one card per clickable prop on the globe, keyed by the engine's prop keys
const CARDS: Record<string, Card> = {
  home: {
    color: '#4fae7d',
    label: 'Home Base',
    title: 'Rooted in the Finger Lakes',
    body: 'GeoData is based on Cornell\'s campus in Ithaca, New York, up the hill from Cayuga Lake. Everything we build starts here, and the goal is simple: protect the Finger Lakes region we call home.',
    stat: 'Ithaca, NY · Cornell University',
  },
  air: {
    color: '#6d9dcd',
    label: 'Air Team',
    title: 'Profiling the lower atmosphere',
    body: "Our student-built tethersonde climbs the lowest 500 feet of the atmosphere and records how temperature, humidity and wind change on the way up. That data helps us make sense of lake-effect snow and the boundary layer over the Finger Lakes.",
    stat: '500 ft vertical profiles',
  },
  water: {
    color: '#094295',
    label: 'Water Team',
    title: 'Watching the water from orbit',
    body: (
      <>
        Using Sentinel-2 satellite imagery and the <em>waterquality</em> toolkit in R, we
        map harmful algal blooms across Cayuga Lake. We track their color, size and spread
        so problems get flagged before they reach the shore.
      </>
    ),
    stat: 'Sentinel-2 · 10 m resolution',
  },
  rock: {
    color: '#914724',
    label: 'Rock Team',
    title: 'Listening to the ground',
    body: "A low-cost network of 17 soil-moisture and 5 air-quality sensors rings Cayuga Lake. Five nodes at the Game Farm site ground-truth NASA's NISAR satellite, linking what's in the dirt to what's seen from space.",
    stat: '17 soil-moisture nodes · NISAR',
  },
  data: {
    color: '#5d177f',
    label: 'Data Team',
    title: 'Turning readings into open data',
    body: 'We clean, store and publish every sensor stream the team produces. That fills gaps in the region\'s climate record and gives communities, researchers and the Emergent Climate Risk Lab data they can actually use.',
    stat: 'Public, community-ready datasets',
  },
  tech: {
    color: '#8f0c3a',
    label: 'Tech Team',
    title: 'The hardware behind it all',
    body: 'From Arduino and Raspberry Pi to radio links and a continuous temperature probe for Cayuga Lake, the tech team builds the guts that keep every other subteam\'s instruments alive in the field.',
    stat: 'Arduino · Raspberry Pi · LoRa',
  },
};

export default function Globe() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(null);
  // decided once at mount: phones get a plain text hero, no 3D at all — the
  // engine chunk and models are never even downloaded there
  const [isMobile] = useState(() => window.matchMedia('(max-width: 720px)').matches);

  useEffect(() => {
    if (isMobile) return;
    // dynamic import keeps three.js out of the initial bundle — the hero copy
    // paints immediately and the globe streams in behind it
    let engine: GlobeEngine | undefined;
    let cancelled = false;
    const canvasEl = canvasRef.current!;
    import('./globeEngine').then((mod) => {
      if (cancelled) return;
      engine = new mod.GlobeEngine();
      engine.mount({ canvasEl, onPropClick: (key) => setOpenCard(key) });
    });
    return () => { cancelled = true; engine?.unmount(); };
  }, [isMobile]);

  const card = openCard ? CARDS[openCard] : null;

  return (
    <section className="globe-sticky" style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
      {!isMobile && <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />}

      {/* HERO */}
      <div className="hero-panel" style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: 'min(560px,50%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 0 0 clamp(24px,5vw,72px)', zIndex: 10, pointerEvents: 'none' }}>
        <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#086727', marginBottom: 14 }}>Cornell University · Project Team</div>
        <h1 className="hero-title" style={{ fontFamily: "'Intan',sans-serif", fontWeight: 700, fontSize: 'clamp(60px,8vw,120px)', lineHeight: 0.95, letterSpacing: '-0.03em', margin: '0 0 -0.19em -0.045em' }}>Geo<span style={{ color: '#086727' }}>Data</span></h1>
        <p style={{ fontSize: 16.5, lineHeight: 1.6, color: '#a9bcc6', maxWidth: 440, margin: '22px 0 0' }}>Cornell students building low-cost instruments that measure a changing planet, from the soil under Cayuga Lake to the edge of the atmosphere.</p>
        <div style={{ marginTop: 34 }}>
          <a href="#join" style={{ display: 'inline-block', padding: '14px 28px', borderRadius: 999, background: '#086727', color: '#eaf2ee', fontWeight: 700, fontSize: 17.5, fontFamily: "'Resiple',sans-serif", pointerEvents: 'auto' }}>Join the team</a>
        </div>
      </div>

      {/* PROP CARD POPUP */}
      {card && (
        <div style={{ position: 'absolute', bottom: '10vh', right: 'clamp(24px,4vw,56px)', width: 'min(320px,86%)', zIndex: 10, background: 'rgba(10,14,18,0.78)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', padding: 18, borderRadius: 10 }}>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpenCard(null)}
            style={{ position: 'absolute', top: 6, right: 10, background: 'transparent', border: 'none', color: '#7c909b', fontSize: 20, cursor: 'pointer', padding: 4, lineHeight: 1 }}
          >
            ×
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Resiple',sans-serif", fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: card.color, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: card.color, display: 'inline-block' }} />
            {card.label}
          </div>
          <h2 style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 600, fontSize: 22, lineHeight: 1.05, letterSpacing: '-0.02em', margin: 0 }}>{card.title}</h2>
          <p style={{ fontSize: 13.5, lineHeight: 1.55, color: '#b6c6ce', margin: '10px 0 0' }}>{card.body}</p>
          <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 11.5, color: card.color, marginTop: 12 }}>{card.stat}</div>
        </div>
      )}
    </section>
  );
}
