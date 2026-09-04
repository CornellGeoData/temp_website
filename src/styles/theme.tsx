import type React from 'react';

// shared presentational values - the two site fonts, section and text styles -
// plus the one text formatter used by more than one page. Nothing else belongs
// here: the next non-token helper that wants in means this file needs a
// different name, not another lodger.

// the two site fonts. Manti Sans is display-only (no period glyph - decimals
// render as tofu), so anything numeric or body-sized uses Resiple.
export const RESIPLE = "'Resiple',sans-serif";
export const MANTI = "'Manti Sans',sans-serif";

// shared text styles for the big section headings and their body copy
export const H2: React.CSSProperties = { fontFamily: MANTI, fontWeight: 700, fontSize: 'clamp(36px,4.8vw,60px)', letterSpacing: '-0.02em', lineHeight: 1.02, margin: 0 };
export const BODY: React.CSSProperties = { fontSize: 17, lineHeight: 1.65, color: '#a9bcc6' };
// recruitment call-to-action pills; PILL is the muted filled variant, PILL_PRIMARY the brand-green one
export const PILL: React.CSSProperties = { display: 'inline-block', padding: '15px 32px', borderRadius: 999, border: 0, background: '#1a2430', color: '#e6ecf0', fontWeight: 700, fontSize: 18.5, fontFamily: RESIPLE };
export const PILL_PRIMARY: React.CSSProperties = { ...PILL, background: '#086727', color: '#eaf2ee' };
// the outer section every sub-page (posts, sponsors, sensors, members, legal) sits in
export const SUBPAGE: React.CSSProperties = { position: 'relative', zIndex: 2, background: '#0e141c', padding: '150px clamp(24px,5vw,72px) 110px', minHeight: '100vh' };

// "Tech x Air" -> smaller x between team names
export const fmtTag = (tag: string) => tag.split(/( x )/).map((p, i) => (p === ' x ' ? <span key={i} style={{ fontSize: '0.72em' }}> x </span> : p));
