import * as THREE from 'three';

// Framework-agnostic three.js voxel-globe engine. Mounted onto a <canvas> +
// a handful of overlay DOM nodes by Globe.tsx; has no React dependency itself.
export interface MountArgs {
  sceneEl: HTMLElement;
  canvasEl: HTMLCanvasElement;
  heroEl: HTMLElement;
  hintEl: HTMLElement;
  beatEls: (HTMLElement | null)[];
  dotEls: (HTMLElement | null)[];
}

interface Beat {
  lat: number;
  lon: number;
  color: number;
  rotY: number;
  rotX: number;
}

interface Pin {
  group: THREE.Group;
  core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  halo: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  color: number;
}

type Vec3Coords = { x: number; y: number; z: number };
type FaceRotation = { rotY: number; rotX: number };
// always a real PointerEvent at the call sites below (only pointerdown/move/up
// are wired up); `touches` is an optional duck-typed escape hatch preserved
// from the original defensive check, which never actually sees a TouchEvent.
type PointerLikeEvent = PointerEvent & { touches?: TouchList };
type VoxMesh = THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;

export class GlobeEngine {
  sceneEl!: HTMLElement;
  canvasEl!: HTMLCanvasElement;
  heroEl!: HTMLElement;
  hintEl!: HTMLElement;
  beatCards!: (HTMLElement | null)[];
  dots!: (HTMLElement | null)[];

  _destroyed = false;
  _noWebGL = false;
  _raf?: number;
  _dragCleanup?: () => void;

  time = 0;
  p = 0;
  halfWidth = 2.4;
  userYaw = 0;
  userPitch = 0;

  onScroll!: () => void;
  onResize!: () => void;

  // ---- three.js scene graph (all set unconditionally by initThree, before
  // the WebGL-availability gate that mount() checks prior to ever calling
  // animate/onResize/addDrag) ----
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer?: THREE.WebGLRenderer;
  group!: THREE.Group;

  BEATS!: Beat[];
  pins!: Pin[];
  stars!: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;

  sat!: THREE.Group;
  satBody!: THREE.Group;
  satPackets!: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>[];

  bigben!: THREE.Group;

  tethersonde!: THREE.Group;
  tetherBalloon!: THREE.Group;
  tetherLine!: VoxMesh;
  tetherPackets!: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>[];
  tetherH = 0.3;

  clocktower!: THREE.Group;

  algaeTiles!: VoxMesh[];
  lakeGroup!: THREE.Group;
  lakeHalf!: number;
  drone!: THREE.Group;
  rotors!: VoxMesh[];
  scanBeam!: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;

  mount({ sceneEl, canvasEl, heroEl, hintEl, beatEls, dotEls }: MountArgs): void {
    this.sceneEl = sceneEl;
    this.canvasEl = canvasEl;
    this.heroEl = heroEl;
    this.hintEl = hintEl;
    this.beatCards = beatEls;
    this.dots = dotEls;

    this._destroyed = false;
    this.time = 0;
    this.p = 0;
    this.halfWidth = 2.4;
    this.userYaw = 0;
    this.userPitch = 0;

    this.onScroll = () => {
      if (!this.sceneEl) return;
      const rect = this.sceneEl.getBoundingClientRect();
      const total = this.sceneEl.offsetHeight - window.innerHeight;
      this.p = total > 0 ? Math.max(0, Math.min(1, -rect.top / total)) : 0;
    };
    this.onResize = () => {
      if (!this.renderer || !this.camera) return;
      const renderer = this.renderer;
      const camera = this.camera;
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const halfH = Math.tan((camera.fov * Math.PI / 180) / 2) * camera.position.z;
      this.halfWidth = halfH * camera.aspect;
    };
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onResize);

    this.initThree();
    if (this._noWebGL) return;
    this.addDrag();
    this.onResize();
    this.onScroll();
    this.animate();
  }

  unmount(): void {
    this._destroyed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onResize);
    if (this._dragCleanup) this._dragCleanup();
    if (this.renderer) this.renderer.dispose();
  }

  addDrag(): void {
    const el = this.canvasEl;
    if (!el) return;
    el.style.cursor = 'grab';
    el.style.touchAction = 'pan-y';
    let dragging = false, lx = 0, ly = 0;
    const pos = (e: PointerLikeEvent): { clientX: number; clientY: number } =>
      (e.touches && e.touches[0]) ? e.touches[0] : e;
    const down = (e: PointerLikeEvent): void => { dragging = true; el.style.cursor = 'grabbing'; const p = pos(e); lx = p.clientX; ly = p.clientY; };
    const move = (e: PointerLikeEvent): void => {
      if (!dragging) return;
      const p = pos(e);
      this.userYaw += (p.clientX - lx) * 0.006;
      this.userPitch += (p.clientY - ly) * 0.006;
      this.userPitch = Math.max(-1.1, Math.min(1.1, this.userPitch));
      lx = p.clientX; ly = p.clientY;
    };
    const up = (): void => { dragging = false; el.style.cursor = 'grab'; };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    this._dragCleanup = () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }

  // ---- noise ----
  hash3(x: number, y: number, z: number): number { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
  noise3(x: number, y: number, z: number): number {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const sm = (t: number) => t * t * (3 - 2 * t);
    const u = sm(xf), v = sm(yf), w = sm(zf);
    const lp = (a: number, b: number, t: number) => a + (b - a) * t;
    const g = (dx: number, dy: number, dz: number) => this.hash3(xi + dx, yi + dy, zi + dz);
    const x00 = lp(g(0,0,0), g(1,0,0), u), x10 = lp(g(0,1,0), g(1,1,0), u);
    const x01 = lp(g(0,0,1), g(1,0,1), u), x11 = lp(g(0,1,1), g(1,1,1), u);
    return lp(lp(x00, x10, v), lp(x01, x11, v), w);
  }
  fbm(x: number, y: number, z: number): number { let f = 0, amp = 0.5, fr = 1; for (let i = 0; i < 4; i++) { f += amp * this.noise3(x*fr, y*fr, z*fr); fr *= 2; amp *= 0.5; } return f; }

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

  fbmLand(lat: number, lon: number): boolean {
    const v = this.latLon(lat, lon, 1);
    return this.fbm(v.x * 1.7 + 5, v.y * 1.7 + 9, v.z * 1.7 + 2) > 0.52;
  }

  buildEarth(group: THREE.Group, R: number): void {
    const N = 7200;
    const build = (sampler: (lat: number, lon: number) => boolean): void => {
      const box = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, flatShading: true });
      const inst = new THREE.InstancedMesh(box, mat, N);
      const dummy = new THREE.Object3D();
      const col = new THREE.Color();
      const s = Math.sqrt(4 * Math.PI * R * R / N);
      const gold = Math.PI * (3 - Math.sqrt(5));
      const D2R = Math.PI / 180;
      for (let i = 0; i < N; i++) {
        const y = 1 - (i / (N - 1)) * 2;
        const rad = Math.sqrt(Math.max(0, 1 - y * y));
        const th = gold * i;
        const nx = Math.cos(th) * rad, ny = y, nz = Math.sin(th) * rad;
        const lat = 90 - Math.acos(Math.max(-1, Math.min(1, ny))) / D2R;
        const lon = Math.atan2(nz, -nx) / D2R - 180;
        const isLand = sampler(lat, lon);
        const al = Math.abs(lat);
        const elev = this.fbm(nx * 2.4 + 5, ny * 2.4 + 9, nz * 2.4 + 2);
        let out = R, size = s * 1.02;
        if (al > 78 || (isLand && al > 66)) {         // polar caps + Greenland/Antarctica
          col.setRGB(0.85, 0.89, 0.93); out = R + 0.016;
        } else if (isLand) {
          const t = Math.min(1, elev * 1.4);
          col.setRGB(0.16 + t * 0.26, 0.42 + t * 0.13, 0.2 + t * 0.05);
          out = R + 0.026 + t * 0.024; size = s * 1.06;
        } else {
          const d = this.fbm(nx * 3 + 20, ny * 3, nz * 3);
          col.setRGB(0.03 + d * 0.03, 0.13 + d * 0.05, 0.2 + d * 0.05);
          size = s * 0.94;
        }
        dummy.position.set(nx * out, ny * out, nz * out);
        dummy.lookAt(0, 0, 0);
        dummy.scale.setScalar(size);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        inst.setColorAt(i, col);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      group.add(inst);
    };

    const img = new Image();
    img.onload = () => {
      let data: Uint8ClampedArray | null = null;
      const cw = 512, ch = 256;
      try {
        const c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        const ctx = c.getContext('2d');
        // if ctx is null the calls below throw synchronously and are caught,
        // leaving data === null — same fallback behavior as the untyped original
        ctx!.drawImage(img, 0, 0, cw, ch);
        data = ctx!.getImageData(0, 0, cw, ch).data;
      } catch {
        data = null;
      }
      if (data) {
        const d = data;
        // earth-water.png: water = white, land = dark
        build((lat, lon) => {
          let u = ((lon + 180) / 360) % 1; if (u < 0) u += 1;
          const v = Math.min(0.999, Math.max(0, (90 - lat) / 180));
          const px = Math.min(cw - 1, Math.floor(u * cw));
          const py = Math.min(ch - 1, Math.floor(v * ch));
          const idx = (py * cw + px) * 4;
          return (d[idx] + d[idx + 1] + d[idx + 2]) / 3 < 110;
        });
      } else {
        build(this.fbmLand.bind(this));
      }
    };
    img.onerror = () => build(this.fbmLand.bind(this));
    img.src = '/earth-water.png';
  }

  initThree(): void {
    const scene = new THREE.Scene();
    this.scene = scene;
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 3.4);
    this.camera = camera;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: this.canvasEl, alpha: true, antialias: true });
    } catch {
      this._noWebGL = true;
      return;
    }
    renderer.setClearColor(0x000000, 0);
    this.renderer = renderer;

    scene.add(new THREE.AmbientLight(0x8fa6c4, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(3, 2, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x5bb98a, 0.5); rim.position.set(-4, -1, -2); scene.add(rim);

    const group = new THREE.Group();
    this.group = group;
    scene.add(group);

    // ---- voxel earth (real geography, async land mask) ----
    const R = 1;
    this.buildEarth(group, R);

    // atmosphere glow
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.22, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x5bb98a, transparent: true, opacity: 0.06, side: THREE.BackSide, blending: THREE.AdditiveBlending })
    );
    group.add(glow);

    // ---- pins ----
    this.BEATS = ([
      { lat: 48, lon: -30, color: 0x6cc4e0 },
      { lat: 22, lon: -75, color: 0x4bb3a6 },
      { lat: -8, lon: 22,  color: 0xc98b5a },
      { lat: 35, lon: 108, color: 0x9b8ce0 },
      { lat: 6,  lon: -155, color: 0xe0b45a },
    ] as Array<{ lat: number; lon: number; color: number }>).map((b) => ({ ...b, ...this.faceRot(b.lat, b.lon) }));

    this.pins = this.BEATS.map((b): Pin => {
      const pinGroup = new THREE.Group();
      const pos = this.latLon(b.lat, b.lon, R + 0.06);
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 12, 12),
        new THREE.MeshStandardMaterial({ color: b.color, emissive: b.color, emissiveIntensity: 1.2, roughness: 0.4 })
      );
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 16, 16),
        new THREE.MeshBasicMaterial({ color: b.color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending })
      );
      pinGroup.add(core); pinGroup.add(halo);
      pinGroup.position.set(pos.x, pos.y, pos.z);
      group.add(pinGroup);
      return { group: pinGroup, core, halo, color: b.color };
    });

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

    // ---- cartoon voxel props ----
    this.buildSatellite(scene);
    this.buildBigBen(group, R);
    this.buildTethersonde(group, R);
    this.buildClocktower(group, R);
    this.buildAlgaeDrone(group, R);

    group.rotation.y = this.BEATS[0].rotY;
  }

  vox(parent: THREE.Object3D, w: number, h: number, d: number, color: THREE.ColorRepresentation, x: number, y: number, z: number, emissive?: THREE.ColorRepresentation): VoxMesh {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.15, flatShading: true,
        emissive: emissive || 0x000000, emissiveIntensity: emissive ? 0.9 : 0 })
    );
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  // tangent frame group planted on the globe surface
  surfaceGroup(parent: THREE.Object3D, lat: number, lon: number, radius: number): THREE.Group {
    const g = new THREE.Group();
    const p = this.latLon(lat, lon, radius);
    g.position.set(p.x, p.y, p.z);
    const normal = new THREE.Vector3(p.x, p.y, p.z).normalize();
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal); // local +Y -> outward normal
    parent.add(g);
    return g;
  }

  buildSatellite(scene: THREE.Scene): void {
    const sat = new THREE.Group();
    const body = new THREE.Group();
    this.vox(body, 0.13, 0.11, 0.11, 0x9fb0bd, 0, 0, 0);
    this.vox(body, 0.05, 0.05, 0.06, 0xe0b45a, 0, 0, 0.085);           // gold sensor face
    // solar panels
    for (const dir of [-1, 1]) {
      this.vox(body, 0.02, 0.09, 0.02, 0x8a97a3, dir * 0.11, 0, 0);    // strut
      this.vox(body, 0.19, 0.085, 0.012, 0x2a6fb0, dir * 0.26, 0, 0);
      for (let gx = -1; gx <= 1; gx++) this.vox(body, 0.004, 0.075, 0.016, 0x1b3f66, dir * 0.26 + gx * 0.055, 0, 0);
    }
    // dish
    const dish = this.vox(body, 0.055, 0.055, 0.02, 0xd8dee3, 0, 0.085, 0.02);
    dish.rotation.x = -0.5;
    sat.add(body);
    scene.add(sat);
    this.sat = sat; this.satBody = body;
    // downlink data packets (beamed to earth every 5s)
    this.satPackets = [0, 1, 2].map(() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03),
        new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }));
      m.visible = false; scene.add(m); return m;
    });
  }

  buildBigBen(group: THREE.Group, R: number): void {
    const g = this.surfaceGroup(group, 51.50, -0.124, R + 0.002); // Westminster, London
    const stone = 0xc2a86a, light = 0xd3bd82, roof = 0x4f6b52, cream = 0xf4edd6, gold = 0xd8b24a, scale = 0.72;
    this.vox(g, 0.078, 0.05, 0.078, stone, 0, 0.025, 0);   // base
    this.vox(g, 0.058, 0.44, 0.058, stone, 0, 0.25, 0);    // slender shaft
    for (let i = 1; i <= 3; i++) this.vox(g, 0.062, 0.012, 0.062, light, 0, 0.09 * i, 0); // string courses
    this.vox(g, 0.07, 0.07, 0.07, light, 0, 0.47, 0);      // clock stage
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const fx = dx * 0.037, fz = dz * 0.037;
      const w = dz ? 0.04 : 0.006, d = dx ? 0.04 : 0.006;
      this.vox(g, w + (dz?0.006:0), 0.046, d + (dx?0.006:0), gold, fx, 0.47, fz); // gold rim
      this.vox(g, w, 0.036, d, cream, fx * 1.04, 0.47, fz * 1.04);                // face
      this.vox(g, dz ? 0.018 : 0.004, 0.004, dx ? 0.018 : 0.004, 0x2a2a2a, fx * 1.06, 0.472, fz * 1.06);
      this.vox(g, 0.004, 0.014, 0.004, 0x2a2a2a, fx * 1.06, 0.47, fz * 1.06);
    }
    this.vox(g, 0.05, 0.05, 0.05, stone, 0, 0.525, 0);     // belfry
    // pointed spire roof
    const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4),
      new THREE.MeshStandardMaterial({ color: roof, roughness: 0.7, flatShading: true }));
    roofMesh.position.y = 0.63; roofMesh.rotation.y = Math.PI / 4; g.add(roofMesh);
    this.vox(g, 0.008, 0.05, 0.008, gold, 0, 0.73, 0);     // finial
    this.vox(g, 0.014, 0.014, 0.014, 0xe0b45a, 0, 0.76, 0, 0xe0b45a); // gold tip (last child)
    g.scale.setScalar(scale);
    this.bigben = g;
  }

  buildTethersonde(group: THREE.Group, R: number): void {
    const g = this.surfaceGroup(group, 34.5, -111.5, R + 0.001); // Arizona
    // ground station
    this.vox(g, 0.045, 0.02, 0.03, 0x3a444d, 0, 0.01, 0);
    this.vox(g, 0.008, 0.03, 0.008, 0x9aa4ac, 0.016, 0.028, 0); // little mast
    // stretchy tether line (rescaled each frame)
    this.tetherLine = this.vox(g, 0.004, 1, 0.004, 0x8a949c, 0, 0.5, 0);
    // balloon + sensor package (animated subgroup)
    const b = new THREE.Group();
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.055, 18, 14),
      new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.35, transparent: true, opacity: 0.94 }));
    balloon.position.y = 0.06; balloon.scale.y = 1.15; b.add(balloon);
    this.vox(b, 0.02, 0.014, 0.02, 0xe0b45a, 0, 0.005, 0); // sensor package
    this.vox(b, 0.004, 0.03, 0.004, 0xbfc7cd, 0, 0.022, 0); // neck
    g.add(b);
    // downlink data packets (beamed to ground every 5s)
    this.tetherPackets = [0, 1, 2].map(() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.016),
        new THREE.MeshBasicMaterial({ color: 0x9be0b4, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }));
      m.visible = false; g.add(m); return m;
    });
    g.scale.setScalar(0.9);
    this.tethersonde = g; this.tetherBalloon = b;
    this.tetherH = 0.3;
  }

  buildClocktower(group: THREE.Group, R: number): void {
    const g = this.surfaceGroup(group, 42.45, -76.48, R + 0.002); // Ithaca, NY
    const light = 0xb4ab9e, roof = 0x5d5852, cream = 0xf2ecdb, s0 = 0x9b9188;
    this.vox(g, 0.082, 0.05, 0.082, s0, 0, 0.025, 0);   // base
    this.vox(g, 0.06, 0.34, 0.06, s0, 0, 0.2, 0);       // shaft
    this.vox(g, 0.068, 0.055, 0.068, light, 0, 0.315, 0); // clock band
    // clock faces on all 4 sides
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const fx = dx * 0.036, fz = dz * 0.036;
      const w = dz ? 0.032 : 0.007, d = dx ? 0.032 : 0.007;
      this.vox(g, w, 0.032, d, cream, fx, 0.315, fz);
      this.vox(g, dz ? 0.02 : 0.004, 0.004, dx ? 0.02 : 0.004, 0x2a2a2a, fx, 0.318, fz); // hand
      this.vox(g, dz ? 0.004 : 0.004, 0.016, dx ? 0.004 : 0.004, 0x2a2a2a, fx, 0.315, fz); // hand
    }
    // battlement top + corner merlons
    this.vox(g, 0.074, 0.03, 0.074, s0, 0, 0.36, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      this.vox(g, 0.016, 0.025, 0.016, s0, sx * 0.028, 0.385, sz * 0.028);
    // pointed pyramidal roof
    const roofMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.058, 0.13, 4),
      new THREE.MeshStandardMaterial({ color: roof, roughness: 0.8, flatShading: true }));
    roofMesh.position.y = 0.45; roofMesh.rotation.y = Math.PI / 4; g.add(roofMesh);
    this.vox(g, 0.01, 0.05, 0.01, roof, 0, 0.53, 0);            // finial
    this.vox(g, 0.032, 0.02, 0.006, 0xB31B1B, 0.021, 0.55, 0);  // Cornell carnelian flag
    g.scale.setScalar(0.72);
    this.clocktower = g;
  }

  buildAlgaeDrone(group: THREE.Group, R: number): void {
    const b = this.BEATS[1]; // Water beat
    const g = this.surfaceGroup(group, b.lat, b.lon, R + 0.001);
    // ---- lake with algal-bloom tiles ----
    this.algaeTiles = [];
    const tile = 0.02, gridN = 9, rad = tile * 4.4;
    const lake = new THREE.Group(); g.add(lake); this.lakeGroup = lake;
    for (let ix = 0; ix < gridN; ix++) for (let iy = 0; iy < gridN; iy++) {
      const lx = (ix - (gridN - 1) / 2) * tile;
      const ly = (iy - (gridN - 1) / 2) * tile;
      if (Math.hypot(lx, ly) > rad) continue;
      const n = this.fbm(ix * 0.6 + 3, iy * 0.6 + 7, 1);
      const m = this.vox(lake, tile * 0.92, 0.008, tile * 0.92, 0x3fae2f, lx, 0.004, ly);
      m.userData = { lx, algae: new THREE.Color(0.24 + n * 0.22, 0.55 + n * 0.18, 0.16),
                     clean: new THREE.Color(0.07, 0.30 + n * 0.06, 0.44) };
      m.material.color.copy(m.userData.algae);
      this.algaeTiles.push(m);
    }
    this.lakeHalf = rad;
    // ---- drone ----
    const drone = new THREE.Group(); g.add(drone); this.drone = drone;
    this.vox(drone, 0.05, 0.022, 0.05, 0x33404a, 0, 0, 0);            // body
    this.vox(drone, 0.03, 0.014, 0.03, 0x5bb98a, 0, 0.016, 0, 0x2f7d54); // top light
    this.rotors = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      this.vox(drone, 0.014, 0.008, 0.014, 0x222a30, sx * 0.036, 0, sz * 0.036); // motor
      const rotor = this.vox(drone, 0.05, 0.004, 0.008, 0xcfd6db, sx * 0.036, 0.01, sz * 0.036);
      rotor.userData.spin = true;
      this.rotors.push(rotor);
    }
    // scanner beam (cone pointing down to lake)
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(0.03, 0.14, 4, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x5bb98a, transparent: true, opacity: 0.28,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
    );
    beam.rotation.x = Math.PI; beam.position.y = -0.075;
    drone.add(beam); this.scanBeam = beam;
    drone.position.set(-rad, 0.11, 0);
  }

  animate = (): void => {
    if (this._destroyed || this._noWebGL || !this.renderer) return;
    const renderer = this.renderer;
    this._raf = requestAnimationFrame(this.animate);
    this.time += 0.016;
    const p = this.p;
    const ease = (t: number) => t * t * (3 - 2 * t);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const B = this.BEATS, N = B.length;
    const bStart = 0.24, bEnd = 0.96;

    // takeover: hero (earth right, smaller) -> centered & large
    const t0 = ease(Math.min(p / 0.18, 1));
    this.group.scale.setScalar(lerp(0.9, 1.72, t0));
    this.group.position.x = lerp(this.halfWidth * 0.44, 0, t0);
    this.group.position.y = lerp(0.04, 0, t0);

    // target rotation
    let rotY, rotX;
    if (p <= bStart) {
      const a = bStart > 0 ? Math.min(p / bStart, 1) : 1;
      rotY = B[0].rotY - (1 - a) * (Math.PI * 0.55) + this.time * 0.02 * (1 - a);
      rotX = lerp(0, B[0].rotX, ease(a));
    } else if (p >= bEnd) {
      rotY = B[N-1].rotY; rotX = B[N-1].rotX;
    } else {
      const f = (p - bStart) / (bEnd - bStart) * (N - 1);
      const i = Math.floor(f), fr = ease(f - i);
      const b0 = B[i], b1 = B[Math.min(i + 1, N - 1)];
      let d = (b1.rotY - b0.rotY) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
      rotY = b0.rotY + d * fr;
      rotX = lerp(b0.rotX, b1.rotX, fr);
    }
    // add user drag offset on top of scroll-driven rotation
    rotY += this.userYaw;
    rotX = Math.max(-1.25, Math.min(1.25, rotX + this.userPitch));
    // damped follow
    let dy = (rotY - this.group.rotation.y) % (Math.PI * 2);
    if (dy > Math.PI) dy -= Math.PI * 2; if (dy < -Math.PI) dy += Math.PI * 2;
    this.group.rotation.y += dy * 0.09;
    this.group.rotation.x += (rotX - this.group.rotation.x) * 0.09;
    if (this.stars) this.stars.rotation.y += 0.0004;

    // active beat
    let active = -1;
    if (p > bStart - 0.03 && p < bEnd + 0.06) {
      active = Math.round((p - bStart) / (bEnd - bStart) * (N - 1));
      active = Math.max(0, Math.min(N - 1, active));
    }
    const span = (bEnd - bStart) / (N - 1);

    // overlays
    if (this.heroEl) {
      const o = Math.max(0, Math.min(1, 1 - p / 0.13));
      this.heroEl.style.opacity = String(o);
      this.heroEl.style.transform = `translateY(${(1 - o) * -26}px)`;
    }
    if (this.hintEl) this.hintEl.style.opacity = String(Math.max(0, 1 - p / 0.08));
    if (this.beatCards) {
      this.beatCards.forEach((el, i) => {
        if (!el) return;
        const pc = bStart + i * span;
        const o = Math.max(0, Math.min(1, 1 - Math.abs(p - pc) / (span * 0.62)));
        el.style.opacity = String(o);
        el.style.transform = `translateY(${(1 - o) * 24}px)`;
        el.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
      });
    }
    if (this.dots) this.dots.forEach((el, i) => {
      if (!el) return;
      const on = i === active;
      el.style.opacity = on ? '1' : '0.25';
      el.style.transform = on ? 'scale(1.7)' : 'scale(1)';
    });

    // satellite orbit (independent of earth surface spin)
    if (this.sat) {
      const sat = this.sat;
      const a = this.time * 0.42;
      const orbR = 1.5 * this.group.scale.x;
      const gx = this.group.position.x, gy = this.group.position.y;
      sat.position.set(
        gx + Math.cos(a) * orbR,
        gy + Math.sin(a) * 0.42 * orbR,
        Math.sin(a) * orbR
      );
      sat.scale.setScalar(this.group.scale.x);
      sat.lookAt(gx, gy, 0);
      if (this.satBody) this.satBody.rotation.y += 0.01;
      if (this.satPackets) {
        const satPackets = this.satPackets;
        const center = new THREE.Vector3(gx, gy, 0);
        const dir = sat.position.clone().sub(center).normalize();
        const target = center.clone().add(dir.multiplyScalar(this.group.scale.x));
        const cyc = this.time % 5, win = 1.4, on = cyc < win;
        satPackets.forEach((pk, i) => {
          const pr = (cyc / win) - i * 0.22;
          const vis = on && pr > 0 && pr < 1;
          pk.visible = vis;
          if (vis) { pk.position.lerpVectors(sat.position, target, pr); pk.scale.setScalar(this.group.scale.x); }
        });
      }
    }

    // big ben gold tip twinkle
    if (this.bigben) {
      const tip = this.bigben.children[this.bigben.children.length - 1] as VoxMesh | undefined;
      if (tip && tip.material && tip.material.emissiveIntensity !== undefined)
        tip.material.emissiveIntensity = 0.6 + Math.sin(this.time * 5) * 0.35;
    }
    // tethersonde: slow up/down loop + stretching tether + downlink beam
    if (this.tetherBalloon && this.tetherLine) {
      const tetherBalloon = this.tetherBalloon;
      const tetherLine = this.tetherLine;
      const h = 0.14 + (Math.sin(this.time * 0.32) * 0.5 + 0.5) * 0.34; // slow 0.14..0.48
      this.tetherH = h;
      tetherBalloon.position.y = h;
      tetherBalloon.rotation.z = Math.sin(this.time * 0.4) * 0.05;
      const topY = h - 0.002, botY = 0.02, len = Math.max(0.001, topY - botY);
      tetherLine.scale.y = len;
      tetherLine.position.y = (topY + botY) / 2;
      if (this.tetherPackets) {
        const tetherPackets = this.tetherPackets;
        const cyc = (this.time + 2.5) % 5, win = 1.4, on = cyc < win;
        const src = h + 0.005, dst = 0.03;
        tetherPackets.forEach((pk, i) => {
          const pr = (cyc / win) - i * 0.22;
          const vis = on && pr > 0 && pr < 1;
          pk.visible = vis;
          if (vis) pk.position.set(0, src + (dst - src) * pr, 0);
        });
      }
    }

    // drone scan over algal lake (Water beat = index 1)
    if (this.drone && this.algaeTiles) {
      const drone = this.drone;
      const algaeTiles = this.algaeTiles;
      const pcW = bStart + 1 * span;
      const scanRaw = (p - (pcW - span * 0.55)) / (span * 1.05);
      const prog = Math.max(0, Math.min(1, scanRaw));
      const half = this.lakeHalf;
      const beamX = -half + prog * (half * 2);
      const near = active === 1;
      drone.position.x = beamX;
      drone.position.y = 0.11 + Math.sin(this.time * 3) * 0.006; // hover bob
      drone.visible = prog > 0.001 && prog < 0.999 || near;
      if (this.scanBeam) this.scanBeam.material.opacity = near ? 0.30 + Math.sin(this.time * 8) * 0.08 : 0.12;
      if (this.rotors) this.rotors.forEach((r) => { r.rotation.y += 0.9; });
      algaeTiles.forEach((m) => {
        const cleaned = m.userData.lx <= beamX;
        const target = cleaned ? m.userData.clean : m.userData.algae;
        m.material.color.lerp(target, 0.15);
        // glow on the active scan line
        const onLine = Math.abs(m.userData.lx - beamX) < 0.014 && near;
        m.material.emissive.setRGB(onLine ? 0.2 : 0, onLine ? 0.5 : 0, onLine ? 0.35 : 0);
        m.material.emissiveIntensity = onLine ? 1 : 0;
      });
    }

    // pins
    if (this.pins) this.pins.forEach((pin, i) => {
      const on = i === active;
      const pulse = 1 + (on ? 0.35 + Math.sin(this.time * 4) * 0.18 : 0);
      pin.group.scale.setScalar(on ? pulse : 0.62);
      pin.core.material.emissiveIntensity = on ? 1.8 : 0.7;
      pin.halo.material.opacity = on ? 0.32 : 0.12;
    });

    renderer.render(this.scene, this.camera);
  };
}
