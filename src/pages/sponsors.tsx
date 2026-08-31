import type React from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlumniPit } from '../components/AlumniPit';
import { RESIPLE, MANTI, H2, BODY, SUBPAGE } from '../styles/theme';
import { SPONSOR_PACKET_PDF, TIERS, ALUMNI } from '../data/content';

// the packet renders as pre-baked page images (public/sponsorship/) instead of
// a browser <object> PDF embed - consistent styling, works on phones, and
// avoids downloading the 29MB PDF just to preview it. Regenerate after
// updating the packet:
//   pdftoppm -jpeg -jpegopt quality=78 -scale-to-x 1400 -scale-to-y -1 public/sponsorship/packet.pdf public/sponsorship/page
const PACKET_PAGE_COUNT = 12;
const packetPageSrc = (n: number) => `/sponsorship/page-${String(n + 1).padStart(2, '0')}.webp`;

function PacketViewer() {
  const [page, setPage] = useState(0);
  // fixed-overlay "fullscreen" rather than the Fullscreen API - iPhones don't
  // support requestFullscreen on elements, the overlay works everywhere
  const [full, setFull] = useState(false);
  // fetch the next page ahead of the click so turning feels instant
  useEffect(() => {
    if (page < PACKET_PAGE_COUNT - 1) new Image().src = packetPageSrc(page + 1);
  }, [page]);
  // arrow keys page through while the sponsors page is up; Esc exits fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setPage((p) => Math.min(p + 1, PACKET_PAGE_COUNT - 1));
      else if (e.key === 'ArrowLeft') setPage((p) => Math.max(p - 1, 0));
      else if (e.key === 'Escape') setFull(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    document.body.style.overflow = full ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [full]);
  const arrowStyle = (enabled: boolean): React.CSSProperties => ({ padding: '7px 22px', border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: enabled ? '#e6ecf0' : '#4d5b63', fontFamily: RESIPLE, fontWeight: 700, fontSize: 17, cursor: enabled ? 'pointer' : 'default', lineHeight: 1.2 });
  const cornerBtn: React.CSSProperties = { padding: '5px 12px', fontFamily: RESIPLE, fontWeight: 700, fontSize: 11, boxShadow: '0 2px 10px rgba(0,0,0,0.45)', lineHeight: 1.4 };
  const viewer = (
    <div
      className="team-photo-frame"
      style={full
        ? { position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(14,20,28,0.98)', padding: 14 }
        : { width: 'fit-content', maxWidth: '100%', margin: '0 auto', padding: 14, border: '2px solid #086727' }}
    >
      <div style={{ position: 'relative' }}>
        {/* sized by height so the whole page fits on screen without scrolling */}
        <img key={page} src={packetPageSrc(page)} alt={`Sponsorship packet, page ${page + 1} of ${PACKET_PAGE_COUNT}`} style={{ display: 'block', height: full ? 'calc(100vh - 110px)' : 'min(56vh, 520px)', maxWidth: '100%', aspectRatio: '1400/1812', objectFit: 'contain', background: '#1a2430' }} />
        <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', gap: 8 }}>
          <button
            type="button"
            title={full ? 'Exit fullscreen (Esc)' : 'View fullscreen'}
            onClick={() => setFull(!full)}
            style={{ ...cornerBtn, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(14,20,28,0.75)', color: '#e6ecf0', cursor: 'pointer' }}
          >
            {full ? 'Exit' : 'Fullscreen'}
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, paddingTop: 14 }}>
        <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)} style={arrowStyle(page > 0)}>←</button>
        <span style={{ fontFamily: RESIPLE, fontSize: 12.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a9bcc6', minWidth: '9ch', textAlign: 'center' }}>Page <span style={{ fontWeight: 700, color: '#e6ecf0' }}>{page + 1}</span> of <span style={{ fontWeight: 700, color: '#e6ecf0' }}>{PACKET_PAGE_COUNT}</span></span>
        <button type="button" aria-label="Next page" disabled={page === PACKET_PAGE_COUNT - 1} onClick={() => setPage(page + 1)} style={arrowStyle(page < PACKET_PAGE_COUNT - 1)}>→</button>
      </div>
    </div>
  );
  // portal escapes the sponsors section's z-index stacking context, which
  // otherwise leaves the fixed site header painted over the overlay
  return full ? createPortal(viewer, document.body) : viewer;
}

function CopyEmailButton({ label }: { label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText('cugeodata@cornell.edu');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{ display: 'inline-block', padding: '13px 28px', borderRadius: 999, border: 0, cursor: 'pointer', background: '#086727', color: '#eaf2ee', fontWeight: 700, fontSize: 17, fontFamily: RESIPLE }}
    >
      {copied ? 'Copied cugeodata@cornell.edu' : label}
    </button>
  );
}

export function SponsorsPage() {
  return (
    <section style={SUBPAGE}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 'clamp(32px,4vw,64px)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ flex: '0 1 560px', minWidth: 300 }}>
            <h2 style={H2}>Sponsorships &amp; Donations</h2>
            <p style={{ ...BODY, maxWidth: 620, margin: '26px 0 0' }}>Every instrument we deploy is designed, built, and tested by students. Sponsor support directly funds the hardware, fieldwork, and research that make our projects possible.</p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 34 }}>
              <CopyEmailButton label="Become a sponsor" />
              <a href={SPONSOR_PACKET_PDF} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '13px 28px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.18)', color: '#e6ecf0', fontWeight: 700, fontSize: 17, fontFamily: RESIPLE }}>Download the packet (PDF)</a>
            </div>
          </div>
          {/* PACKET BOARD */}
          <PacketViewer />
        </div>

        {/* TIERS */}
        <div style={{ marginTop: 110 }}>
          <h3 style={{ fontFamily: MANTI, fontWeight: 700, fontSize: 'clamp(28px,3.4vw,40px)', letterSpacing: '-0.02em', margin: '16px 0 0' }}>Sponsorship tiers</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(240px,100%),1fr))', gap: 26, marginTop: 44 }}>
            {TIERS.map((tier) => (
              <div key={tier.name} style={{ background: '#141c26', borderTop: `3px solid ${tier.color}`, padding: '26px 24px' }}>
                <div style={{ fontFamily: RESIPLE, fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: tier.color }}>{tier.name}</div>
                <div style={{ fontFamily: MANTI, fontWeight: 700, fontSize: 34, marginTop: 12 }}>{tier.amount}</div>
                <ul style={{ margin: '18px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {tier.perks.map((perk) => (
                    <li key={perk} style={{ position: 'relative', paddingLeft: 18, fontSize: 14.5, lineHeight: 1.5, color: '#a9bcc6' }}>
                      <span style={{ position: 'absolute', left: 0, color: tier.color }}>▸</span>{perk}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ALUMNI */}
        <div style={{ marginTop: 130 }}>
          <h2 style={H2}>Alumni Ball Pit</h2>
          <div className="team-photo-frame" style={{ padding: 14, border: '2px solid #086727', boxShadow: '10px 10px 0 rgba(8,103,39,0.35)', marginTop: 40 }}>
            <AlumniPit alumni={ALUMNI} />
          </div>
          <div style={{ marginTop: 36 }}>
            <CopyEmailButton label="Contact us for more info" />
          </div>
        </div>
      </div>
    </section>
  );
}
