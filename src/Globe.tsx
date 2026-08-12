import { useEffect, useRef, useState } from 'react';
import { GlobeEngine } from './globeEngine';

// temporary font audition for the GeoData title — each key cycles through one
// downloaded batch in public/fonts/test/, wrapping back to the default (Awake).
// Delete this + the keydown effect once a font is picked.
const TEST_FONTS: Record<string, string[]> = {
  y: [ // ~/Downloads/newfonts
    'akuina.otf', 'aniko.otf', 'awake.otf', 'buffalord.ttf', 'capricious.otf',
    'catamaran.ttf', 'comedoit.ttf', 'comixo.otf', 'corpoa.otf', 'death-craft.ttf',
    'distro.ttf', 'gelline.otf', 'ginerin.otf', 'gokschil.otf', 'ignazio.otf',
    'jazzyrabbit.ttf', 'jazzyrabbit-remake.ttf', 'kabrio.ttf', 'kirgina.ttf',
    'merich.otf', 'mulane.otf', 'oddval.otf', 'ov-soge.otf', 'plumpkins.otf',
    'pottred.ttf', 'pretosh.otf', 'saira-condensed.ttf', 'saira-extracondensed.ttf',
  ],
  u: [ // ~/Downloads/newer
    '36-days-ago.ttf', 'evergreen.otf', 'gefika.otf', 'glowdust.otf', 'grolear.ttf',
    'intan.otf', 'keretro.ttf', 'maiky-retro.otf', 'mokenzo.otf', 'quietly.otf',
    'racoti.otf', 'resonik.otf', 'tyllon.otf', 'xenophile.otf',
  ],
};

export default function Globe() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [towerOpen, setTowerOpen] = useState(false);
  const [testFont, setTestFont] = useState<{ fam: string; file: string } | null>(null);

  useEffect(() => {
    const engine = new GlobeEngine();
    engine.mount({
      canvasEl: canvasRef.current!,
      onTowerClick: () => setTowerOpen(true),
    });
    return () => engine.unmount();
  }, []);

  useEffect(() => {
    const idx: Record<string, number> = {};
    const onKey = (e: KeyboardEvent): void => {
      const batch = TEST_FONTS[e.key];
      if (!batch) return;
      idx[e.key] = ((idx[e.key] ?? -1) + 1) % (batch.length + 1);
      const i = idx[e.key];
      if (i === batch.length) { setTestFont(null); return; } // back to the default
      const file = batch[i];
      const fam = `TitleTest ${file.replace(/\.[^.]+$/, '')}`;
      // wide weight range so the h1's fontWeight:700 doesn't trigger faux-bold
      new FontFace(fam, `url("/fonts/test/${file}")`, { weight: '100 900' }).load()
        .then((f) => { document.fonts.add(f); setTestFont({ fam, file }); })
        .catch((err) => console.error('[font test] failed to load', file, err));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <section className="globe-sticky" style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />

      {/* HERO */}
      <div className="hero-panel" style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: 'min(560px,50%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 0 0 clamp(24px,5vw,72px)', zIndex: 10, pointerEvents: 'none' }}>
        <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#086727', marginBottom: 14 }}>Cornell University · Project Team</div>
        <h1 style={{ fontFamily: testFont ? `'${testFont.fam}',sans-serif` : "'Intan',sans-serif", fontWeight: 700, fontSize: 'clamp(60px,8vw,120px)', lineHeight: 0.95, letterSpacing: '-0.03em', margin: '0 0 -0.19em -0.045em' }}>Geo<span style={{ color: '#086727' }}>Data</span></h1>
        <p style={{ fontSize: 16.5, lineHeight: 1.6, color: '#a9bcc6', maxWidth: 440, margin: '22px 0 0' }}>Cornell students building low-cost instruments that measure a changing planet — from the soil under Cayuga Lake to the edge of the atmosphere.</p>
        <div style={{ marginTop: 34 }}>
          <a href="#join" style={{ display: 'inline-block', padding: '14px 28px', borderRadius: 999, background: '#086727', color: '#eaf2ee', fontWeight: 700, fontSize: 17.5, fontFamily: "'Resiple',sans-serif", pointerEvents: 'auto' }}>Join the team</a>
        </div>
      </div>

      {testFont && (
        <div style={{ position: 'absolute', bottom: 14, left: 16, zIndex: 20, fontFamily: "'Natural Mono',monospace", fontSize: 12, color: '#7c909b', background: 'rgba(10,14,18,0.7)', padding: '4px 10px', borderRadius: 6 }}>
          font: {testFont.file} — y: batch 1 · u: batch 2
        </div>
      )}

      {/* CLOCKTOWER POPUP */}
      {towerOpen && (
        <div style={{ position: 'absolute', bottom: '10vh', right: 'clamp(24px,4vw,56px)', width: 'min(320px,86%)', zIndex: 10, background: 'rgba(10,14,18,0.78)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', padding: 18, borderRadius: 10 }}>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setTowerOpen(false)}
            style={{ position: 'absolute', top: 6, right: 10, background: 'transparent', border: 'none', color: '#7c909b', fontSize: 20, cursor: 'pointer', padding: 4, lineHeight: 1 }}
          >
            ×
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Resiple',sans-serif", fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4fae7d', marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#4fae7d', display: 'inline-block' }} />
            Home Base
          </div>
          <h2 style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 600, fontSize: 22, lineHeight: 1.05, letterSpacing: '-0.02em', margin: 0 }}>Rooted in the Finger Lakes</h2>
          <p style={{ fontSize: 13.5, lineHeight: 1.55, color: '#b6c6ce', margin: '10px 0 0' }}>GeoData lives on Cornell's campus in Ithaca, New York, above Cayuga Lake. Everything we design, build and deploy starts here — with a mission to protect and serve the Finger Lakes region we call home.</p>
          <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 11.5, color: '#4fae7d', marginTop: 12 }}>Ithaca, NY · Cornell University</div>
        </div>
      )}
    </section>
  );
}
