import { useEffect, useState } from 'react';
import Globe from './Globe';

interface Member {
  name: string;
  subteam: string;
  photo: string; // path under /public, e.g. '/members/jane-doe.jpg' — empty string shows a placeholder
}

interface Project {
  tag: string;
  tagColor: string;
  title: string;
  body: string;
}

const PROJECTS: Project[] = [
  {
    tag: 'Rock · Water · Air',
    tagColor: '#c98b5a',
    title: 'Cayuga Lake Sensor Network',
    body: 'Air, water and soil sensors across 13 sites ringing the lake — a living dataset for a region with almost no dense environmental monitoring.',
  },
  {
    tag: 'Air',
    tagColor: '#7f9fc9',
    title: 'Atmospheric Tethersonde',
    body: 'An affordable, portable profiler of the lowest 500 ft of atmosphere — built for high-resolution observations of boundary-layer and lake-effect weather.',
  },
  {
    tag: 'Water · Data',
    tagColor: '#4bb3a6',
    title: 'Algal Bloom Remote Sensing',
    body: 'Satellite-derived maps of harmful algal blooms in Cayuga Lake, turning raw Sentinel-2 imagery into clear pictures of where the water is going wrong.',
  },
  {
    tag: 'Rock',
    tagColor: '#c98b5a',
    title: 'NISAR Ground-Truthing',
    body: "Five soil-moisture nodes at the Game Farm site check NASA's NISAR satellite against what's actually in the dirt.",
  },
];

const PARTNERS = [
  'Cornell College of Engineering',
  'Dept. of Earth & Atmospheric Sciences',
  'Emergent Climate Risk Lab',
  'Cornell Project Team Program',
];

const SUBTEAM_COLORS: Record<string, string> = {
  Air: '#7f9fc9',
  Water: '#4bb3a6',
  Rock: '#c98b5a',
  Data: '#c47b8a',
  Tech: '#e0b45a',
  Business: '#a3b18a',
};

// corner badge per subteam — add the rest to public/badges/ as they're made
const SUBTEAM_BADGES: Record<string, string> = {
  Air: '/badges/air.png',
  Rock: '/badges/rock.png',
  Tech: '/badges/tech.png',
};

// template posts — replace with real entries
const POSTS = [
  { date: '2026-08-01', tag: 'Field work', title: 'Post title goes here', excerpt: 'One or two sentences summarizing the post. Replace this with a short excerpt of the entry.' },
  { date: '2026-07-01', tag: 'Build log', title: 'Post title goes here', excerpt: 'One or two sentences summarizing the post. Replace this with a short excerpt of the entry.' },
  { date: '2026-06-01', tag: 'Team news', title: 'Post title goes here', excerpt: 'One or two sentences summarizing the post. Replace this with a short excerpt of the entry.' },
];

// template entries — replace name/subteam, drop photos in public/members/ and set the path
const MEMBERS: Member[] = [
  { name: 'Member Name', subteam: 'Air', photo: '' },
  { name: 'Member Name', subteam: 'Air', photo: '' },
  { name: 'Member Name', subteam: 'Water', photo: '' },
  { name: 'Member Name', subteam: 'Water', photo: '' },
  { name: 'Member Name', subteam: 'Rock', photo: '' },
  { name: 'Member Name', subteam: 'Rock', photo: '' },
  { name: 'Member Name', subteam: 'Data', photo: '' },
  { name: 'Member Name', subteam: 'Data', photo: '' },
  { name: 'Member Name', subteam: 'Tech', photo: '' },
  { name: 'Member Name', subteam: 'Tech', photo: '' },
  { name: 'Member Name', subteam: 'Business', photo: '' },
  { name: 'Member Name', subteam: 'Business', photo: '' },
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const [route, setRoute] = useState(window.location.hash);
  const onBlogPage = route === '#/blog';

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (onBlogPage) {
      window.scrollTo(0, 0);
      return;
    }
    // returning from the blog page, the anchor target doesn't exist until
    // after this render — scroll to it manually
    const el = document.getElementById(route.slice(1));
    if (el) el.scrollIntoView();
  }, [route, onBlogPage]);

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'clip', background: '#080b0f' }}>
      <header className="site-header" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 42px', background: 'rgba(8,11,15,0.85)', fontFamily: "'Resiple',sans-serif" }}>
        <a href="#top" className="logo-link" style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#e6ecf0', flexShrink: 0 }}>
          <img src="/logo.png" alt="" style={{ width: 54, height: 54, flexShrink: 0 }} />
          <span className="logo-text" style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>CU GeoData</span>
        </a>
        <nav className="site-nav" style={{ display: 'flex', alignItems: 'center', gap: 30, fontSize: 17.5, flexShrink: 0 }}>
          <div className="site-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
            <a href="#projects" style={{ color: '#a9bcc6' }}>Projects</a>
            <a href="#members" style={{ color: '#a9bcc6' }}>Members</a>
            <a href="#/blog" style={{ color: '#a9bcc6' }}>Blog</a>
            <a href="#partners" style={{ color: '#a9bcc6' }}>Partners</a>
          </div>
          <a href="#join" className="nav-join-btn" style={{ display: 'inline-block', padding: '9px 20px', borderRadius: 999, background: '#5bb98a', color: '#08130c', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, fontFamily: "'Resiple',sans-serif" }}>Join the team</a>
          <button
            type="button"
            className="menu-toggle"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            style={{ display: 'none', flexDirection: 'column', justifyContent: 'center', gap: 5, width: 30, height: 30, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
          >
            <span style={{ display: 'block', width: '100%', height: 2, background: '#e6ecf0', borderRadius: 2, transition: 'transform .2s ease, opacity .2s ease', transform: menuOpen ? 'translateY(7px) rotate(45deg)' : 'none' }} />
            <span style={{ display: 'block', width: '100%', height: 2, background: '#e6ecf0', borderRadius: 2, transition: 'opacity .2s ease', opacity: menuOpen ? 0 : 1 }} />
            <span style={{ display: 'block', width: '100%', height: 2, background: '#e6ecf0', borderRadius: 2, transition: 'transform .2s ease', transform: menuOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
          </button>
        </nav>

        {menuOpen && (
          <div className="mobile-menu" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#0a0f14', display: 'flex', flexDirection: 'column', padding: '4px 20px 16px' }}>
            <a href="#projects" onClick={closeMenu} style={{ color: '#a9bcc6', padding: '14px 0' }}>Projects</a>
            <a href="#members" onClick={closeMenu} style={{ color: '#a9bcc6', padding: '14px 0' }}>Members</a>
            <a href="#/blog" onClick={closeMenu} style={{ color: '#a9bcc6', padding: '14px 0' }}>Blog</a>
            <a href="#partners" onClick={closeMenu} style={{ color: '#a9bcc6', padding: '14px 0' }}>Partners</a>
          </div>
        )}
      </header>

      <span id="top" />

      {onBlogPage ? (
      <section style={{ position: 'relative', zIndex: 2, background: '#080b0f', padding: '150px clamp(24px,5vw,72px) 110px', minHeight: '100vh' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5bb98a' }}>Field notes</div>
          <h2 style={{ fontFamily: "'Clingy',sans-serif", fontWeight: 700, fontSize: 'clamp(36px,4.8vw,60px)', letterSpacing: '-0.02em', lineHeight: 1.02, margin: '18px 0 0' }}>Blog</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 64, marginTop: 64 }}>
            {POSTS.map((post, i) => (
              <article key={i}>
                <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7c909b' }}>{post.date} · {post.tag}</div>
                <h3 style={{ fontFamily: "'Clingy',sans-serif", fontWeight: 600, fontSize: 28, margin: '12px 0 0', letterSpacing: '-0.01em' }}>{post.title}</h3>
                <p style={{ fontSize: 16, lineHeight: 1.6, color: '#a9bcc6', margin: '12px 0 0', maxWidth: 640 }}>{post.excerpt}</p>
                <a href="#/blog" style={{ display: 'inline-block', marginTop: 14, fontSize: 14.5 }}>Read more</a>
              </article>
            ))}
          </div>
        </div>
      </section>
      ) : (
      <>
      <Globe />

      {/* TEAM PHOTO */}
      <section style={{ position: 'relative', zIndex: 2, background: '#080b0f', padding: '110px clamp(24px,5vw,72px) 0' }}>
        <figure style={{ margin: '0 auto', maxWidth: 1060 }}>
          <div style={{ padding: 14, border: '1px solid rgba(255,255,255,0.18)' }}>
            <img src="/team.jpg" alt="The GeoData team on the stairs of Upson Hall" style={{ display: 'block', width: '100%', height: 'auto' }} />
          </div>
          <figcaption style={{ fontFamily: "'Resiple',sans-serif", fontSize: 12, letterSpacing: '0.1em', color: '#7c909b', marginTop: 12, textAlign: 'center' }}>The GeoData team</figcaption>
        </figure>
      </section>

      {/* PROJECTS */}
      <section id="projects" style={{ position: 'relative', zIndex: 2, background: '#080b0f', padding: '120px clamp(24px,5vw,72px)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5bb98a' }}>Featured work</div>
          <h2 style={{ fontFamily: "'Clingy',sans-serif", fontWeight: 700, fontSize: 'clamp(36px,4.8vw,60px)', letterSpacing: '-0.02em', lineHeight: 1.02, margin: '18px 0 0', maxWidth: '16ch' }}>Instruments built by students, deployed in the field.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px,100%),1fr))', gap: 26, marginTop: 56 }}>
            {PROJECTS.map((proj, i) => (
              <article key={proj.title} style={{ marginTop: i % 2 ? 44 : 0 }}>
                <div style={{ aspectRatio: '16/10', background: '#12181e' }} />
                <div style={{ padding: '20px 0 0' }}>
                  <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: proj.tagColor }}>{proj.tag}</div>
                  <h3 style={{ fontFamily: "'Clingy',sans-serif", fontWeight: 600, fontSize: 25, margin: '12px 0 0', letterSpacing: '-0.01em' }}>{proj.title}</h3>
                  <p style={{ fontSize: 15, lineHeight: 1.6, color: '#a9bcc6', margin: '12px 0 0' }}>{proj.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* MEMBERS */}
      <section id="members" style={{ position: 'relative', zIndex: 2, background: '#080b0f', padding: '96px clamp(24px,5vw,72px)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '28px 48px', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5bb98a' }}>The team</div>
              <h2 style={{ fontFamily: "'Clingy',sans-serif", fontWeight: 700, fontSize: 'clamp(36px,4.8vw,60px)', letterSpacing: '-0.02em', lineHeight: 1.02, margin: '18px 0 0' }}>Members</h2>
            </div>
            <div style={{ padding: '26px 36px', display: 'flex', gap: 48 }}>
              <div>
                <div style={{ fontFamily: "'Clingy',sans-serif", fontWeight: 700, fontSize: 46, lineHeight: 1, color: '#5bb98a' }}>6</div>
                <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a9bcc6', marginTop: 10 }}>Subteams</div>
              </div>
              <div>
                <div style={{ fontFamily: "'Clingy',sans-serif", fontWeight: 700, fontSize: 46, lineHeight: 1, color: '#5bb98a' }}>40</div>
                <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a9bcc6', marginTop: 10 }}>Members</div>
              </div>
            </div>
          </div>
          {[...new Set(MEMBERS.map((m) => m.subteam))].map((subteam) => (
            <div key={subteam} style={{ marginTop: 64 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Resiple',sans-serif", fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', color: SUBTEAM_COLORS[subteam] ?? '#7c909b' }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: SUBTEAM_COLORS[subteam] ?? '#7c909b', display: 'inline-block' }} />
                {subteam} Team
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(190px,100%),1fr))', gap: '36px 28px', marginTop: 26 }}>
                {MEMBERS.filter((m) => m.subteam === subteam).map((m, i) => (
                  <div key={i}>
                    <div style={{ position: 'relative' }}>
                      {m.photo ? (
                        <img src={m.photo} alt={m.name} style={{ display: 'block', width: '100%', aspectRatio: '1/1', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ aspectRatio: '1/1', background: '#12181e' }} />
                      )}
                      {SUBTEAM_BADGES[subteam] && (
                        <img src={SUBTEAM_BADGES[subteam]} alt={`${subteam} team badge`} style={{ position: 'absolute', top: 8, right: 8, width: 36, height: 36 }} />
                      )}
                    </div>
                    <div style={{ fontFamily: "'Resiple',sans-serif", fontWeight: 700, fontSize: 16.5, marginTop: 12 }}>{m.name}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* JOIN */}
      <section id="join" style={{ position: 'relative', zIndex: 2, background: '#080b0f', padding: '130px clamp(24px,5vw,72px)' }}>
        <div style={{ maxWidth: 820 }}>
          <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5bb98a' }}>Recruitment open</div>
          <h2 style={{ fontFamily: "'Clingy',sans-serif", fontWeight: 700, fontSize: 'clamp(42px,6.2vw,80px)', letterSpacing: '-0.03em', lineHeight: 1, margin: '20px 0 0' }}>Build the instruments<br />a changing planet needs.</h2>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: '#a9bcc6', maxWidth: 560, margin: '26px 0 0' }}>GeoData welcomes students of every major — from CS and MechE to earth science and design. If you want to build hardware that ends up outdoors collecting real data, there's a subteam for you.</p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 38 }}>
            <a href="#top" style={{ display: 'inline-block', padding: '15px 32px', borderRadius: 999, background: '#5bb98a', color: '#08130c', fontWeight: 600, fontSize: 18.5, fontFamily: "'Resiple',sans-serif" }}>Apply to join</a>
            <a href="#projects" style={{ display: 'inline-block', padding: '15px 32px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.18)', color: '#e6ecf0', fontWeight: 500, fontSize: 18.5, fontFamily: "'Resiple',sans-serif" }}>Explore our work</a>
          </div>
        </div>
      </section>

      </>
      )}

      {/* FOOTER — supported by + contact; template details, replace with real ones */}
      <footer id="partners" style={{ position: 'relative', zIndex: 2, background: '#080b0f', padding: '84px clamp(24px,5vw,72px) 36px' }}>
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '48px 72px', justifyContent: 'space-between' }}>
            <div style={{ flex: '1 1 220px' }}>
              <span style={{ fontFamily: "'Clingy',sans-serif", fontWeight: 600, fontSize: 20 }}>CU GeoData</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14, fontSize: 14, color: '#5f7078' }}>
                <span>Cornell University</span>
                <span>Ithaca, NY</span>
              </div>
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7c909b' }}>Supported by</div>
              <div style={{ display: 'grid', gridTemplateRows: 'repeat(2, auto)', gridAutoFlow: 'column', gridAutoColumns: 'max-content', gap: '8px 40px', marginTop: 14, fontSize: 14, color: '#a9bcc6' }}>
                {PARTNERS.map((partner) => (
                  <span key={partner}>{partner}</span>
                ))}
              </div>
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7c909b' }}>Contact</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14, fontSize: 14 }}>
                <a href="mailto:geodata@cornell.edu">geodata@cornell.edu</a>
                <span style={{ color: '#a9bcc6' }}>Upson Hall · Ithaca, NY 14853</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 30, display: 'flex', flexWrap: 'wrap', gap: '6px 20px', alignItems: 'center', fontSize: 10.5, color: '#5f7078' }}>
            <span>© {new Date().getFullYear()} CU GeoData. All rights reserved.</span>
            <a href="#" style={{ color: '#7c909b' }}>Privacy Policy</a>
            <a href="#" style={{ color: '#7c909b' }}>Terms of Use</a>
            <a href="https://accessibility.cornell.edu" style={{ color: '#7c909b' }}>Web Accessibility Assistance</a>
          </div>
          <div style={{ marginTop: 6, fontSize: 10.5, color: '#4d5b63', maxWidth: 720 }}>
            CU GeoData is a registered student organization of Cornell University. This website is maintained by its student members and does not represent the official views of Cornell University.
          </div>
        </div>
      </footer>
    </div>
  );
}
