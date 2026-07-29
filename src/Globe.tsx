import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { GlobeEngine } from './globeEngine';

interface Beat {
  color: string;
  label: string;
  title: string;
  body: ReactNode;
  stat: string;
}

const BEAT_INFO: Beat[] = [
  {
    color: '#6cc4e0',
    label: 'Air Team',
    title: 'Profiling the lower atmosphere',
    body: "A student-built tethersonde climbs the lowest 500 feet of air, measuring how temperature, humidity and wind shift with height — resolving lake-effect snow and the boundary layer over the Finger Lakes.",
    stat: '500 ft vertical profiles',
  },
  {
    color: '#4bb3a6',
    label: 'Water Team',
    title: 'Watching the water from orbit',
    body: (
      <>
        Using Sentinel-2 satellite imagery and the <em>waterquality</em> toolkit in R, we
        map harmful algal blooms across Cayuga Lake — tracking their color, size and spread
        to flag risks before they reach the shore.
      </>
    ),
    stat: 'Sentinel-2 · 10 m resolution',
  },
  {
    color: '#c98b5a',
    label: 'Rock Team',
    title: 'Listening to the ground',
    body: "A low-cost network of 17 soil-moisture and 5 air-quality sensors rings Cayuga Lake. Five nodes at the Game Farm site ground-truth NASA's NISAR satellite, linking what's in the dirt to what's seen from space.",
    stat: '17 soil-moisture nodes · NISAR',
  },
  {
    color: '#9b8ce0',
    label: 'Data Team',
    title: 'Turning readings into open data',
    body: 'Every sensor stream is cleaned, stored and published — filling gaps in the region\'s climate record and handing communities, researchers and the Emergent Climate Risk Lab data they can actually use.',
    stat: 'Public, community-ready datasets',
  },
  {
    color: '#e0b45a',
    label: 'Tech Team',
    title: 'The hardware behind it all',
    body: 'From Arduino and Raspberry Pi to radio links and a continuous temperature probe for Cayuga Lake, the tech team builds the guts that keep every other subteam\'s instruments alive in the field.',
    stat: 'Arduino · Raspberry Pi · LoRa',
  },
];

export default function Globe() {
  const sceneRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const hintRef = useRef<HTMLElement | null>(null);
  const beatRefs = useRef<(HTMLElement | null)[]>([]);
  const dotRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const engine = new GlobeEngine();
    engine.mount({
      sceneEl: sceneRef.current!,
      canvasEl: canvasRef.current!,
      heroEl: heroRef.current!,
      hintEl: hintRef.current!,
      beatEls: beatRefs.current,
      dotEls: dotRefs.current,
    });
    return () => engine.unmount();
  }, []);

  return (
    <section ref={sceneRef} style={{ position: 'relative', height: '640vh' }}>
      <div style={{ position: 'sticky', top: 0, height: '100vh', width: '100%', overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />

        {/* legibility gradients */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(90deg,rgba(8,11,15,0.92) 0%,rgba(8,11,15,0.55) 34%,rgba(8,11,15,0) 62%)' }} />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(140% 120% at 70% 45%,rgba(8,11,15,0) 55%,rgba(8,11,15,0.85) 100%)' }} />

        {/* HERO */}
        <div ref={(el: HTMLDivElement | null) => { heroRef.current = el; }} style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: 'min(560px,50%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 0 0 clamp(24px,5vw,72px)', zIndex: 10, willChange: 'opacity,transform' }}>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5bb98a', marginBottom: 22 }}>Cornell University · Project Team</div>
          <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 'clamp(52px,6.4vw,92px)', lineHeight: 0.95, letterSpacing: '-0.03em', margin: 0 }}>Geo<span style={{ color: '#5bb98a' }}>Data</span></h1>
          <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 500, fontSize: 'clamp(18px,1.7vw,24px)', color: '#cdd9df', margin: '20px 0 0', letterSpacing: '0.02em' }}>Design. Build. Deploy.</p>
          <p style={{ fontSize: 16.5, lineHeight: 1.6, color: '#a9bcc6', maxWidth: 440, margin: '22px 0 0' }}>We are Cornell's student team of engineers and earth scientists building low-cost instruments that measure a changing planet — from the soil under Cayuga Lake to the edge of the atmosphere.</p>
          <div style={{ display: 'flex', gap: 14, marginTop: 34 }}>
            <a href="#join" style={{ display: 'inline-block', padding: '13px 26px', borderRadius: 999, background: '#5bb98a', color: '#08130c', fontWeight: 600, fontSize: 15 }}>Join the team</a>
            <a href="#projects" style={{ display: 'inline-block', padding: '13px 26px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.18)', color: '#e6ecf0', fontWeight: 500, fontSize: 15 }}>See our projects</a>
          </div>
        </div>

        {/* BEAT CARDS */}
        {BEAT_INFO.map((beat, i) => (
          <div
            key={beat.label}
            ref={(el: HTMLElement | null) => { beatRefs.current[i] = el; }}
            style={{ position: 'absolute', bottom: '12vh', left: 'clamp(24px,5vw,72px)', width: 'min(480px,86%)', opacity: 0, zIndex: 10, willChange: 'opacity,transform' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: beat.color, marginBottom: 14 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: beat.color, display: 'inline-block', boxShadow: `0 0 12px ${beat.color}` }} />
              {beat.label}
            </div>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 'clamp(28px,3.3vw,42px)', lineHeight: 1.02, letterSpacing: '-0.02em', margin: 0 }}>{beat.title}</h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: '#b6c6ce', margin: '16px 0 0' }}>{beat.body}</p>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, color: beat.color, marginTop: 18 }}>{beat.stat}</div>
          </div>
        ))}

        {/* beat progress dots */}
        <div style={{ position: 'absolute', right: 38, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 14, zIndex: 10 }}>
          {BEAT_INFO.map((beat, i) => (
            <span
              key={beat.label}
              ref={(el: HTMLElement | null) => { dotRefs.current[i] = el; }}
              style={{ width: 8, height: 8, borderRadius: 999, background: beat.color, opacity: 0.25, transition: 'opacity .3s,transform .3s' }}
            />
          ))}
        </div>

        {/* scroll hint */}
        <div ref={(el: HTMLDivElement | null) => { hintRef.current = el; }} style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7c909b', zIndex: 10 }}>
          <span>Scroll to explore</span>
          <span style={{ display: 'inline-block', animation: 'bob 1.8s ease-in-out infinite', fontSize: 15 }}>↓</span>
        </div>
      </div>
    </section>
  );
}
