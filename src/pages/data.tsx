import { RESIPLE, H2, SUBPAGE } from '../styles/theme';
import { STAGES } from '../data/stages';

// the data landing: a tile per view, the same registry the launcher shows
export function DataHome() {
  return (
    // three tiles don't need a viewport-tall section; let the footer follow
    <section style={{ ...SUBPAGE, minHeight: 0 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <h2 style={{ ...H2, maxWidth: '14ch' }}>Data Visualizations and Downloads</h2>

        {/* the tiles: the same registry the launcher shows inside a view */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(300px,100%),1fr))', gap: 22, marginTop: 56 }}>
          {STAGES.map((s) => (
            <a key={s.id} href={s.hash} className="data-tile" style={{ display: 'block', color: '#e6ecf0' }}>
              <img src={s.thumb} alt="" loading="lazy" decoding="async" draggable={false} style={{ display: 'block', width: '100%', aspectRatio: '16/10', objectFit: 'cover', background: '#141c26' }} />
              <div style={{ fontFamily: RESIPLE, fontWeight: 700, fontSize: 16.5, marginTop: 14 }}>{s.label}</div>
              <div style={{ fontFamily: RESIPLE, fontSize: 13.5, lineHeight: 1.5, color: '#a9bcc6', marginTop: 5 }}>{s.blurb}</div>
            </a>
          ))}
        </div>
        <style>{'.data-tile:hover{color:#84d3ab!important}'}</style>
      </div>
    </section>
  );
}
