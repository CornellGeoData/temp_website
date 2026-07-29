import Globe from './Globe';

interface Project {
  photo: string;
  tag: string;
  tagColor: string;
  title: string;
  body: string;
}

interface ImpactStat {
  value: string;
  label: string;
}

const PROJECTS: Project[] = [
  {
    photo: '[ field photo — Cayuga Lake sensor ]',
    tag: 'Rock · Water · Air',
    tagColor: '#c98b5a',
    title: 'Cayuga Lake Sensor Network',
    body: 'Air, water and soil sensors across 13 sites ringing the lake — a living dataset for a region with almost no dense environmental monitoring.',
  },
  {
    photo: '[ tethersonde launch ]',
    tag: 'Air',
    tagColor: '#6cc4e0',
    title: 'Atmospheric Tethersonde',
    body: 'An affordable, portable profiler of the lowest 500 ft of atmosphere — built for high-resolution observations of boundary-layer and lake-effect weather.',
  },
  {
    photo: '[ HAB satellite map ]',
    tag: 'Water · Data',
    tagColor: '#4bb3a6',
    title: 'Algal Bloom Remote Sensing',
    body: 'Satellite-derived maps of harmful algal blooms in Cayuga Lake, turning raw Sentinel-2 imagery into clear pictures of where the water is going wrong.',
  },
];

const IMPACT_STATS: ImpactStat[] = [
  { value: '6', label: 'years designing, building & deploying' },
  { value: '5', label: 'subteams: Air · Rock · Water · Data · Tech' },
  { value: '22', label: 'sensors deployed around Cayuga Lake' },
  { value: '13', label: 'monitoring sites across the region' },
];

const PARTNERS = [
  'Cornell College of Engineering',
  'Dept. of Earth & Atmospheric Sciences',
  'Emergent Climate Risk Lab',
  'Cornell Project Team Program',
];

export default function App() {
  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'clip', background: '#080b0f' }}>
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 42px', background: 'linear-gradient(180deg,rgba(8,11,15,0.85),rgba(8,11,15,0))' }}>
        <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#e6ecf0' }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: '#5bb98a', boxShadow: '0 0 14px rgba(91,185,138,0.7)', display: 'inline-block' }} />
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em' }}>CU GeoData</span>
        </a>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 30, fontSize: 14.5 }}>
          <a href="#projects" style={{ color: '#a9bcc6' }}>Projects</a>
          <a href="#impact" style={{ color: '#a9bcc6' }}>Impact</a>
          <a href="#partners" style={{ color: '#a9bcc6' }}>Partners</a>
          <a href="#join" style={{ display: 'inline-block', padding: '9px 20px', borderRadius: 999, background: '#5bb98a', color: '#08130c', fontWeight: 600 }}>Join the team</a>
        </nav>
      </header>

      <span id="top" />

      <Globe />

      {/* PROJECTS */}
      <section id="projects" style={{ position: 'relative', zIndex: 2, background: '#080b0f', padding: '120px clamp(24px,5vw,72px)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5bb98a' }}>Featured work</div>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 'clamp(34px,4.5vw,58px)', letterSpacing: '-0.02em', lineHeight: 1.02, margin: '18px 0 0', maxWidth: '16ch' }}>Instruments built by students, deployed in the field.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 26, marginTop: 56 }}>
            {PROJECTS.map((proj) => (
              <article key={proj.title} style={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ aspectRatio: '16/10', background: 'repeating-linear-gradient(135deg,#12181e,#12181e 11px,#0e141a 11px,#0e141a 22px)', display: 'flex', alignItems: 'flex-end', padding: 14 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#5f7078' }}>{proj.photo}</span>
                </div>
                <div style={{ padding: 24 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: proj.tagColor }}>{proj.tag}</div>
                  <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 22, margin: '12px 0 0', letterSpacing: '-0.01em' }}>{proj.title}</h3>
                  <p style={{ fontSize: 15, lineHeight: 1.6, color: '#a9bcc6', margin: '12px 0 0' }}>{proj.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* IMPACT */}
      <section id="impact" style={{ position: 'relative', zIndex: 2, background: '#0a0f14', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '96px clamp(24px,5vw,72px)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 40, textAlign: 'left' }}>
            {IMPACT_STATS.map((stat) => (
              <div key={stat.label}>
                <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 'clamp(46px,5.5vw,68px)', lineHeight: 1, color: '#5bb98a', letterSpacing: '-0.03em' }}>{stat.value}</div>
                <div style={{ fontSize: 15, color: '#a9bcc6', marginTop: 10 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PARTNERS */}
      <section id="partners" style={{ position: 'relative', zIndex: 2, background: '#080b0f', padding: '96px clamp(24px,5vw,72px)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7c909b' }}>Supported by</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 18, marginTop: 34 }}>
            {PARTNERS.map((partner) => (
              <div key={partner} style={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, padding: 26, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 500, fontSize: 15, color: '#c4d1d7' }}>{partner}</div>
            ))}
          </div>
        </div>
      </section>

      {/* JOIN */}
      <section id="join" style={{ position: 'relative', zIndex: 2, background: 'linear-gradient(180deg,#0a0f14,#080b0f)', padding: '130px clamp(24px,5vw,72px)', textAlign: 'center' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5bb98a' }}>Recruitment open</div>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 'clamp(40px,6vw,76px)', letterSpacing: '-0.03em', lineHeight: 1, margin: '20px 0 0' }}>Build the instruments<br />a changing planet needs.</h2>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: '#a9bcc6', maxWidth: 560, margin: '26px auto 0' }}>GeoData welcomes students of every major — from CS and MechE to earth science and design. If you want to build hardware that ends up outdoors collecting real data, there's a subteam for you.</p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginTop: 38 }}>
            <a href="#top" style={{ display: 'inline-block', padding: '15px 32px', borderRadius: 999, background: '#5bb98a', color: '#08130c', fontWeight: 600, fontSize: 16 }}>Apply to join</a>
            <a href="#projects" style={{ display: 'inline-block', padding: '15px 32px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.18)', color: '#e6ecf0', fontWeight: 500, fontSize: 16 }}>Explore our work</a>
          </div>
        </div>
      </section>

      <footer style={{ position: 'relative', zIndex: 2, background: '#080b0f', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '44px clamp(24px,5vw,72px)', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: '#5bb98a', display: 'inline-block' }} />
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600 }}>CU GeoData</span>
          <span style={{ color: '#5f7078', fontSize: 14 }}>· Cornell University · Ithaca, NY</span>
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 14 }}>
          <a href="#projects" style={{ color: '#a9bcc6' }}>Projects</a>
          <a href="#join" style={{ color: '#a9bcc6' }}>Join</a>
          <a href="#top" style={{ color: '#a9bcc6' }}>Contact</a>
        </div>
      </footer>
    </div>
  );
}
