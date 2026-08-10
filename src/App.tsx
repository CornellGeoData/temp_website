import { useEffect, useState } from 'react';
import Globe from './Globe';
import membersData from './members.json';

interface Member {
  name: string;
  subteam: string; // which grid section the card appears in
  badge?: string; // subteam whose corner badge to show (for Team Leads); defaults to subteam
  photo: string; // path under /public, e.g. '/members/jane-doe.jpg' — empty string shows a placeholder
  bio: string;
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
    tagColor: '#914724',
    title: 'Cayuga Lake Sensor Network',
    body: 'Air, water and soil sensors across 13 sites ringing the lake — a living dataset for a region with almost no dense environmental monitoring.',
  },
  {
    tag: 'Air',
    tagColor: '#6d9dcd',
    title: 'Atmospheric Tethersonde',
    body: 'An affordable, portable profiler of the lowest 500 ft of atmosphere — built for high-resolution observations of boundary-layer and lake-effect weather.',
  },
  {
    tag: 'Water · Data',
    tagColor: '#094295',
    title: 'Algal Bloom Remote Sensing',
    body: 'Satellite-derived maps of harmful algal blooms in Cayuga Lake, turning raw Sentinel-2 imagery into clear pictures of where the water is going wrong.',
  },
  {
    tag: 'Rock',
    tagColor: '#914724',
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
  'Team Leads': '#4fae7d',
  Air: '#6d9dcd',
  Water: '#094295',
  Rock: '#914724',
  Data: '#5d177f',
  Tech: '#8f0c3a',
  Business: '#dcbe32',
};

// corner badges, sourced from assets/ — one per subteam
const SUBTEAM_BADGES: Record<string, string> = {
  Air: '/badges/air.png',
  Water: '/badges/water.png',
  Rock: '/badges/rock.png',
  Data: '/badges/data.png',
  Tech: '/badges/tech.png',
  Business: '/badges/business.png',
};

// template posts — replace with real entries
const POSTS = [
  { date: '2026-08-01', tag: 'Field work', title: 'Post title goes here', excerpt: 'One or two sentences summarizing the post. Replace this with a short excerpt of the entry.' },
  { date: '2026-07-01', tag: 'Build log', title: 'Post title goes here', excerpt: 'One or two sentences summarizing the post. Replace this with a short excerpt of the entry.' },
  { date: '2026-06-01', tag: 'Team news', title: 'Post title goes here', excerpt: 'One or two sentences summarizing the post. Replace this with a short excerpt of the entry.' },
];

// group headers follow this array's order — Team Leads first
const teamLabel = (s: string): string => (s === 'Team Leads' ? s : `${s} Team`);

// members live in src/members.json — mass-edit there. Photos go in
// public/members/ and each entry's "photo" is its path, e.g. "/members/jane.jpg".
const MEMBERS: Member[] = membersData;

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const [route, setRoute] = useState(window.location.hash);
  const onBlogPage = route === '#/blog';
  // the globe scroll sequence is 740vh tall; keep the header glass-clear until
  // the page content starts so the dark bar never shades the globe
  const [pastGlobe, setPastGlobe] = useState(false);
  useEffect(() => {
    const onWinScroll = () => setPastGlobe(window.scrollY > window.innerHeight * 6.3);
    onWinScroll();
    window.addEventListener('scroll', onWinScroll, { passive: true });
    return () => window.removeEventListener('scroll', onWinScroll);
  }, []);
  const headerSolid = onBlogPage || menuOpen || pastGlobe;
  const [openMember, setOpenMember] = useState<Member | null>(null);

  useEffect(() => {
    if (!openMember) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMember(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openMember]);

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
      <header className="site-header" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 42px', background: headerSolid ? 'rgba(8,11,15,0.85)' : 'transparent', transition: 'background 0.35s', fontFamily: "'Resiple',sans-serif" }}>
        <a href="#top" className="logo-link" style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#e6ecf0', flexShrink: 0 }}>
          <img src="/logo.png" alt="" style={{ width: 78, height: 78, flexShrink: 0 }} />
          <span className="logo-text" style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>CU GeoData</span>
        </a>
        <nav className="site-nav" style={{ display: 'flex', alignItems: 'center', gap: 30, fontSize: 17.5, flexShrink: 0 }}>
          <div className="site-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
            <a href="#projects" style={{ color: '#a9bcc6' }}>Projects</a>
            <a href="#members" style={{ color: '#a9bcc6' }}>Members</a>
            {/* blog hidden for now — restore this link to bring it back
            <a href="#/blog" style={{ color: '#a9bcc6' }}>Blog</a> */}
          </div>
          <a href="#join" className="nav-join-btn" style={{ display: 'inline-block', padding: '9px 20px', borderRadius: 999, background: '#086727', color: '#eaf2ee', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, fontFamily: "'Resiple',sans-serif" }}>Join the team</a>
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
            {/* blog hidden for now
            <a href="#/blog" onClick={closeMenu} style={{ color: '#a9bcc6', padding: '14px 0' }}>Blog</a> */}
          </div>
        )}
      </header>

      <span id="top" />

      {onBlogPage ? (
      <section style={{ position: 'relative', zIndex: 2, background: '#080b0f', padding: '150px clamp(24px,5vw,72px) 110px', minHeight: '100vh' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#086727' }}>Field notes</div>
          <h2 style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 700, fontSize: 'clamp(36px,4.8vw,60px)', letterSpacing: '-0.02em', lineHeight: 1.02, margin: '18px 0 0' }}>Blog</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 64, marginTop: 64 }}>
            {POSTS.map((post, i) => (
              <article key={i}>
                <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7c909b' }}>{post.date} · {post.tag}</div>
                <h3 style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 600, fontSize: 28, margin: '12px 0 0', letterSpacing: '-0.01em' }}>{post.title}</h3>
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
          <div style={{ padding: 14, border: '2px solid #086727', boxShadow: '10px 10px 0 rgba(8,103,39,0.35)' }}>
            <img src="/team.jpg" alt="The GeoData team on the stairs of Upson Hall" style={{ display: 'block', width: '100%', height: 'auto' }} />
          </div>
          <figcaption style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 700, fontSize: 24, color: '#e6ecf0', marginTop: 20, textAlign: 'center' }}>The GeoData team</figcaption>
        </figure>
      </section>

      {/* PROJECTS */}
      <section id="projects" style={{ position: 'relative', zIndex: 2, background: '#080b0f', padding: '120px clamp(24px,5vw,72px)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#086727' }}>Featured work</div>
          <h2 style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 700, fontSize: 'clamp(36px,4.8vw,60px)', letterSpacing: '-0.02em', lineHeight: 1.02, margin: '18px 0 0', maxWidth: '16ch' }}>Instruments built by students, deployed in the field</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px,100%),1fr))', gap: 26, marginTop: 56 }}>
            {PROJECTS.map((proj, i) => (
              <article key={proj.title} style={{ marginTop: i % 2 ? 44 : 0 }}>
                <div style={{ aspectRatio: '16/10', background: '#12181e' }} />
                <div style={{ padding: '20px 0 0' }}>
                  <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: proj.tagColor }}>{proj.tag}</div>
                  <h3 style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 600, fontSize: 25, margin: '12px 0 0', letterSpacing: '-0.01em' }}>{proj.title}</h3>
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
              <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#086727' }}>The team</div>
              <h2 style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 700, fontSize: 'clamp(36px,4.8vw,60px)', letterSpacing: '-0.02em', lineHeight: 1.02, margin: '18px 0 0' }}>Members</h2>
            </div>
            <div style={{ padding: '26px 36px', display: 'flex', gap: 48 }}>
              <div>
                <div style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 700, fontSize: 46, lineHeight: 1, color: '#086727' }}>6</div>
                <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a9bcc6', marginTop: 10 }}>Subteams</div>
              </div>
              <div>
                <div style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 700, fontSize: 46, lineHeight: 1, color: '#086727' }}>40</div>
                <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a9bcc6', marginTop: 10 }}>Members</div>
              </div>
            </div>
          </div>
          {[...new Set(MEMBERS.map((m) => m.subteam))].map((subteam) => (
            <div key={subteam} style={{ marginTop: 64 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Resiple',sans-serif", fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', color: SUBTEAM_COLORS[subteam] ?? '#7c909b' }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: SUBTEAM_COLORS[subteam] ?? '#7c909b', display: 'inline-block' }} />
                {teamLabel(subteam)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(190px,100%),1fr))', gap: '36px 28px', marginTop: 26 }}>
                {MEMBERS.filter((m) => m.subteam === subteam).map((m, i) => (
                  <div key={i}>
                    <button
                      type="button"
                      onClick={() => setOpenMember(m)}
                      aria-label={`About ${m.name}`}
                      style={{ position: 'relative', display: 'block', width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                    >
                      {m.photo ? (
                        <img src={m.photo} alt={m.name} style={{ display: 'block', width: '100%', aspectRatio: '1/1', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ aspectRatio: '1/1', background: '#12181e' }} />
                      )}
                      {SUBTEAM_BADGES[m.badge ?? subteam] && (
                        <img src={SUBTEAM_BADGES[m.badge ?? subteam]} alt={`${m.badge ?? subteam} team badge`} style={{ position: 'absolute', top: 8, right: 8, width: 36, height: 36 }} />
                      )}
                    </button>
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
          <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#086727' }}>Recruitment open</div>
          <h2 style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 700, fontSize: 'clamp(42px,6.2vw,80px)', letterSpacing: '-0.03em', lineHeight: 1, margin: '20px 0 0' }}>Build the instruments<br />a changing planet needs</h2>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: '#a9bcc6', maxWidth: 560, margin: '26px 0 0' }}>GeoData welcomes students of every major — from CS and MechE to earth science and design. If you want to build hardware that ends up outdoors collecting real data, there's a subteam for you.</p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 38 }}>
            <a href="#top" style={{ display: 'inline-block', padding: '15px 32px', borderRadius: 999, background: '#086727', color: '#eaf2ee', fontWeight: 700, fontSize: 18.5, fontFamily: "'Resiple',sans-serif" }}>Apply to join</a>
            <a href="#projects" style={{ display: 'inline-block', padding: '15px 32px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.18)', color: '#e6ecf0', fontWeight: 700, fontSize: 18.5, fontFamily: "'Resiple',sans-serif" }}>Explore our work</a>
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
              <span style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 600, fontSize: 20 }}>CU GeoData</span>
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

      {/* MEMBER BIO MODAL */}
      {openMember && (
        <div
          onClick={() => setOpenMember(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`About ${openMember.name}`}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(4,6,8,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#0c1218', maxWidth: 440, width: '100%', padding: 28, border: '2px solid #086727', boxShadow: '10px 10px 0 rgba(8,103,39,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              {openMember.photo ? (
                <img src={openMember.photo} alt={openMember.name} style={{ width: 92, height: 92, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 92, height: 92, background: '#12181e', flexShrink: 0 }} />
              )}
              <div>
                <div style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 700, fontSize: 22 }}>{openMember.name}</div>
                <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: SUBTEAM_COLORS[openMember.subteam] ?? '#7c909b', marginTop: 6 }}>{teamLabel(openMember.subteam)}</div>
              </div>
            </div>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: '#b6c6ce', margin: '18px 0 0' }}>{openMember.bio}</p>
            <button
              type="button"
              onClick={() => setOpenMember(null)}
              style={{ marginTop: 22, padding: '10px 22px', borderRadius: 999, border: 'none', background: '#086727', color: '#eaf2ee', fontWeight: 700, fontSize: 15, fontFamily: "'Resiple',sans-serif", cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
