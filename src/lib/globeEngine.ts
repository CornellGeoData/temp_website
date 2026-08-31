import * as THREE from 'three';

// Framework-agnostic three.js globe engine. Mounted onto a <canvas> by
// Globe.tsx (the home hero) and SensorGlobe.tsx (the sensor picker); has no
// React dependency itself.
export interface MountArgs {
  canvasEl: HTMLCanvasElement;
  onNoWebGL?: () => void;
}

// Everything the two call sites disagree about. Defaults reproduce the home
// hero exactly, so that call site passes nothing.
export interface GlobeOptions {
  // point the globe faces before any user drag
  aimLat?: number;
  aimLon?: number;
  yaw?: number;
  pitch?: number;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  // false: wheel/pinch leave the zoom alone - only flyTo() moves it
  userZoom?: boolean;
  // 'window': the canvas is a full-viewport backdrop, measured off the window.
  // 'element': the canvas fills its own box, measured with a ResizeObserver.
  sizeMode?: 'window' | 'element';
  cameraZ?: number;
  // runs after every render, so an HTML pin overlay can reposition itself
  onFrame?: () => void;
}

type Vec3Coords = { x: number; y: number; z: number };
type FaceRotation = { rotY: number; rotX: number };
export type Projected = { x: number; y: number; visible: boolean };

// the earth model is fitted to this surface radius inside the group; pins ride
// just above it so they are never z-fought by the mesh
const SURFACE_R = 0.571;
const PIN_R = 0.585;
const TWO_PI = Math.PI * 2;

// scratch vectors - projection runs per pin per frame and must not allocate
const _pos = new THREE.Vector3();
const _center = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _toCam = new THREE.Vector3();
const _size = new THREE.Vector2();

const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export class GlobeEngine {
  canvasEl!: HTMLCanvasElement;
  onNoWebGL?: () => void;
  opts: Required<Omit<GlobeOptions, 'onFrame'>> & { onFrame?: () => void };

  _destroyed = false;
  _noWebGL = false;
  _paused = false;
  _shown = false;
  _raf?: number;
  _dragCleanup?: () => void;
  _ro?: ResizeObserver;

  halfWidth = 2.4;
  userYaw = 0;
  userPitch = 0;
  zoom = 1;
  isMobile = false;

  onResize!: () => void;

  // ---- three.js scene graph (all set unconditionally by initThree, before
  // the WebGL-availability gate that mount() checks prior to ever calling
  // animate/onResize/addDrag) ----
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer?: THREE.WebGLRenderer;
  group!: THREE.Group;
  baseRotY = 0;
  baseRotX = 0;

  stars!: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  globeHit!: THREE.Mesh; // invisible sphere over the earth, for drag/wheel hit tests

  // in-flight flyTo tween; any user drag cancels it
  _fly?: { yaw0: number; yaw1: number; pitch0: number; pitch1: number; zoom0: number; zoom1: number; t0: number; dur: number };

  constructor(opts: GlobeOptions = {}) {
    this.opts = {
      // the home hero's framing: the Americas at a 3/4 angle, filling the
      // right of the viewport. Together with the 0.35 yaw below this puts
      // 37.7N 64.9W under the crosshair - unchanged from the hand-tuned
      // -104.79 that predated the texture-rotation fix, just expressed
      // against a latLon() that now tells the truth.
      aimLat: opts.aimLat ?? 34.25,
      aimLon: opts.aimLon ?? -44.84,
      // start at the hand-tuned framing (North America centered), drag adjusts from there
      yaw: opts.yaw ?? 0.35,
      pitch: opts.pitch ?? 0.06,
      zoom: opts.zoom ?? 1,
      minZoom: opts.minZoom ?? 0.2,
      maxZoom: opts.maxZoom ?? 5,
      userZoom: opts.userZoom ?? true,
      sizeMode: opts.sizeMode ?? 'window',
      cameraZ: opts.cameraZ ?? 3.4,
      onFrame: opts.onFrame,
    };
  }

  mount({ canvasEl, onNoWebGL }: MountArgs): void {
    this.canvasEl = canvasEl;
    this.onNoWebGL = onNoWebGL;

    this._destroyed = false;
    this.userYaw = this.opts.yaw;
    this.userPitch = this.opts.pitch;
    this.zoom = this.opts.zoom;

    this.onResize = () => {
      if (!this.renderer || !this.camera) return;
      const renderer = this.renderer;
      const camera = this.camera;
      const elementSized = this.opts.sizeMode === 'element';
      // layout size, not getBoundingClientRect: the sensors stage CSS-scales
      // the canvas during the map cross-fade, and a resize measured off the
      // scaled rect bakes that factor into the renderer, throwing project()
      // (and the site pin riding on it) off for good
      const w = elementSized ? canvasEl.clientWidth : window.innerWidth;
      const h = elementSized ? canvasEl.clientHeight : window.innerHeight;
      if (w === 0 || h === 0) return;
      this.isMobile = window.innerWidth <= 720;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = elementSized ? this.opts.cameraZ : this.isMobile ? 4.3 : 3.4;
      camera.updateProjectionMatrix();
      const halfH = Math.tan((camera.fov * Math.PI / 180) / 2) * camera.position.z;
      this.halfWidth = halfH * camera.aspect;
      if (elementSized) {
        // the picker owns its whole box, so the earth sits centred
        this.group.position.set(0, 0, 0);
      } else if (this.isMobile) {
        // centered in the lower half, below the stacked hero copy
        this.group.position.set(0, -0.85, 0);
      } else {
        // earth sits right of center so the hero copy on the left stays clear
        this.group.position.set(this.halfWidth * 0.44, -0.04, 0);
      }
    };
    window.addEventListener('resize', this.onResize);

    this.initThree();
    if (this._noWebGL) {
      this.onNoWebGL?.();
      return;
    }
    // a canvas sized off its own box can change size without the window doing so
    if (this.opts.sizeMode === 'element' && typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this.onResize());
      this._ro.observe(canvasEl);
    }
    this.addDrag();
    this.onResize();
    // the canvas fades in off the first rendered frame instead of popping:
    // skeleton, stars and (when the texture beat the chunk) the earth all
    // materialize together
    this._shown = false;
    canvasEl.style.opacity = '0';
    canvasEl.style.transition = 'opacity 600ms ease';
    this.animate();
  }

  // the globe keeps a raf loop alive for nothing once the map stage covers it
  pause(): void {
    this._paused = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = undefined;
  }
  resume(): void {
    if (!this._paused) return;
    this._paused = false;
    if (!this._destroyed && !this._noWebGL) this.animate();
  }

  unmount(): void {
    this._destroyed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this.onResize);
    this._ro?.disconnect();
    if (this._dragCleanup) this._dragCleanup();
    if (this.renderer) this.renderer.dispose();
  }

  addDrag(): void {
    const el = this.canvasEl;
    el.style.cursor = 'grab';
    // the hero globe shares the page with scrollable content, so vertical
    // swipes stay with the browser; an element-sized globe (sensors stage)
    // owns a non-scrolling screen and takes every touch itself
    el.style.touchAction = this.opts.sizeMode === 'window' ? 'pan-y' : 'none';
    let dragging = false, lx = 0, ly = 0, pinchDist = 0;
    const pointers = new Map<number, { x: number; y: number }>();
    const pinchSpan = (): number => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const castFrom = (e: { clientX: number; clientY: number }): THREE.Raycaster => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, this.camera);
      return ray;
    };
    const overGlobe = (e: { clientX: number; clientY: number }): boolean =>
      castFrom(e).intersectObject(this.globeHit, false).length > 0;
    const down = (e: PointerEvent): void => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) { dragging = false; this._fly = undefined; pinchDist = pinchSpan(); return; }
      // only touches/clicks that start on the globe grab it - elsewhere the
      // canvas is inert background and scrolling stays untouched
      if (!overGlobe(e)) return;
      dragging = true; this._fly = undefined; el.style.cursor = 'grabbing'; lx = e.clientX; ly = e.clientY;
    };
    const move = (e: PointerEvent): void => {
      const p = pointers.get(e.pointerId);
      if (p) { p.x = e.clientX; p.y = e.clientY; }
      if (pointers.size === 2) {
        const d = pinchSpan();
        if (pinchDist > 0 && this.opts.userZoom) this.setZoom(this.zoom * d / pinchDist);
        pinchDist = d;
        return;
      }
      if (!dragging) {
        if (e.target === el) el.style.cursor = overGlobe(e) ? 'grab' : 'default';
        return;
      }
      // a drag at high zoom should move the same arc-length under the finger as
      // one at low zoom, so the rate scales down as the earth grows
      const rate = 0.006 / Math.max(1, this.zoom);
      this.userYaw += (e.clientX - lx) * rate;
      this.userPitch = Math.max(-1.1, Math.min(1.1, this.userPitch + (e.clientY - ly) * rate));
      lx = e.clientX; ly = e.clientY;
    };
    const up = (e: PointerEvent): void => {
      pointers.delete(e.pointerId);
      dragging = false;
      el.style.cursor = 'grab';
    };
    const cancel = (e: PointerEvent): void => { pointers.delete(e.pointerId); dragging = false; };
    const wheel = (e: WheelEvent): void => {
      // an inline widget must not hijack the page scroll. Trackpad pinch and
      // cmd/ctrl+wheel both arrive with a modifier set - those zoom, a plain
      // wheel is left alone and scrolls the page past the globe.
      if (!e.ctrlKey && !e.metaKey) return;
      if (!this.opts.userZoom) return; // zoom disabled: leave browser zoom alone
      if (!overGlobe(e)) return;
      e.preventDefault();
      this._fly = undefined;
      this.setZoom(this.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    this._dragCleanup = () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('wheel', wheel);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }

  setZoom(z: number): void {
    this.zoom = Math.max(this.opts.minZoom, Math.min(this.opts.maxZoom, z));
  }

  latLon(lat: number, lon: number, radius: number): Vec3Coords {
    const phi = (90 - lat) * Math.PI / 180, theta = (lon + 180) * Math.PI / 180;
    return {
      x: -radius * Math.sin(phi) * Math.cos(theta),
      y: radius * Math.cos(phi),
      z: radius * Math.sin(phi) * Math.sin(theta),
    };
  }
  faceRot(lat: number, lon: number): FaceRotation {
    const v = this.latLon(lat, lon, 1);
    return { rotY: -Math.atan2(v.x, v.z), rotX: Math.atan2(v.y, Math.sqrt(v.x*v.x + v.z*v.z)) };
  }

  // Ease the camera around to put (lat, lon) under the crosshair at `zoom`.
  // Yaw takes the short way round, so a fly from Japan to Ithaca crosses the
  // Pacific rather than unwinding all the way back across Asia.
  flyTo(lat: number, lon: number, zoom = this.zoom, dur = 1100): void {
    const aim = this.faceRot(lat, lon);
    const rawYaw = aim.rotY - this.baseRotY;
    const delta = ((((rawYaw - this.userYaw) + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI - Math.PI;
    this._fly = {
      yaw0: this.userYaw, yaw1: this.userYaw + delta,
      pitch0: this.userPitch, pitch1: Math.max(-1.1, Math.min(1.1, aim.rotX - this.baseRotX)),
      zoom0: this.zoom, zoom1: Math.max(this.opts.minZoom, Math.min(this.opts.maxZoom, zoom)),
      t0: performance.now(), dur,
    };
  }

  // Screen position (CSS px, relative to the canvas box) of a lat/lon, plus
  // whether it is on the near face of the earth rather than hidden behind it.
  project(lat: number, lon: number): Projected | null {
    if (!this.renderer) return null;
    const p = this.latLon(lat, lon, PIN_R);
    _pos.set(p.x, p.y, p.z);
    this.group.localToWorld(_pos);
    this.group.getWorldPosition(_center);
    _normal.copy(_pos).sub(_center);
    _toCam.copy(this.camera.position).sub(_pos);
    const visible = _normal.dot(_toCam) > 0;
    _pos.project(this.camera);
    this.renderer.getSize(_size);
    return {
      x: (_pos.x * 0.5 + 0.5) * _size.x,
      y: (-_pos.y * 0.5 + 0.5) * _size.y,
      visible,
    };
  }

  initThree(): void {
    const scene = new THREE.Scene();
    this.scene = scene;
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, this.opts.cameraZ);
    this.camera = camera;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: this.canvasEl, alpha: true, antialias: true });
    } catch (err) {
      console.error('[engine] WebGLRenderer construction failed:', err);
      this._noWebGL = true;
      return;
    }
    renderer.setClearColor(0x000000, 0);
    // three is pinned to exactly 0.150.1 in package.json - outputEncoding and
    // sRGBEncoding were removed in r152+ (use outputColorSpace/SRGBColorSpace if you ever bump).
    renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer = renderer;

    // low ambient + key from the LEFT: the right limb (west Africa on both
    // framings) falls into real shadow, so the desert reads as night side
    // instead of a yellow glow on the edge. No rim light - anything grazing
    // that limb relights the desert.
    scene.add(new THREE.AmbientLight(0x8fa6c4, 0.34));
    // z moderate: enough toward the camera that the disc reads lit with a soft
    // terminator on the right limb; push z much past this and it floodlights,
    // leaving no terminator at all
    const key = new THREE.DirectionalLight(0xffffff, 1.35); key.position.set(-4, 1.5, 2.6); scene.add(key);

    const group = new THREE.Group();
    this.group = group;
    group.scale.setScalar(1.25 * this.opts.zoom);
    scene.add(group);

    // invisible wheel-zoom hit sphere, slightly over the earth model's 0.571
    // surface radius (raycaster ignores the visible flag)
    const globeHit = new THREE.Mesh(new THREE.SphereGeometry(0.62), new THREE.MeshBasicMaterial());
    globeHit.visible = false;
    group.add(globeHit);
    this.globeHit = globeHit;

    // starfield
    const starGeo = new THREE.BufferGeometry();
    const sc = 900, sp = new Float32Array(sc * 3);
    for (let i = 0; i < sc; i++) {
      const rr = 18 + Math.random() * 20;
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, rxy = Math.sqrt(1 - u * u);
      sp[i*3] = rr * rxy * Math.cos(a); sp[i*3+1] = rr * u; sp[i*3+2] = rr * rxy * Math.sin(a);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x7d99a8, size: 0.09, transparent: true, opacity: 0.7 }));
    scene.add(stars);
    this.stars = stars;

    this.loadModels(group);

    const aim = this.faceRot(this.opts.aimLat, this.opts.aimLon);
    this.baseRotY = aim.rotY;
    this.baseRotX = aim.rotX;
    group.rotation.y = this.baseRotY;
    group.rotation.x = this.baseRotX;
  }

  loadModels(group: THREE.Group): void {
    // No model file at all: the earth is one UV sphere built here. Three's
    // SphereGeometry UVs are the standard equirectangular mapping and agree
    // with latLon() exactly (u = (lon+180)/360), so there is no fitted
    // rotation, no GLTFLoader chunk, and nothing to download but the texture.
    // Until the jpg lands this doubles as the dim skeleton sphere.
    const mat = new THREE.MeshStandardMaterial({ color: 0x16222e, roughness: 1 });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(SURFACE_R, 96, 64), mat);
    group.add(earth);

    // NASA Blue Marble at 4096x2048 (public domain). The file is stored
    // south-up (a glTF-era convention), so it loads with flipY off.
    const white = new THREE.Color(0xffffff);
    const dark = new THREE.Color(0x16222e);
    const tex = new THREE.TextureLoader().load('/earth-4k.jpg', () => {
      // upload now, off-screen, so the first frame that shows the earth does
      // not also pay for 4k mipmap generation - that stutter reads as a flash
      this.renderer?.initTexture(tex);
      mat.map = tex;
      mat.needsUpdate = true;
      // material color multiplies the map: ease it dark -> white so the
      // texture fades in over the skeleton instead of popping
      const t0 = performance.now();
      const fade = () => {
        const k = Math.min(1, (performance.now() - t0) / 500);
        mat.color.copy(dark).lerp(white, k);
        if (k < 1 && !this._destroyed) requestAnimationFrame(fade);
      };
      fade();
    });
    tex.flipY = false;
    tex.encoding = THREE.sRGBEncoding;
    if (this.renderer) tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
  }

  animate = (): void => {
    if (this._destroyed || this._paused || this._noWebGL || !this.renderer) return;
    const renderer = this.renderer;
    this._raf = requestAnimationFrame(this.animate);

    const fly = this._fly;
    if (fly) {
      const k = easeInOut(Math.min(1, (performance.now() - fly.t0) / fly.dur));
      this.userYaw = fly.yaw0 + (fly.yaw1 - fly.yaw0) * k;
      this.userPitch = fly.pitch0 + (fly.pitch1 - fly.pitch0) * k;
      this.zoom = fly.zoom0 + (fly.zoom1 - fly.zoom0) * k;
      if (k >= 1) this._fly = undefined;
    }

    this.group.rotation.y = this.baseRotY + this.userYaw;
    this.group.rotation.x = Math.max(-1.25, Math.min(1.25, this.baseRotX + this.userPitch));
    const targetScale = 1.25 * this.zoom;
    // the fly tween is already eased, so it drives scale directly; free-running
    // zoom is damped so wheel steps ease in instead of jumping
    if (fly) this.group.scale.setScalar(targetScale);
    else this.group.scale.setScalar(this.group.scale.x + (targetScale - this.group.scale.x) * 0.12);
    this.stars.rotation.y += 0.0004;

    renderer.render(this.scene, this.camera);
    if (!this._shown) {
      this._shown = true;
      // next frame, so the opacity:0 start point has been committed first
      requestAnimationFrame(() => { this.canvasEl.style.opacity = '1'; });
    }
    this.opts.onFrame?.();
  };
}
