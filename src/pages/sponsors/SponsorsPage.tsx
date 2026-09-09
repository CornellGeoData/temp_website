import type React from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlumniPit } from './AlumniPit';
import { RESIPLE, MANTI, H2, BODY, SUBPAGE, PILL, PILL_PRIMARY } from '../../styles/theme';
import { SPONSOR_PACKET_PDF, TIERS, ALUMNI } from '../../data/content';

// Keep the WebP page previews in sync with public/sponsorship/packet.pdf.
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
  const arrowStyle = (enabled: boolean): React.CSSProperties => ({ padding: '7px 22px', border: 0, background: '#1a2430', color: enabled ? '#e6ecf0' : '#4d5b63', fontFamily: RESIPLE, fontWeight: 700, fontSize: 17, cursor: enabled ? 'pointer' : 'default', lineHeight: 1.2 });
  const cornerBtn: React.CSSProperties = { padding: '5px 12px', fontFamily: RESIPLE, fontWeight: 700, fontSize: 11, boxShadow: '0 2px 10px rgba(0,0,0,0.45)', lineHeight: 1.4 };
  const viewer = (
    <div
      style={full
        ? { position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(14,20,28,0.98)', padding: 14 }
        // inline: take whatever is left beside the text column and sit in
        // the middle of it; on phones that is the full row
        : { flex: '1 1 260px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <div style={{ position: 'relative', width: full ? undefined : 'min(70%, 320px)' }}>
        {/* inline: the page fills the column width and its height follows the
            aspect ratio, so there is never a letterbox; fullscreen: fit the
            page inside the viewport both ways */}
        <img key={page} src={packetPageSrc(page)} alt={`Sponsorship packet, page ${page + 1} of ${PACKET_PAGE_COUNT}`} style={full
          ? { display: 'block', width: 'auto', height: 'auto', maxWidth: 'calc(100vw - 28px)', maxHeight: 'calc(100vh - 110px)', aspectRatio: '1400/1812', background: '#1a2430' }
          : { display: 'block', width: '100%', height: 'auto', aspectRatio: '1400/1812', background: '#1a2430' }} />
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
      aria-label={copied ? 'Copied cugeodata@cornell.edu' : label}
      onClick={() => {
        navigator.clipboard.writeText('cugeodata@cornell.edu');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{ ...PILL_PRIMARY, padding: '13px 28px', fontSize: 17, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10 }}
    >
      {label}
      {/* only mounted while copied, so the pill widens to make room for it */}
      {copied && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ animation: 'check-pop 180ms ease-out' }}>
          <path d="M4 12.5l5 5L20 6.5" />
        </svg>
      )}
    </button>
  );
}

export function SponsorsPage() {
  return (
    <section style={SUBPAGE}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        {/* no column gap: the packet's flex box runs from the text column's
            right edge to the container's, so centering inside it splits the
            space evenly; the row gap only matters once the packet wraps */}
        <div style={{ display: 'flex', rowGap: 'clamp(32px,4vw,64px)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '0 1 560px', minWidth: 300 }}>
            <h2 style={H2}>Sponsorships &amp; Donations</h2>
            <p style={{ ...BODY, maxWidth: 620, margin: '26px 0 0' }}>Students design and build every instrument we deploy. Sponsorships pay for parts and field deployments.</p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 34 }}>
              <CopyEmailButton label="Copy our email" />
              <a href={SPONSOR_PACKET_PDF} target="_blank" rel="noopener noreferrer" style={{ ...PILL, padding: '13px 28px', fontSize: 17 }}>Download the packet (PDF)</a>
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
              <div key={tier.name} style={{ background: '#141c26', padding: '26px 24px' }}>
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
          <div className="team-photo-frame" style={{ padding: 14, border: '2px solid #086727', marginTop: 40 }}>
            <AlumniPit alumni={ALUMNI} />
          </div>
        </div>
      </div>
    </section>
  );
}
