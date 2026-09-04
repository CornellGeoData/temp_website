import { useState } from 'react';
import { RESIPLE, MANTI, H2, SUBPAGE } from '../styles/theme';
import { MEMBERS, SUBTEAM_COLORS, SUBTEAM_BADGES, SUBTEAM_BLURBS, SUBTEAM_COUNT, MEMBER_COUNT } from '../data/content';

const teamLabel = (s: string): string => (s === 'Leadership' ? s : `${s} Team`);

export function MembersPage() {
  // key of the member tile currently flipped to its contact card
  const [flippedMember, setFlippedMember] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail((cur) => (cur === email ? null : cur)), 1500);
  };

  return (
    <section style={SUBPAGE}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div className="members-head" style={{ display: 'flex', flexWrap: 'wrap', gap: '28px 48px', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h2 style={H2}>Subteams</h2>
          </div>
          <div className="members-stats" style={{ padding: '26px 36px', display: 'flex', gap: 48 }}>
            <div>
              <div className="stat-num" style={{ fontFamily: MANTI, fontWeight: 700, fontSize: 46, lineHeight: 1, color: '#4fae7d' }}>{SUBTEAM_COUNT}</div>
              <div className="stat-label" style={{ fontFamily: RESIPLE, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a9bcc6', marginTop: 10 }}>Subteams</div>
            </div>
            <div>
              <div className="stat-num" style={{ fontFamily: MANTI, fontWeight: 700, fontSize: 46, lineHeight: 1, color: '#4fae7d' }}>{MEMBER_COUNT}</div>
              <div className="stat-label" style={{ fontFamily: RESIPLE, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a9bcc6', marginTop: 10 }}>Members</div>
            </div>
          </div>
        </div>
        {[...new Set(MEMBERS.map((m) => m.subteam))].map((subteam) => (
          <div key={subteam} style={{ marginTop: 64 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: RESIPLE, fontSize: 17, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: SUBTEAM_COLORS[subteam] ?? '#7c909b' }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: SUBTEAM_COLORS[subteam] ?? '#7c909b', display: 'inline-block' }} />
              {teamLabel(subteam)}
            </div>
            {SUBTEAM_BLURBS[subteam] && (
              <p style={{ fontSize: 15, lineHeight: 1.6, color: '#a9bcc6', margin: '10px 0 0' }}>{SUBTEAM_BLURBS[subteam]}</p>
            )}
            <div className="members-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(190px,100%),1fr))', gap: '36px 28px', marginTop: 26 }}>
              {MEMBERS.filter((m) => m.subteam === subteam).map((m, i) => {
                const tileKey = `${subteam}:${i}`;
                const color = SUBTEAM_COLORS[m.badge ?? subteam] ?? '#7c909b';
                return (
                  <div key={i} style={{ position: 'relative' }}>
                    {flippedMember === tileKey ? (
                      <div
                        onClick={() => setFlippedMember(null)}
                        style={{ position: 'relative', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}
                      >
                        {m.photo ? (
                          <img loading="lazy" decoding="async" src={m.photo} alt="" draggable={false} style={{ display: 'block', width: '100%', aspectRatio: '1/1', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ aspectRatio: '1/1', background: '#1a2430' }} />
                        )}
                        <div className="member-flip" style={{ position: 'absolute', inset: 0, background: 'rgba(12,18,24,0.82)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', border: `3px solid ${color}`, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
                        <div style={{ fontFamily: RESIPLE, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color }}>{m.role ?? (m.lead ? 'Subteam Lead' : 'Contact')}</div>
                        <div style={{ fontSize: 14.5, color: '#b6c6ce' }}>{m.major || 'Major TBD'}</div>
                        {m.email ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <a href={`mailto:${m.email}`} onClick={(e) => e.stopPropagation()} style={{ fontFamily: "'Parachutes Sans',sans-serif", textTransform: 'lowercase', fontSize: 13.5, wordBreak: 'break-all' }}>{m.email}</a>
                            <button
                              type="button"
                              aria-label={`Copy ${m.email}`}
                              onClick={(e) => { e.stopPropagation(); copyEmail(m.email); }}
                              style={{ fontFamily: RESIPLE, fontSize: 11, padding: '3px 10px', border: `1px solid ${copiedEmail === m.email ? color : 'rgba(255,255,255,0.25)'}`, background: 'transparent', color: copiedEmail === m.email ? color : '#a9bcc6', cursor: 'pointer' }}
                            >
                              {copiedEmail === m.email ? 'Copied ✓' : 'Copy'}
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 13.5, color: '#5f7078' }}>Contact coming soon</span>
                        )}
                        {m.linkedin && (
                          <a href={m.linkedin} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="member-linkedin" style={{ fontFamily: RESIPLE, fontSize: 12, letterSpacing: '0.06em', alignSelf: 'flex-start' }}>{m.linkedin.includes('scholar.google') ? 'Google Scholar' : 'LinkedIn'}</a>
                        )}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="member-tile"
                        onClick={() => setFlippedMember(tileKey)}
                        aria-label={`Contact info for ${m.name}`}
                        style={{ position: 'relative', display: 'block', width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', '--tile-color': color } as React.CSSProperties}
                      >
                        {m.photo ? (
                          <img loading="lazy" decoding="async" src={m.photo} alt={m.name} draggable={false} style={{ display: 'block', width: '100%', aspectRatio: '1/1', objectFit: 'cover', userSelect: 'none', WebkitUserSelect: 'none' }} />
                        ) : (
                          <div style={{ aspectRatio: '1/1', background: '#1a2430' }} />
                        )}
                      </button>
                    )}
                    {SUBTEAM_BADGES[m.badge ?? subteam] && (
                      <img className="member-badge" decoding="async" src={SUBTEAM_BADGES[m.badge ?? subteam]} alt={`${m.badge ?? subteam} team badge`} draggable={false} style={{ position: 'absolute', top: 8, left: 8, width: 36, height: 36, pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none' }} />
                    )}
                    <div style={{ fontFamily: RESIPLE, fontWeight: 700, fontSize: 16.5, marginTop: 12 }}>{m.name}</div>
                    {(m.role || m.lead) && (
                      <div style={{ fontFamily: RESIPLE, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color, marginTop: 4 }}>{m.role ?? 'Subteam Lead'}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
