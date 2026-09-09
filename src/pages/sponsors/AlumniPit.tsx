import { useEffect, useRef } from 'react';
import { MANTI } from '../../styles/theme';
import { ALUMNI } from '../../data/content';

// Physics updates DOM transforms without triggering React renders.
export function AlumniPit({ alumni }: { alumni: typeof ALUMNI }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const R = window.innerWidth < 720 ? 50 : 60;
    interface Ball { el: HTMLElement; x: number; y: number; vx: number; vy: number; sleep: number; rx: number; ry: number }
    const balls: Ball[] = Array.from(wrap.children as HTMLCollectionOf<HTMLElement>).map((el, i) => {
      el.style.width = el.style.height = `${R * 2}px`;
      // spawn stacked above the pit so they rain in on arrival
      const x = R + Math.random() * Math.max(1, wrap.clientWidth - 2 * R);
      const y = -R - i * R * 2.4;
      return { el, x, y, vx: (Math.random() - 0.5) * 120, vy: 0, sleep: 0, rx: x, ry: y };
    });
    let W = wrap.clientWidth;
    let H = wrap.clientHeight;
    // wake everyone on resize - the walls/floor moved out from under sleepers
    const onResize = () => { W = wrap.clientWidth; H = wrap.clientHeight; for (const b of balls) b.sleep = 0; };
    window.addEventListener('resize', onResize);

    let dragged: Ball | null = null;
    const pointAt = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      return { px: e.clientX - r.left, py: e.clientY - r.top };
    };
    const onDown = (e: PointerEvent) => {
      const { px, py } = pointAt(e);
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        if ((px - b.x) ** 2 + (py - b.y) ** 2 <= R * R) {
          dragged = b;
          b.vx = b.vy = 0;
          wrap.setPointerCapture(e.pointerId);
          break;
        }
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!dragged) return;
      const { px, py } = pointAt(e);
      // velocity from how far the ball chased the pointer this frame, so a
      // fast flick releases as a throw
      dragged.vx = (px - dragged.x) * 18;
      dragged.vy = (py - dragged.y) * 18;
      dragged.x = px;
      dragged.y = py;
    };
    const onUp = () => { dragged = null; };
    wrap.addEventListener('pointerdown', onDown);
    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerup', onUp);
    wrap.addEventListener('pointercancel', onUp);

    const G = 1800;
    const REST = 0.78;
    // frames (~0.5s) below ~30px/s before a ball naps: napping balls skip
    // integration entirely, so a settled pile is rock still instead of
    // trading gravity-fed micro-impulses through the stack forever
    const SLEEP_AT = 30;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;
      for (const b of balls) {
        if (b === dragged || b.sleep >= SLEEP_AT) continue;
        b.vy += G * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < R) { b.x = R; b.vx = -b.vx * REST; }
        else if (b.x > W - R) { b.x = W - R; b.vx = -b.vx * REST; }
        // no ceiling - a hard throw arcs out the top and falls back in
        // slow floor contacts don't rebound, otherwise gravity feeds a
        // tiny bounce every frame and the pile vibrates forever
        if (b.y > H - R) { b.y = H - R; b.vy = -b.vy * REST; b.vx *= 0.96; if (-b.vy < 60) b.vy = 0; }
      }
      // Pairwise collisions are O(n²) for this small set of logos.
      // two solver passes stiffen the stack so balls don't sink and re-push each frame
      for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i];
          const b = balls[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          const min = 2 * R;
          if (d2 === 0 || d2 >= min * min) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          // wake nappers only on a real disturbance: the dragged ball, or a
          // neighbor arriving fast (real impacts come in at 300+px/s; the
          // settling pile's velocity churn stays under ~100). Never touch an
          // awake ball's counter here - drift alone decides who falls asleep.
          if (a === dragged || b === dragged || Math.abs(rvn) > 150) {
            if (a !== dragged && a.sleep >= SLEEP_AT) a.sleep = 0;
            if (b !== dragged && b.sleep >= SLEEP_AT) b.sleep = 0;
          }
          const aStill = a === dragged || a.sleep >= SLEEP_AT;
          const bStill = b === dragged || b.sleep >= SLEEP_AT;
          if (aStill && bStill) continue;
          const push = (min - d) / 2;
          if (!aStill) { a.x -= nx * push; a.y -= ny * push; }
          if (!bStill) { b.x += nx * push; b.y += ny * push; }
          if (rvn < 0) {
            // restitution only on fast impacts; slow contacts resolve dead
            const imp = (-(1 + (rvn < -80 ? REST : 0)) * rvn) / 2;
            if (!aStill) { a.vx -= imp * nx; a.vy -= imp * ny; }
            if (!bStill) { b.vx += imp * nx; b.vy += imp * ny; }
          }
        }
      }
      }
      for (const b of balls) {
        if (b === dragged) { b.sleep = 0; b.rx = b.x; b.ry = b.y; continue; }
        if (b.sleep >= SLEEP_AT) continue;
        // collision pushes can shove past the wall/floor clamp - re-clamp so
        // nobody falls asleep poking out of the pit
        if (b.x < R) b.x = R;
        else if (b.x > W - R) b.x = W - R;
        if (b.y > H - R) b.y = H - R;
        // sleep on net drift, not instantaneous speed - resting balls trade
        // micro-impulses every frame that never take them anywhere
        if (Math.hypot(b.x - b.rx, b.y - b.ry) < 2) { if (++b.sleep >= SLEEP_AT) { b.vx = 0; b.vy = 0; } }
        else { b.rx = b.x; b.ry = b.y; b.sleep = 0; }
      }
      for (const b of balls) b.el.style.transform = `translate(${b.x - R}px, ${b.y - R}px)`;
      raf = requestAnimationFrame(step);
    };
    // hold the drop until the pit scrolls into view so the rain-in isn't wasted off-screen
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      last = performance.now();
      raf = requestAnimationFrame(step);
    }, { threshold: 0.3 });
    io.observe(wrap);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      wrap.removeEventListener('pointerdown', onDown);
      wrap.removeEventListener('pointermove', onMove);
      wrap.removeEventListener('pointerup', onUp);
      wrap.removeEventListener('pointercancel', onUp);
    };
  }, []);

  return (
    <div ref={wrapRef} className="alumni-pit" style={{ position: 'relative', height: 'clamp(340px,48vw,500px)', overflow: 'hidden', touchAction: 'none', cursor: 'grab', background: '#121a23', WebkitTapHighlightColor: 'transparent', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
      {alumni.map((a, i) => (
        <div key={i} title={a.place} style={{ position: 'absolute', top: 0, left: 0, transform: 'translate(-100vw,0)', borderRadius: 999, background: '#e6ecf0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', willChange: 'transform' }}>
          {a.logo ? (
            <img src={a.logo} alt={a.place} draggable={false} style={{ width: '68%', height: '68%', objectFit: 'contain', pointerEvents: 'none' }} />
          ) : (
            <span style={{ fontFamily: MANTI, fontWeight: 700, fontSize: 26, color: '#0e141c', pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}>{a.place.split(' ').map((w) => w[0]).join('').slice(0, 3)}</span>
          )}
        </div>
      ))}
    </div>
  );
}
