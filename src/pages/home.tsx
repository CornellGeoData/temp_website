import { Fragment, useEffect, useState } from 'react';
import Globe from '../components/Globe';
import { RESIPLE, MANTI, H2, BODY, PILL, PILL_PRIMARY, fmtTag } from '../styles/theme';
import { PROJECTS } from '../data/content';

// Cornell project-team recruiting dates, fall 2026, from the Engineering
// project teams recruiting calendar. `end` (Ithaca local time) is when the
// event stops being "upcoming" - past events grey out, the next one is green.
// rows: each inner array renders as one line of the path; a continuation
// arrow leads into every row after the first
// the 9/3 deadline is also hardcoded in the JOIN pills below and in the App.tsx recruiting banner - update all three each August.
const RECRUITING_TRACKS = [
  {
    track: 'Upperclassmen',
    rows: [[
      { name: 'Project Teams Fest', when: 'Sept 1, 4-6 p.m.\nDuffield Atrium', end: '2026-09-01T18:00:00-04:00', icon: 'fest' },
      { name: 'Coffee Chats', when: 'Aug 27 – Sept 4', end: '2026-09-04T23:59:59-04:00', icon: 'coffee' },
      { name: 'Applications Due', when: 'Sept 3, 11:59 p.m.', end: '2026-09-03T23:59:00-04:00', icon: 'apps' },
      { name: 'Interviews', when: 'Sept 4 – 15', end: '2026-09-15T23:59:59-04:00', icon: 'interview' },
      { name: 'First Offer Date', when: 'Sept 16', end: '2026-09-16T23:59:59-04:00', icon: 'offer' },
      { name: 'Add Deadline', when: 'Sept 25, 5 p.m.', end: '2026-09-25T17:00:00-04:00', icon: 'deadline' },
    ]],
  },
  {
    track: 'Freshmen + New Transfers',
    rows: [[
      { name: 'Project Teams Fest', when: 'Sept 1, 4-6 p.m.\nDuffield Atrium', end: '2026-09-01T18:00:00-04:00', icon: 'fest' },
      { name: 'Coffee Chats', when: 'Aug 27 – Oct 14', end: '2026-10-14T23:59:59-04:00', icon: 'coffee' },
      { name: 'Applications Due', when: 'Oct 15, 11:59 p.m.', end: '2026-10-15T23:59:00-04:00', icon: 'apps' },
      { name: 'Interviews', when: 'Oct 16 – Nov 1', end: '2026-11-01T23:59:59-05:00', icon: 'interview' },
      { name: 'First Offer Date', when: 'Nov 2', end: '2026-11-02T23:59:59-05:00', icon: 'offer' },
      { name: 'Onboarding Begins', when: 'Nov 4', end: '2026-11-04T23:59:59-05:00', icon: 'onboard' },
    ]],
  },
];

// hand-drawn-style line icons for the timeline stops, same stroke language as
// the tethersonde balloon in the join heading
function EventIcon({ kind, color }: { kind: string; color: string }) {
  const s = { fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" style={{ display: 'block', margin: '0 auto' }} aria-hidden="true">
      {kind === 'fest' && <g {...s}><path d="M6 21V3" /><path d="M6 4h12l-3.5 3.5L18 11H6" /></g>}
      {kind === 'coffee' && <g {...s}><path d="M5 10h11v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-7Z" /><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" /><path d="M8.5 7c0-1.4 1-1.6 1-3" /><path d="M12.5 7c0-1.4 1-1.6 1-3" /></g>}
      {kind === 'apps' && <g {...s}><path d="M7 3h7l4 4v14H7V3Z" /><path d="M14 3v4h4" /><path d="M10 12h5M10 16h5" /></g>}
      {kind === 'interview' && <g {...s}><path d="M4 5h16v11h-9l-4 4v-4H4V5Z" /><path d="M8 9.5h8M8 12.5h5" /></g>}
      {kind === 'offer' && <g {...s}><path d="M4 6h16v12H4V6Z" /><path d="m4 7 8 6 8-6" /></g>}
      {kind === 'deadline' && <g {...s}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2" /><path d="M9 2.5h6" /></g>}
      {kind === 'onboard' && <g {...s}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></g>}
    </svg>
  );
}

function RecruitingTimeline() {
  const now = Date.now();
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 720px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return (
    <section style={{ position: 'relative', zIndex: 2, background: '#0e141c', padding: '0 clamp(24px,5vw,72px) 130px' }}>
      {/* on phones the heading drops lower - clear of the Join section above,
          tighter against its own timeline below */}
      <h2 style={{ fontFamily: MANTI, fontWeight: 700, fontSize: 'clamp(42px,6.2vw,80px)', letterSpacing: '-0.03em', lineHeight: 1, margin: mobile ? '40px 0 0' : 0 }}>Recruiting <span style={{ color: '#4fae7d' }}>Timeline</span></h2>
      <div style={{ marginTop: mobile ? 20 : 44, padding: '0 4px 42px', overflowX: 'auto' }}>
      {RECRUITING_TRACKS.map(({ track, rows }) => {
        const next = rows.flat().find((e) => now <= new Date(e.end).getTime());
        return (
          <div key={track} style={{ marginTop: mobile ? 44 : 100 }}>
            <div style={{ fontFamily: RESIPLE, fontSize: 19, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#4fae7d' }}>{track}</div>
            {mobile ? (
              // single vertical column on phones instead of the snaking rows
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 24 }}>
                {rows.flat().map((e, i) => {
                  const past = now > new Date(e.end).getTime();
                  const active = e === next;
                  const arrowColor = past || active ? '#086727' : '#243140';
                  return (
                    <Fragment key={e.name}>
                      {i > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '10px 0' }}>
                          <div style={{ width: 2, height: 20, borderRadius: 2, background: arrowColor }} />
                          <svg width="14" height="11" viewBox="0 0 14 11" aria-hidden="true"><path d="m2 2 5 6 5-6" fill="none" stroke={arrowColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                      )}
                      <div style={{ textAlign: 'center', width: 200 }}>
                        <EventIcon kind={e.icon} color={past ? '#4d5b63' : active ? '#4fae7d' : '#a9bcc6'} />
                        <div style={{ fontFamily: RESIPLE, fontWeight: 700, fontSize: 13.5, marginTop: 10, color: past ? '#4d5b63' : active ? '#4fae7d' : '#e6ecf0' }}>{e.name}</div>
                        <div style={{ fontFamily: RESIPLE, fontSize: 12, color: past ? '#4d5b63' : '#a9bcc6', marginTop: 4, whiteSpace: 'pre-line' }}>
                          {/* highlighter on the hard application deadline DATE; each track's
                              swipe tilts its own way, like two different hands */}
                          {e.icon === 'apps' && !past ? (
                            <span style={{ display: 'inline-block', background: '#4fae7d', color: '#0e141c', fontWeight: 700, padding: '2px 10px 3px', borderRadius: '0.8em 0.3em 0.9em 0.4em / 0.5em 0.9em 0.3em 0.8em', transform: `rotate(${track === 'Upperclassmen' ? -1.5 : 1.8}deg)` }}>{e.when}</span>
                          ) : e.when}
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            ) : (
            <>
            {/* ox path: even rows run left-to-right, odd rows run right-to-left,
                joined by a curve down the right edge */}
            {rows.map((events, r) => {
              const reversed = r % 2 === 1;
              const first = events[0];
              const curveColor = now > new Date(first.end).getTime() || first === next ? '#086727' : '#243140';
              return (
              <Fragment key={r}>
                {r > 0 && (
                  // the ox-turn: continues right off the row above, arcs down,
                  // and points left into the first stop of the row below
                  <svg width="150" height="60" viewBox="0 0 150 60" style={{ display: 'block', margin: '6px 0 0 auto' }} aria-hidden="true">
                    <path d="M85 8h25a22 22 0 0 1 0 44H95" fill="none" stroke={curveColor} strokeWidth="2" />
                    <path d="m103 47-8 5 8 5" fill="none" stroke={curveColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              <div style={{ display: 'flex', flexDirection: reversed ? 'row-reverse' : 'row', alignItems: 'flex-start', marginTop: r === 0 ? 24 : 4 }}>
                {events.map((e, i) => {
                  const past = now > new Date(e.end).getTime();
                  const active = e === next;
                  const arrowColor = past || active ? '#086727' : '#243140';
                  return (
                    <Fragment key={e.name}>
                      {i > 0 && (() => {
                        // "you are here": now falls inside this gap
                        const prevEnd = new Date(events[i - 1].end).getTime();
                        const thisEnd = new Date(e.end).getTime();
                        const frac = now > prevEnd && now <= thisEnd ? (now - prevEnd) / (thisEnd - prevEnd) : null;
                        return (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', margin: '7px 14px 0', minWidth: 24, height: 14, position: 'relative' }}>
                          {reversed && <svg width="11" height="14" viewBox="0 0 11 14" style={{ flexShrink: 0 }} aria-hidden="true"><path d="M9 2 3 7l6 5" fill="none" stroke={arrowColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                          <div style={{ flex: 1, height: 2, borderRadius: 2, background: arrowColor }} />
                          {!reversed && <svg width="11" height="14" viewBox="0 0 11 14" style={{ flexShrink: 0 }} aria-hidden="true"><path d="m2 2 6 5-6 5" fill="none" stroke={arrowColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                          {frac != null && (
                            <div style={{ position: 'absolute', left: `${(reversed ? 1 - frac : frac) * 100}%`, top: -18, transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                              <div style={{ fontFamily: RESIPLE, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: '#4fae7d', whiteSpace: 'nowrap' }}>TODAY</div>
                              <div style={{ width: 2, height: 9, background: '#4fae7d', margin: '1px auto 0' }} />
                            </div>
                          )}
                        </div>
                        );
                      })()}
                      {/* fixed width so the two tracks' stops line up in columns */}
                      <div style={{ textAlign: 'center', width: 140, flexShrink: 0 }}>
                        <EventIcon kind={e.icon} color={past ? '#4d5b63' : active ? '#4fae7d' : '#a9bcc6'} />
                        <div style={{ fontFamily: RESIPLE, fontWeight: 700, fontSize: 13.5, marginTop: 10, color: past ? '#4d5b63' : active ? '#4fae7d' : '#e6ecf0' }}>{e.name}</div>
                        <div style={{ fontFamily: RESIPLE, fontSize: 12, color: past ? '#4d5b63' : '#a9bcc6', marginTop: 4, whiteSpace: 'pre-line' }}>
                          {/* highlighter on the hard application deadline DATE; each track's
                              swipe tilts its own way, like two different hands */}
                          {e.icon === 'apps' && !past ? (
                            <span style={{ display: 'inline-block', background: '#4fae7d', color: '#0e141c', fontWeight: 700, padding: '2px 10px 3px', borderRadius: '0.8em 0.3em 0.9em 0.4em / 0.5em 0.9em 0.3em 0.8em', transform: `rotate(${track === 'Upperclassmen' ? -1.5 : 1.8}deg)` }}>{e.when}</span>
                          ) : e.when}
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
              </Fragment>
              );
            })}
            </>
            )}
          </div>
        );
      })}
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <>
    <Globe />

    {/* PROJECTS */}
    <section id="projects" style={{ position: 'relative', zIndex: 2, background: '#0e141c', padding: '120px clamp(24px,5vw,72px) 48px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <h2 style={{ ...H2, maxWidth: '16ch' }}>Instruments built by students, deployed in the field</h2>
        <p style={{ ...BODY, margin: '26px 0 0' }}>We are a Student Project Team at the intersection of the Earth Sciences, Engineering, Data Science, and beyond, focused on monitoring the world around us. We are the only Cornell project team affiliated with both the College of Engineering and the Department of Earth and Atmospheric Sciences, giving our members a unique opportunity to pursue true scientific research, experience hands-on engineering prototyping, and initiate, manage, and lead their own projects.</p>

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
                <div style={{ aspectRatio: '16/10', background: '#1a2430' }} />
              )}
              <div style={{ padding: '20px 0 0' }}>
                <div style={{ fontFamily: RESIPLE, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: proj.tagColor }}>{fmtTag(proj.tag)}</div>
                <h3 style={{ fontFamily: MANTI, fontWeight: 600, fontSize: 25, margin: '12px 0 0', letterSpacing: '-0.01em' }}>
                  {proj.slug ? (
                    <a href={`#/posts/${proj.slug}`} className="post-link" aria-label={`Read the ${proj.title} post`}>{proj.title} <span aria-hidden="true" style={{ fontSize: 19, color: '#4fae7d' }}>→</span></a>
                  ) : (
                    proj.title
                  )}
                </h3>
                {proj.body && <p style={{ fontSize: 15, lineHeight: 1.6, color: '#a9bcc6', margin: '12px 0 0' }}>{proj.body}</p>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>

    {/* TEAM PHOTO */}
    <section id="team" style={{ position: 'relative', zIndex: 2, background: '#0e141c', padding: '48px clamp(24px,5vw,72px) 96px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <figure style={{ margin: 0 }}>
          <div className="team-photo-frame" style={{ position: 'relative', padding: 14, border: '2px solid #086727', boxShadow: '10px 10px 0 rgba(8,103,39,0.35)' }}>
            <img loading="lazy" decoding="async" src="/team.jpg" alt="The GeoData team on the stairs of Upson Hall" style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '1600/1066' }} />
            <figcaption className="team-photo-caption" style={{ position: 'absolute', bottom: 30, left: 30, background: '#086727', color: '#eaf2ee', fontFamily: "'Intan',sans-serif", fontSize: 'clamp(16px,2.2vw,24px)', letterSpacing: '0.04em', padding: '10px 22px', whiteSpace: 'nowrap' }}>Team Photo '25 – '26</figcaption>
          </div>
        </figure>
      </div>
    </section>

    {/* JOIN */}
    <section id="join" style={{ position: 'relative', zIndex: 2, background: '#0e141c', padding: '130px clamp(24px,5vw,72px)' }}>
      <div style={{ maxWidth: 820 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: RESIPLE, fontSize: 20, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#4fae7d' }}>
          {/* tethersonde stand-in for the usual "we're live" dot */}
          <svg width="34" height="40" viewBox="-7 -7 34 40" fill="none" aria-hidden="true">
            {/* hand-drawn emphasis dashes radiating off the balloon */}
            <path d="M10 -5.5 L10 -2.8" stroke="#4fae7d" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M1.2 -2.4 L3.4 0" stroke="#4fae7d" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M18.8 -2.4 L16.6 0" stroke="#4fae7d" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M-4.5 6 L-1.6 6.8" stroke="#4fae7d" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M24.5 6 L21.6 6.8" stroke="#4fae7d" strokeWidth="1.7" strokeLinecap="round" />
            <circle cx="10" cy="8.5" r="7" stroke="#4fae7d" strokeWidth="2" />
            <path d="M8 15 L10 18 L12 15" stroke="#4fae7d" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M10 18 C 10 21, 8.5 22.5, 10 25" stroke="#4fae7d" strokeWidth="1.4" strokeLinecap="round" fill="none" />
            <rect x="7.5" y="25" width="5" height="5" stroke="#4fae7d" strokeWidth="1.6" />
          </svg>
          Recruitment open
        </div>
        <h2 style={{ fontFamily: MANTI, fontWeight: 700, fontSize: 'clamp(42px,6.2vw,80px)', letterSpacing: '-0.03em', lineHeight: 1, margin: '20px 0 0' }}>Design, Deploy,<br /><span style={{ color: '#4fae7d' }}>Discover</span></h2>
        <p style={{ ...BODY, maxWidth: 560, margin: '26px 0 0' }}>Build the instruments a changing planet needs. GeoData welcomes students of every major, from CS and MechE to earth science and design. If you want to build hardware that ends up outdoors collecting real data, there's a subteam for you.</p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 38 }}>
          <a href="https://docs.google.com/forms/d/e/1FAIpQLSfI87dxinWPeDd9aevwKjwfP0NtWR8uJDhHeD9qjdQPXV9oiA/viewform?usp=dialog" target="_blank" rel="noopener noreferrer" style={PILL_PRIMARY}>Upperclassmen Recruiting: DUE 9/3</a>
          <a href="https://docs.google.com/forms/d/1u6mjjlEL9Y4fdN8RFB1K6jTpS7aYig-wt54i3YyhtS8/viewform" target="_blank" rel="noopener noreferrer" style={PILL}>Underclassmen Interest Form</a>
          <a href="https://docs.google.com/spreadsheets/d/1ZYLfV6FjYPi1sL58lr9eAjuKM37q2tXTtEAOSyoPfpU/edit?usp=sharing" target="_blank" rel="noopener noreferrer" style={PILL}>Coffee Chat Contacts</a>
        </div>
      </div>
    </section>

    {/* RECRUITING TIMELINE */}
    <RecruitingTimeline />

    </>
  );
}
