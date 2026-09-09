import { RESIPLE, H2, SUBPAGE } from '../../styles/theme';
import { VISUALIZATIONS } from '../../data/visualizations';

export function VisualizationList() {
  return (
    <section style={{ ...SUBPAGE, minHeight: 0 }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <h2 style={{ ...H2, maxWidth: '14ch' }}>Visualizations</h2>

        <ul style={{ display: 'grid', gap: 16, listStyle: 'none', margin: '36px 0 0', padding: 0 }}>
          {VISUALIZATIONS.map((s) => (
            <li key={s.id}>
              <a href={s.hash} className="visualization-project" style={{ fontFamily: RESIPLE }}>
                <img src={s.thumb} alt="" loading="lazy" decoding="async" draggable={false} style={{ display: 'block', width: '100%', aspectRatio: '16/10', objectFit: 'cover', background: '#141c26' }} />
                <div>
                  <h3 style={{ fontFamily: RESIPLE, fontWeight: 700, fontSize: 'clamp(20px,2vw,24px)', margin: 0 }}>{s.label}</h3>
                  <p style={{ fontSize: 15, lineHeight: 1.6, color: '#a9bcc6', maxWidth: '64ch', margin: '9px 0 0' }}>{s.blurb}</p>
                </div>
                <span aria-hidden="true" style={{ fontSize: 24, color: '#84d3ab' }}>→</span>
              </a>
            </li>
          ))}
        </ul>
        <style>{`
          .visualization-project {
            display: grid;
            grid-template-columns: 240px minmax(0, 1fr) 24px;
            align-items: center;
            gap: 32px;
            padding: 12px;
            color: #e6ecf0;
            outline: 2px solid transparent;
            outline-offset: -2px;
            transition: background 150ms, outline-color 150ms;
          }
          .visualization-project:hover, .visualization-project:focus-visible, .visualization-project:active {
            outline-color: #84d3ab;
            background: rgba(132,211,171,0.04);
          }
          @media (max-width: 600px) {
            .visualization-project {
              grid-template-columns: minmax(0, 1fr) 20px;
              gap: 18px 12px;
              padding: 12px 8px;
            }
            .visualization-project img {
              grid-column: 1 / -1;
              aspect-ratio: 16 / 9 !important;
            }
          }
        `}</style>
      </div>
    </section>
  );
}
