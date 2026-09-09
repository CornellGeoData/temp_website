import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { RESIPLE } from '../../styles/theme';
import { VISUALIZATIONS, type Visualization, type ViewId } from '../../data/visualizations';

// the way between the data page's views: a nine-dot button that opens a
// grid of tiles, one picture and a line of description per view.
// The panel portals to <body> so no stage's overflow or transform can clip it.
export default function ViewLauncher({ current, onGo, ink = '#e6ecf0', buttonStyle }: {
  current: ViewId;
  onGo: (id: ViewId) => void;
  ink?: string;
  buttonStyle?: CSSProperties;
}) {
  const [openPanel, setOpenPanel] = useState(false);
  useEffect(() => {
    if (!openPanel) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenPanel(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPanel]);

  return (
    <>
      <button
        type="button"
        aria-label="Switch view"
        aria-expanded={openPanel}
        onClick={() => setOpenPanel(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', appearance: 'none', cursor: 'pointer',
          width: 32, height: 32, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(14,20,28,0.82)', backdropFilter: 'blur(6px)',
          ...buttonStyle,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill={ink} aria-hidden="true">
          {[2, 8, 14].flatMap((y) => [2, 8, 14].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" />))}
        </svg>
      </button>
      {openPanel && createPortal(
        <div
          className="stage-menu-overlay"
          onClick={() => setOpenPanel(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(14,20,28,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', animation: 'stage-fade 180ms ease-out' }}
        >
          <style>{'@keyframes stage-fade{from{opacity:0}to{opacity:1}} .stage-tile:hover{border-color:rgba(255,255,255,0.45)!important}'}</style>
          <div
            role="dialog"
            aria-label="Visualizations"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 780, maxHeight: '100%', overflowY: 'auto', background: '#0e141c', border: '1px solid rgba(255,255,255,0.15)', padding: 'clamp(16px,3vw,26px)', fontFamily: RESIPLE }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <button type="button" onClick={() => { setOpenPanel(false); onGo('home'); }} style={{ appearance: 'none', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: RESIPLE, fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#4fae7d' }}>Visualizations</button>
              <button type="button" aria-label="Close" onClick={() => setOpenPanel(false)} style={{ appearance: 'none', border: 'none', background: 'transparent', color: '#a9bcc6', cursor: 'pointer', fontFamily: RESIPLE, fontSize: 22, lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(300px,100%),1fr))', gap: 18 }}>
              {VISUALIZATIONS.map((s) => (
                <Tile key={s.id} stage={s} here={s.id === current} onPick={() => { setOpenPanel(false); if (s.id !== current) onGo(s.id); }} />
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function Tile({ stage, here, onPick }: { stage: Visualization; here: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      className="stage-tile"
      onClick={onPick}
      style={{ appearance: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: RESIPLE, padding: 10, background: 'transparent', color: '#e6ecf0', border: `1px solid ${here ? '#4fae7d' : 'rgba(255,255,255,0.14)'}`, transition: 'border-color 150ms' }}
    >
      <img src={stage.thumb} alt="" loading="lazy" decoding="async" draggable={false} style={{ display: 'block', width: '100%', aspectRatio: '16/10', objectFit: 'cover', background: '#141c26' }} />
      <div style={{ marginTop: 12, fontWeight: 700, fontSize: 15.5 }}>{stage.label}</div>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: '#a9bcc6', marginTop: 5 }}>{stage.blurb}</div>
    </button>
  );
}
