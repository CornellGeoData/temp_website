import { useEffect, useState } from 'react';
import Globe from './Globe';
import membersData from './members.json';

interface Member {
  name: string;
  subteam: string; // which grid section the card appears in
  lead?: boolean; // team leads sit first in their subteam's grid
  role?: string; // org-wide role label (Leadership section), e.g. "Faculty Advisor"
  badge?: string; // subteam whose corner badge to show; defaults to subteam
  photo: string; // path under /public, e.g. '/members/jane-doe.jpg' — empty string shows a placeholder
  email: string;
  major: string;
}

interface Project {
  tag: string;
  tagColor: string;
  title: string;
  body: string;
  photo?: string; // path under /public; omitted shows a placeholder block
  photo2?: string; // second image, shown side by side on the full-width card
  photoPosition?: string; // object-position focal point within the crop frame
  photoAspect?: string; // card image aspect ratio; defaults to 16/10
}

const PROJECTS: Project[] = [
  {
    tag: 'Rock · Water · Air',
    tagColor: '#914724',
    title: 'Cayuga Lake Sensor Network',
    body: 'Air, water and soil sensors at 13 sites around the lake. The result is a growing dataset for a region that has almost no dense environmental monitoring.',
    photo: '/projects/sensors.jpg',
    photo2: '/projects/sensors-lake.jpg',
  },
  {
    tag: 'Air',
    tagColor: '#6d9dcd',
    title: 'Atmospheric Tethersonde',
    body: 'An affordable, portable profiler for the lowest 500 feet of the atmosphere. We built it to get high-resolution observations of boundary-layer and lake-effect weather.',
    photo: '/projects/tethersonde.jpg',
    photoAspect: '4/5',
    photoPosition: '57% 50%',
  },
  {
    tag: 'Rock',
    tagColor: '#914724',
    title: 'NISAR Ground-Truthing',
    body: "Five soil-moisture nodes at the Game Farm site check NASA's NISAR satellite against what's actually in the dirt.",
    photo: '/projects/nisar.jpg',
    photoAspect: '4/5',
    photoPosition: '50% 40%',
  },
  {
    tag: 'Tech · CUPI Partnership',
    tagColor: '#8f0c3a',
    title: 'LiDAR Hexapod',
    body: 'A six-legged robot that carries a LiDAR scanner into terrain wheels can\'t handle. We\'re building it with CUPI to map the ground in 3D.',
    photo: '/projects/hexapod.jpg',
  },
  {
    tag: 'Tech · Water',
    tagColor: '#8f0c3a',
    title: 'Drone Photogrammetry',
    body: 'We fly a DJI Mavic M3 in overlapping passes above the Finger Lakes, then stitch the aerial photos into 3D photogrammetric scans of shorelines and terrain.',
    photo: '/projects/drone.webp',
  },
];

const PARTNERS = [
  'Cornell College of Engineering',
  'Dept. of Earth & Atmospheric Sciences',
  'Emergent Climate Risk Lab',
  'Cornell Project Team Program',
];

const SUBTEAM_COLORS: Record<string, string> = {
  Leadership: '#4fae7d',
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

interface LegalPage {
  title: string;
  updated: string;
  sections: { h: string; body: string[] }[];
}

const LEGAL_PAGES: Record<string, LegalPage> = {
  '#/privacy': {
    title: 'Privacy Policy',
    updated: 'August 14, 2026',
    sections: [
      {
        h: 'Who we are',
        body: [
          'CU GeoData ("GeoData," "we," "us") is a registered student organization at Cornell University in Ithaca, New York. This policy describes how this website handles information about its visitors. This website is maintained by student members and is not operated by Cornell University.',
        ],
      },
      {
        h: 'Information you provide to us',
        body: [
          'This site does not have user accounts and does not ask you to submit forms. If you contact us by email (for example at geodata@cornell.edu), we receive your email address and whatever information you choose to include. We use that information only to respond to you and to conduct ordinary team business, such as recruitment.',
        ],
      },
      {
        h: 'Information collected automatically',
        body: [
          'This is a static website. We do not run analytics, advertising trackers, or social media pixels. Like most websites, the servers that host this site may automatically log standard technical information, such as your IP address, browser type, the pages you visit, and access times, for security and operational purposes. Those logs are controlled by our hosting provider and are subject to its privacy practices.',
        ],
      },
      {
        h: 'Cookies',
        body: [
          'This site does not set cookies and does not use local storage to track you.',
        ],
      },
      {
        h: 'Member photos and bios',
        body: [
          'Photos, names, and short bios of GeoData members appear on this site with the consent of those members. A member who wants their information updated or removed can email us and we will do so promptly.',
        ],
      },
      {
        h: 'How we share information',
        body: [
          'We do not sell, rent, or trade information about visitors. We may share information if required by law, to protect the safety or rights of others, or with Cornell University to the extent required for the administration of registered student organizations.',
        ],
      },
      {
        h: 'Third-party links',
        body: [
          'This site links to external websites, including Cornell University pages. Those sites have their own privacy policies, and we are not responsible for their practices.',
        ],
      },
      {
        h: "Children's privacy",
        body: [
          'This site is not directed at children under 13, and we do not knowingly collect personal information from them. If you believe a child has provided us personal information, contact us and we will delete it.',
        ],
      },
      {
        h: 'Data retention and security',
        body: [
          'We keep emails you send us only as long as needed for the purpose you sent them. We take reasonable measures to protect information in our control, but no method of transmission or storage is completely secure.',
        ],
      },
      {
        h: 'Your choices',
        body: [
          'You can browse this site without providing any personal information. To ask what information we hold about you, or to have it corrected or deleted, email geodata@cornell.edu.',
        ],
      },
      {
        h: 'Changes to this policy',
        body: [
          'If we change this policy, we will post the updated version on this page with a new "last updated" date.',
        ],
      },
      {
        h: 'Contact',
        body: [
          'Questions about this policy can be sent to geodata@cornell.edu.',
        ],
      },
    ],
  },
  '#/terms': {
    title: 'Terms of Use',
    updated: 'August 14, 2026',
    sections: [
      {
        h: 'Acceptance of these terms',
        body: [
          'By using this website you agree to these Terms of Use. If you do not agree, please do not use the site.',
        ],
      },
      {
        h: 'About this site',
        body: [
          'This website is maintained by the student members of CU GeoData, a registered student organization at Cornell University. It is provided for informational purposes. The content on this site does not represent the official views of Cornell University.',
        ],
      },
      {
        h: 'Intellectual property',
        body: [
          'Unless otherwise noted, the content of this site, including text, images, and graphics, belongs to CU GeoData or its members and may not be republished or used commercially without our permission. You may view and share links to this site for personal, non-commercial purposes.',
          'The Cornell name, logo, and related marks are the property of Cornell University, and nothing on this site grants any right to use them.',
        ],
      },
      {
        h: 'No professional advice; data disclaimer',
        body: [
          'Environmental measurements, maps, and datasets described or published by GeoData are produced by students for educational and research purposes. They are provided without any guarantee of accuracy, completeness, or timeliness, and must not be relied on for emergency response, navigation, health, or other safety-critical decisions.',
        ],
      },
      {
        h: 'Acceptable use',
        body: [
          'You agree not to use this site for any unlawful purpose, attempt to gain unauthorized access to any systems, interfere with the operation of the site, or misrepresent your affiliation with GeoData or Cornell University.',
        ],
      },
      {
        h: 'Disclaimer of warranties',
        body: [
          'This site and its content are provided "as is" and "as available," without warranties of any kind, express or implied, including fitness for a particular purpose and non-infringement.',
        ],
      },
      {
        h: 'Limitation of liability',
        body: [
          'To the fullest extent permitted by law, CU GeoData and its members will not be liable for any damages arising out of your use of, or inability to use, this site or its content.',
        ],
      },
      {
        h: 'External links',
        body: [
          'Links to third-party websites are provided for convenience. We do not endorse and are not responsible for their content or practices.',
        ],
      },
      {
        h: 'Changes',
        body: [
          'We may update this site and these terms at any time. Updated terms take effect when posted on this page.',
        ],
      },
      {
        h: 'Governing law',
        body: [
          'These terms are governed by the laws of the State of New York, without regard to conflict-of-law rules.',
        ],
      },
      {
        h: 'Contact',
        body: [
          'Questions about these terms can be sent to geodata@cornell.edu.',
        ],
      },
    ],
  },
};

// template posts — replace with real entries
const POSTS = [
  { date: '2026-08-01', tag: 'Field work', title: 'Post title goes here', excerpt: 'One or two sentences summarizing the post. Replace this with a short excerpt of the entry.' },
  { date: '2026-07-01', tag: 'Build log', title: 'Post title goes here', excerpt: 'One or two sentences summarizing the post. Replace this with a short excerpt of the entry.' },
  { date: '2026-06-01', tag: 'Team news', title: 'Post title goes here', excerpt: 'One or two sentences summarizing the post. Replace this with a short excerpt of the entry.' },
];

const teamLabel = (s: string): string => (s === 'Leadership' ? s : `${s} Team`);

// members live in src/members.json — mass-edit there. Photos go in
// public/members/ and each entry's "photo" is its path, e.g. "/members/jane.jpg".
// Clicking a photo flips the tile to a contact card (email + major).
const MEMBERS: Member[] = membersData;

const SUBTEAM_COUNT = new Set(MEMBERS.map((m) => m.subteam)).size - 1; // Leadership isn't a subteam
// unique by email (name as fallback) so people on two subteams aren't
// double-counted; the faculty advisor isn't a student member
const MEMBER_COUNT = new Set(MEMBERS.filter((m) => m.role !== 'Faculty Advisor').map((m) => m.email || m.name)).size;

export default function App() {
  const [route, setRoute] = useState(window.location.hash);
  const onBlogPage = route === '#/blog';
  const legalPage = LEGAL_PAGES[route];
  const onSubPage = onBlogPage || !!legalPage;
  // key of the member tile currently flipped to its contact card
  const [flippedMember, setFlippedMember] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail((cur) => (cur === email ? null : cur)), 1500);
  };

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (onSubPage) {
      window.scrollTo(0, 0);
      return;
    }
    // returning from a sub-page, the anchor target doesn't exist until
    // after this render — scroll to it manually
    const el = document.getElementById(route.slice(1));
    if (el) el.scrollIntoView();
  }, [route, onSubPage]);

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'clip', background: '#080b0f' }}>
      <header className="site-header" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 42px', background: 'rgba(8,11,15,0.85)', fontFamily: "'Resiple',sans-serif" }}>
        <a href="#top" className="logo-link" style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#e6ecf0', flexShrink: 0 }}>
          <img src="/logo.png" alt="" style={{ width: 78, height: 78, flexShrink: 0 }} />
          <span className="logo-text" style={{ fontFamily: "'Intan',sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>GeoData</span>
        </a>
        <nav className="site-nav" style={{ display: 'flex', alignItems: 'center', gap: 30, fontSize: 17.5, flexShrink: 0 }}>
          <div className="site-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
            <a href="#projects" style={{ color: '#a9bcc6' }}>Projects</a>
            <a href="#members" style={{ color: '#a9bcc6' }}>Members</a>
            {/* blog hidden for now — restore this link to bring it back
            <a href="#/blog" style={{ color: '#a9bcc6' }}>Blog</a> */}
          </div>
          <a href="#join" className="nav-join-btn" style={{ display: 'inline-block', padding: '9px 20px', borderRadius: 999, background: '#086727', color: '#eaf2ee', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, fontFamily: "'Resiple',sans-serif" }}>Join the team</a>
        </nav>
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
      ) : legalPage ? (
      <section style={{ position: 'relative', zIndex: 2, background: '#080b0f', padding: '150px clamp(24px,5vw,72px) 110px', minHeight: '100vh' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#086727' }}>CU GeoData</div>
          <h2 style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 700, fontSize: 'clamp(36px,4.8vw,60px)', letterSpacing: '-0.02em', lineHeight: 1.02, margin: '18px 0 0' }}>{legalPage.title}</h2>
          <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 13, color: '#7c909b', marginTop: 14 }}>Last updated: {legalPage.updated}</div>
          {legalPage.sections.map((s) => (
            <div key={s.h} style={{ marginTop: 44 }}>
              <h3 style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 600, fontSize: 22, letterSpacing: '-0.01em', margin: 0 }}>{s.h}</h3>
              {s.body.map((para, i) => (
                <p key={i} style={{ fontSize: 15.5, lineHeight: 1.65, color: '#a9bcc6', margin: '12px 0 0', maxWidth: 680 }}>{para}</p>
              ))}
            </div>
          ))}
        </div>
      </section>
      ) : (
      <>
      <Globe />

      {/* PROJECTS */}
      <section id="projects" style={{ position: 'relative', zIndex: 2, background: '#080b0f', padding: '120px clamp(24px,5vw,72px) 48px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#086727' }}>Featured work</div>
          <h2 style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 700, fontSize: 'clamp(36px,4.8vw,60px)', letterSpacing: '-0.02em', lineHeight: 1.02, margin: '18px 0 0', maxWidth: '16ch' }}>Instruments built by students, deployed in the field</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(420px,100%),1fr))', gap: 26, marginTop: 56 }}>
            {PROJECTS.map((proj) => (
              <article key={proj.title} style={{ gridColumn: proj.photo2 ? '1 / -1' : undefined }}>
                {proj.photo && proj.photo2 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(280px,100%),1fr))', gap: 26 }}>
                    <img loading="lazy" decoding="async" src={proj.photo} alt={proj.title} style={{ display: 'block', width: '100%', aspectRatio: '16/10', objectFit: 'cover', objectPosition: proj.photoPosition }} />
                    <img loading="lazy" decoding="async" src={proj.photo2} alt="" style={{ display: 'block', width: '100%', aspectRatio: '16/10', objectFit: 'cover' }} />
                  </div>
                ) : proj.photo ? (
                  <img loading="lazy" decoding="async" src={proj.photo} alt={proj.title} style={{ display: 'block', width: '100%', aspectRatio: proj.photoAspect ?? '16/10', objectFit: 'cover', objectPosition: proj.photoPosition }} />
                ) : (
                  <div style={{ aspectRatio: '16/10', background: '#12181e' }} />
                )}
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
      <section id="members" style={{ position: 'relative', zIndex: 2, background: '#080b0f', padding: '48px clamp(24px,5vw,72px) 96px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '28px 48px', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#086727' }}>The team</div>
              <h2 style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 700, fontSize: 'clamp(36px,4.8vw,60px)', letterSpacing: '-0.02em', lineHeight: 1.02, margin: '18px 0 0' }}>Members</h2>
            </div>
            <div style={{ padding: '26px 36px', display: 'flex', gap: 48 }}>
              <div>
                <div style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 700, fontSize: 46, lineHeight: 1, color: '#086727' }}>{SUBTEAM_COUNT}</div>
                <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a9bcc6', marginTop: 10 }}>Subteams</div>
              </div>
              <div>
                <div style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 700, fontSize: 46, lineHeight: 1, color: '#086727' }}>{MEMBER_COUNT}</div>
                <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a9bcc6', marginTop: 10 }}>Members</div>
              </div>
            </div>
          </div>
          {[...new Set(MEMBERS.map((m) => m.subteam))].map((subteam) => (
            <div key={subteam} style={{ marginTop: 64 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'Resiple',sans-serif", fontSize: 17, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: SUBTEAM_COLORS[subteam] ?? '#7c909b' }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: SUBTEAM_COLORS[subteam] ?? '#7c909b', display: 'inline-block' }} />
                {teamLabel(subteam)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(190px,100%),1fr))', gap: '36px 28px', marginTop: 26 }}>
                {MEMBERS.filter((m) => m.subteam === subteam).map((m, i) => {
                  const tileKey = `${subteam}:${i}`;
                  const color = SUBTEAM_COLORS[m.badge ?? subteam] ?? '#7c909b';
                  return (
                    <div key={i}>
                      {flippedMember === tileKey ? (
                        <div
                          onClick={() => setFlippedMember(null)}
                          style={{ position: 'relative', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}
                        >
                          {m.photo ? (
                            <img loading="lazy" decoding="async" src={m.photo} alt="" draggable={false} style={{ display: 'block', width: '100%', aspectRatio: '1/1', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ aspectRatio: '1/1', background: '#12181e' }} />
                          )}
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(12,18,24,0.82)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', border: `2px solid ${color}`, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
                          <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color }}>{m.role ?? (m.lead ? 'Subteam Lead' : 'Contact')}</div>
                          <div style={{ fontSize: 14.5, color: '#b6c6ce' }}>{m.major || 'Major TBD'}</div>
                          {m.email ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <a href={`mailto:${m.email}`} onClick={(e) => e.stopPropagation()} style={{ fontFamily: "'Parachutes Sans',sans-serif", textTransform: 'lowercase', fontSize: 13.5, wordBreak: 'break-all' }}>{m.email}</a>
                              <button
                                type="button"
                                aria-label={`Copy ${m.email}`}
                                onClick={(e) => { e.stopPropagation(); copyEmail(m.email); }}
                                style={{ fontFamily: "'Resiple',sans-serif", fontSize: 11, padding: '3px 10px', borderRadius: 999, border: `1px solid ${copiedEmail === m.email ? color : 'rgba(255,255,255,0.25)'}`, background: 'transparent', color: copiedEmail === m.email ? color : '#a9bcc6', cursor: 'pointer' }}
                              >
                                {copiedEmail === m.email ? 'Copied ✓' : 'Copy'}
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 13.5, color: '#5f7078' }}>Contact coming soon</span>
                          )}
                          </div>
                          {SUBTEAM_BADGES[m.badge ?? subteam] && (
                            <img loading="lazy" decoding="async" src={SUBTEAM_BADGES[m.badge ?? subteam]} alt={`${m.badge ?? subteam} team badge`} draggable={false} style={{ position: 'absolute', top: 8, right: 8, width: 36, height: 36, userSelect: 'none', WebkitUserSelect: 'none' }} />
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setFlippedMember(tileKey)}
                          aria-label={`Contact info for ${m.name}`}
                          style={{ position: 'relative', display: 'block', width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}
                        >
                          {m.photo ? (
                            <img loading="lazy" decoding="async" src={m.photo} alt={m.name} draggable={false} style={{ display: 'block', width: '100%', aspectRatio: '1/1', objectFit: 'cover', userSelect: 'none', WebkitUserSelect: 'none' }} />
                          ) : (
                            <div style={{ aspectRatio: '1/1', background: '#12181e' }} />
                          )}
                          {SUBTEAM_BADGES[m.badge ?? subteam] && (
                            <img loading="lazy" decoding="async" src={SUBTEAM_BADGES[m.badge ?? subteam]} alt={`${m.badge ?? subteam} team badge`} draggable={false} style={{ position: 'absolute', top: 8, right: 8, width: 36, height: 36, userSelect: 'none', WebkitUserSelect: 'none' }} />
                          )}
                        </button>
                      )}
                      <div style={{ fontFamily: "'Resiple',sans-serif", fontWeight: 700, fontSize: 16.5, marginTop: 12 }}>{m.name}</div>
                      {(m.role || m.lead) && (
                        <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color, marginTop: 4 }}>{m.role ?? 'Subteam Lead'}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* TEAM PHOTO */}
          <figure style={{ margin: '72px 0 0' }}>
            <div style={{ position: 'relative', padding: 14, border: '2px solid #086727', boxShadow: '10px 10px 0 rgba(8,103,39,0.35)' }}>
              <img loading="lazy" decoding="async" src="/team.jpg" alt="The GeoData team on the stairs of Upson Hall" style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '1400/932' }} />
              <figcaption style={{ position: 'absolute', bottom: 30, left: 30, background: '#086727', color: '#eaf2ee', fontFamily: "'Intan',sans-serif", fontSize: 'clamp(16px,2.2vw,24px)', letterSpacing: '0.04em', padding: '10px 22px', whiteSpace: 'nowrap' }}>Team Photo '25–'26</figcaption>
            </div>
          </figure>
        </div>
      </section>

      {/* JOIN */}
      <section id="join" style={{ position: 'relative', zIndex: 2, background: '#080b0f', padding: '130px clamp(24px,5vw,72px)' }}>
        <div style={{ maxWidth: 820 }}>
          <div style={{ fontFamily: "'Resiple',sans-serif", fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#086727' }}>Recruitment open</div>
          <h2 style={{ fontFamily: "'Manti Sans',sans-serif", fontWeight: 700, fontSize: 'clamp(42px,6.2vw,80px)', letterSpacing: '-0.03em', lineHeight: 1, margin: '20px 0 0' }}>Build the instruments<br />a changing planet needs</h2>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: '#a9bcc6', maxWidth: 560, margin: '26px 0 0' }}>GeoData welcomes students of every major, from CS and MechE to earth science and design. If you want to build hardware that ends up outdoors collecting real data, there's a subteam for you.</p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 38 }}>
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSfAKoT7-gJrNmK0nJYy7yEqsZI0egEgZqf0gG8794XujlYAVw/viewform" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '15px 32px', borderRadius: 999, background: '#086727', color: '#eaf2ee', fontWeight: 700, fontSize: 18.5, fontFamily: "'Resiple',sans-serif" }}>Apply to join</a>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ fontFamily: "'Resiple',sans-serif", fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7c909b' }}>Contact</span>
                <div style={{ display: 'flex', gap: 16 }}>
                  <a href="https://www.instagram.com/cugeodata/" target="_blank" rel="noopener noreferrer" aria-label="CU GeoData on Instagram" style={{ color: '#a9bcc6', display: 'inline-flex' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.757 6.162 6.162 6.162 3.405 0 6.162-2.757 6.162-6.162 0-3.402-2.757-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.645-1.44-1.44 0-.794.646-1.439 1.44-1.439.793 0 1.44.645 1.44 1.439z"/></svg>
                  </a>
                  <a href="https://www.linkedin.com/company/cu-geodata/" target="_blank" rel="noopener noreferrer" aria-label="CU GeoData on LinkedIn" style={{ color: '#a9bcc6', display: 'inline-flex' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/></svg>
                  </a>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14, fontSize: 14 }}>
                <a href="mailto:geodata@cornell.edu">geodata@cornell.edu</a>
                <span style={{ color: '#a9bcc6' }}>Upson Hall · Ithaca, NY 14853</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 30, display: 'flex', flexWrap: 'wrap', gap: '6px 20px', alignItems: 'center', fontSize: 10.5, color: '#5f7078' }}>
            <span>© {new Date().getFullYear()} CU GeoData. All rights reserved.</span>
            <a href="#/privacy" style={{ color: '#7c909b' }}>Privacy Policy</a>
            <a href="#/terms" style={{ color: '#7c909b' }}>Terms of Use</a>
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
