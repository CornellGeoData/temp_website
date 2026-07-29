# CU GeoData — Landing Page

A scroll-driven landing page for Cornell's GeoData project team. A voxel-style 3D Earth
starts docked in a split hero (copy left, globe right), then takes over the full screen
and rotates through five "story beats" — the Air, Water, Rock, Data and Tech subteams —
as the user scrolls. Cartoon voxel props (a satellite, Big Ben, a weather balloon, the
Cornell clocktower, an algal-bloom-scanning drone) sit on and around the globe. The globe
can also be dragged to rotate freely.

## Stack

- **React 19** + **TypeScript**, bundled with **Vite**.
- **three.js 0.150.1** for all 3D — the voxel globe, cartoon props, lights, starfield, camera.
- Plain inline styles (no CSS framework); fonts are Google Fonts (Space Grotesk, IBM Plex
  Sans, IBM Plex Mono), loaded via `<link>` tags in `index.html`.
- **oxlint** for linting.

## Getting started

```bash
npm install
npm run dev       # start the dev server with HMR
npm run build     # type-check-free production build (tsc is run separately, see below)
npm run preview   # preview the production build locally
npm run lint       # oxlint
```

To type-check the whole project:

```bash
npx tsc --noEmit
```

## Project structure

```
index.html            # entry HTML; loads Google Fonts, mounts #root, script -> src/main.tsx
public/
  earth-water.png      # equirectangular land/water mask sampled by the voxel globe
  favicon.svg
src/
  main.tsx             # ReactDOM root
  App.tsx              # page shell: header, content sections (projects/impact/partners/join), <Globe/>
  Globe.tsx            # thin React wrapper: refs + overlay JSX, delegates all 3D/animation to GlobeEngine
  globeEngine.ts        # framework-agnostic three.js engine (voxel globe, props, scroll+drag, animate loop)
  index.css
  vite-env.d.ts
```

### `Globe.tsx` / `globeEngine.ts` split

`GlobeEngine` (in `globeEngine.ts`) has **no React dependency** — it's a plain class that
takes a `<section>`, a `<canvas>`, and a handful of overlay DOM nodes via `mount()`, and
owns the three.js scene, the scroll listener, the drag handler, and the
`requestAnimationFrame` loop. `Globe.tsx` is a thin wrapper: it renders the JSX (hero copy,
five beat cards, progress dots, scroll hint) with typed refs, and hands the underlying DOM
nodes to `new GlobeEngine().mount({ ... })` inside a `useEffect`, calling `engine.unmount()`
on cleanup.

This separation is intentional — keep new 3D/animation logic in `globeEngine.ts`, and keep `Globe.tsx`
limited to refs and markup.

## How the scroll interaction works

- The `<section>` wrapping the globe is `height: 640vh`; a `position: sticky` inner wrapper
  pins the `<canvas>` for the full viewport height while the user scrolls through it.
  (The page's outer wrapper uses `overflow-x: clip`, not `hidden` — an ancestor with
  `overflow: hidden` silently becomes the scroll container and breaks `position: sticky`.)
- A `scroll` listener computes normalized progress `p` in `[0, 1]` from the section's
  `getBoundingClientRect()` vs. its scrollable height.
- The `animate()` loop (a `requestAnimationFrame` loop in `GlobeEngine`) reads `p` every
  frame and drives:
    - **Takeover** — eased interpolation of the globe's scale and x-position from the hero
      layout to full-screen-centered, over the first ~18% of scroll.
    - **Rotation** — target yaw/pitch interpolated between beat keyframes (`this.BEATS`),
      applied with a damped follow for smoothness; drag input (`userYaw`/`userPitch`) is
      added on top so manual rotation and scroll-driven rotation coexist.
    - **Overlays** — opacity/transform of the hero copy, beat cards, progress dots, and pins,
      all derived from `p`.

## The 3D scene

- **Voxel Earth** (`buildEarth`) — ~7,200 points on a Fibonacci sphere, each one cube in a
  single `THREE.InstancedMesh` (one draw call). Real geography comes from
  `public/earth-water.png` (equirectangular land/water mask), sampled per-point on an
  offscreen canvas; if that fails to load, it falls back to procedural `fbm` noise so the
  page never breaks.
- **Cartoon voxel props**, each planted on the globe surface via `surfaceGroup` (local +Y =
  outward surface normal): a satellite orbiting independently in the scene, Big Ben
  (Westminster), a balloon tethersonde (Arizona), the Cornell clocktower (Ithaca), and a
  drone that sweeps across a small algal-bloom lake, "cleaning" it as it passes.
- Lighting is ambient + a white key light + a green rim light, plus a soft additive
  atmosphere sphere and a slowly-rotating starfield.

Tunable parameters worth knowing about (all in `globeEngine.ts`): `N = 7200` (voxel
density), `this.BEATS` (beat lat/lon/color), `bStart`/`bEnd` in `animate()` (where beats
begin/end within scroll progress), the takeover `lerp(0.9, 1.72, …)` and `0.18` fraction,
and the damping/drag-sensitivity constants near the top of `animate()`/`addDrag()`.

## Known constraints

- Needs WebGL — `initThree()` wraps renderer creation in a `try/catch`; if it throws, the
  engine sets an internal "no WebGL" flag and skips the render loop cleanly rather than
  crashing.
- `earth-water.png` is served same-origin from `public/`, so `getImageData` on the sampling
  canvas never hits a cross-origin taint issue. If you swap in a different land mask,
  adjust the brightness threshold (`< 110`) used to distinguish land from water.

## History

This project was originally authored in a proprietary "Design Component" (`.dc.html`)
wrapper and later ported to this standalone Vite + React + TypeScript app.
