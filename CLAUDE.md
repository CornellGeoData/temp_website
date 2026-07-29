# CLAUDE.md

Guidance for Claude Code (or any agent) working in this repository.

## What this is

A scroll-driven landing page for Cornell's GeoData project team, built with
**React 19 + TypeScript + Vite**, with a **three.js 0.150.1** voxel-globe scene as the
centerpiece. See `README.md` for the feature/architecture overview.

## Commands

```bash
npm install
npm run dev         # dev server with HMR
npm run build        # vite build (production bundle) — does NOT type-check
npm run preview      # serve the production build locally
npm run lint         # oxlint
npx tsc --noEmit     # type-check the whole project (run this before calling work done)
```

There is no test suite in this project. `npm run build` alone does not catch type errors —
`vite build` transpiles/strips types without checking them, so run `npx tsc --noEmit`
separately whenever touching `.ts`/`.tsx` files.

## Architecture

- `src/globeEngine.ts` — a framework-agnostic `GlobeEngine` class. Owns the three.js
  scene, camera, renderer, the voxel-globe builder, all cartoon props (satellite, Big Ben,
  tethersonde, Cornell clocktower, algae drone), the scroll listener, the drag handler, and
  the `requestAnimationFrame` animate loop. **No React import, no DOM framework
  assumptions** — it's handed raw DOM nodes via `mount({ sceneEl, canvasEl, heroEl, hintEl,
beatEls, dotEls })` and cleaned up via `unmount()`.
- `src/Globe.tsx` — thin React wrapper. Holds the refs, renders the hero copy / beat cards
  / progress dots / scroll hint as JSX, and in a `useEffect` constructs a `GlobeEngine` and
  calls `mount()`/`unmount()`. Contains no three.js code itself.
- `src/App.tsx` — the rest of the page (header, `<Globe/>`, projects/impact/partners/join
  sections, footer). Plain inline styles, no CSS framework.
- `src/main.tsx` — React root.

**Keep this split intact.** New 3D/animation/physics logic belongs in `globeEngine.ts`;
`Globe.tsx` should stay limited to refs, JSX, and the `mount`/`unmount` lifecycle call. This
is what makes the engine portable/testable independent of React.

## Working in `globeEngine.ts`

- Almost every three.js object field on `GlobeEngine` is declared with definite-assignment
  (`!:`) rather than optional, because they're all set unconditionally inside `initThree()`
  _before_ the point where `mount()` would bail out on missing WebGL — so by the time
  `animate()`/`onResize()` ever run, they're guaranteed populated. `renderer` is the one
  genuinely optional field (`WebGLRenderer | undefined`), since renderer construction is the
  actual fallible step. Preserve this reasoning if you add new engine-owned three.js state:
  either build it unconditionally before the `_noWebGL` gate (definite assignment) or gate
  its use with the same guard as `renderer`.
- Mesh fields are typed with their concrete generics (e.g.
  `THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>`, aliased as `VoxMesh`) rather
  than the default `Mesh<BufferGeometry, Material>`, specifically so `.material.color`,
  `.material.emissive`, `.material.emissiveIntensity` etc. type-check without casts. Follow
  the same pattern for any new mesh-returning helper.
- Inside `animate()`, when a field guarded by `if (this.x)` is then read inside a nested
  closure (a `.forEach` callback), alias it to a local `const` right after the guard (see
  `const sat = this.sat;`, `const drone = this.drone;`, etc.) rather than relying on
  `this.x` staying narrowed across the closure — TypeScript does not preserve narrowing of
  `this`-properties through nested function boundaries.
- No `any` / `@ts-ignore` are used anywhere in this file; keep it that way. If a three.js
  type genuinely can't be satisfied, prefer a narrowly-scoped assertion with a one-line
  comment explaining why (see the `ctx!.drawImage(...)` / `ctx!.getImageData(...)` calls in
  `buildEarth` for the existing precedent — a null 2d context throws synchronously there and
  is caught by the surrounding `try/catch`, which is the same behavior the untyped original
  relied on).

## Conventions

- No new abstractions beyond what's already here — this is a small, single-page project;
  resist splitting `App.tsx`'s sections or `globeEngine.ts`'s builders into more files unless
  asked.
- Don't add code comments explaining _what_ code does; only add them for non-obvious _why_
  (see the sparse comments already in `globeEngine.ts` for the expected density).
- `public/earth-water.png` is the equirectangular land/water mask the voxel globe samples;
  it's served same-origin specifically so `getImageData()` on the offscreen sampling canvas
  never hits a cross-origin canvas-taint error. Don't switch it back to a CDN URL.
- Needs WebGL. Don't remove the `try/catch` around `WebGLRenderer` construction in
  `initThree()` — it's what lets the page degrade (globe simply doesn't render/animate)
  instead of throwing on WebGL-less environments.
