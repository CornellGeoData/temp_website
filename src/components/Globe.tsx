import { useEffect, useRef, useState } from 'react';

export default function Globe() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // WebGL blocked (Firefox resistFingerprinting, blocklisted drivers, etc.):
  // swap the canvas for a pre-rendered still of the same scene
  const [noWebGL, setNoWebGL] = useState(false);
  // decided once at mount: phones get a plain text hero, no 3D at all - the
  // engine chunk and models are never even downloaded there
  const [isMobile] = useState(() => window.matchMedia('(max-width: 720px)').matches);

  useEffect(() => {
    if (isMobile) return;
    // dynamic import keeps three.js out of the initial bundle - the hero copy
    // paints immediately and the globe streams in behind it
    let engine: { unmount(): void } | undefined;
    let cancelled = false;
    const canvasEl = canvasRef.current!;
    import('../lib/globeEngine').then((mod) => {
      if (cancelled) return;
      const e = new mod.GlobeEngine({ userZoom: false }); // hero globe: drag only, no zoom
      e.mount({ canvasEl, onNoWebGL: () => setNoWebGL(true) });
      engine = e;
    });
    return () => { cancelled = true; engine?.unmount(); };
  }, [isMobile]);

  return (
    <section className="globe-sticky" style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
      {!isMobile && !noWebGL && <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />}
      {noWebGL && <img src="/globe-fallback.webp" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'right center' }} />}

      {/* HERO */}
      <div className="hero-panel" style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: 'min(560px,50%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 0 0 clamp(24px,5vw,72px)', zIndex: 10, pointerEvents: 'none' }}>
        <h1 className="hero-title" style={{ fontFamily: "'Intan',sans-serif", fontWeight: 700, fontSize: 'clamp(60px,8vw,120px)', lineHeight: 0.95, letterSpacing: '-0.03em', margin: '0 0 -0.19em -0.045em' }}>Geo<span style={{ color: '#086727' }}>Data</span></h1>
        <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 'clamp(16px,1.55vw,20px)', fontWeight: 700, letterSpacing: '0.17em', textTransform: 'uppercase', color: '#4fae7d', marginTop: 26 }}>Cornell University Project Team</div>
        <div style={{ marginTop: 34 }}>
          <a href="#join" style={{ display: 'inline-block', padding: '14px 28px', borderRadius: 999, background: '#086727', color: '#eaf2ee', fontWeight: 700, fontSize: 17.5, fontFamily: "'Resiple',sans-serif", pointerEvents: 'auto' }}>Join the team</a>
        </div>
      </div>
    </section>
  );
}
