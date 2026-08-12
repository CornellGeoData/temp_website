import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Framework-agnostic three.js globe engine. Mounted onto a <canvas> by
// Globe.tsx; has no React dependency itself.
export interface MountArgs {
  canvasEl: HTMLCanvasElement;
  onTowerClick?: () => void;
}

type Vec3Coords = { x: number; y: number; z: number };
type FaceRotation = { rotY: number; rotX: number };

export class GlobeEngine {
  canvasEl!: HTMLCanvasElement;
  onTowerClick?: () => void;

  _destroyed = false;
  _noWebGL = false;
  _raf?: number;
  _dragCleanup?: () => void;

  time = 0;
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
  sat!: THREE.Group;
  satBody!: THREE.Group;
  towerHit?: THREE.Mesh; // set once the clocktower model loads
  globeHit!: THREE.Mesh; // invisible sphere over the earth, for wheel-zoom hit tests

  mount({ canvasEl, onTowerClick }: MountArgs): void {
    this.canvasEl = canvasEl;
    this.onTowerClick = onTowerClick;

    this._destroyed = false;
    this.time = 0;
    this.userYaw = 0;
    this.userPitch = 0;
    this.zoom = 1;

    this.onResize = () => {
      if (!this.renderer || !this.camera) return;
      const renderer = this.renderer;
      const camera = this.camera;
      const w = window.innerWidth, h = window.innerHeight;
      this.isMobile = w <= 720;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = this.isMobile ? 4.3 : 3.4;
      camera.updateProjectionMatrix();
      const halfH = Math.tan((camera.fov * Math.PI / 180) / 2) * camera.position.z;
      this.halfWidth = halfH * camera.aspect;
      // earth sits right of center so the hero copy on the left stays clear
      this.group.position.set(this.halfWidth * 0.44, 0.04, 0);
    };
    window.addEventListener('resize', this.onResize);

    this.initThree();
    if (this._noWebGL) return;
    this.addDrag();
    this.onResize();
    this.animate();
  }

  unmount(): void {
    this._destroyed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this.onResize);
    if (this._dragCleanup) this._dragCleanup();
    if (this.renderer) this.renderer.dispose();
  }

  addDrag(): void {
    const el = this.canvasEl;
    el.style.cursor = 'grab';
    el.style.touchAction = 'pan-y';
    let dragging = false, lx = 0, ly = 0, moved = 0, pinchDist = 0;
    const pointers = new Map<number, { x: number; y: number }>();
    const pinchSpan = (): number => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hits = (e: { clientX: number; clientY: number }, target: THREE.Mesh | undefined): boolean => {
      if (!target) return false;
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, this.camera);
      return ray.intersectObject(target, false).length > 0;
    };
    const overTower = (e: { clientX: number; clientY: number }): boolean => hits(e, this.towerHit);
    const down = (e: PointerEvent): void => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) { dragging = false; pinchDist = pinchSpan(); return; }
      dragging = true; moved = 0; el.style.cursor = 'grabbing'; lx = e.clientX; ly = e.clientY;
    };
    const move = (e: PointerEvent): void => {
      const p = pointers.get(e.pointerId);
      if (p) { p.x = e.clientX; p.y = e.clientY; }
      if (pointers.size === 2) {
        const d = pinchSpan();
        if (pinchDist > 0) this.zoom = Math.max(1, Math.min(3, this.zoom * d / pinchDist));
        pinchDist = d;
        return;
      }
      if (!dragging) {
        if (e.target === el) el.style.cursor = overTower(e) ? 'pointer' : 'grab';
        return;
      }
      moved += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly);
      this.userYaw += (e.clientX - lx) * 0.006;
      this.userPitch = Math.max(-1.1, Math.min(1.1, this.userPitch + (e.clientY - ly) * 0.006));
      lx = e.clientX; ly = e.clientY;
    };
    const up = (e: PointerEvent): void => {
      pointers.delete(e.pointerId);
      if (dragging && moved < 6 && e.target === el && this.onTowerClick && overTower(e)) this.onTowerClick();
      dragging = false;
      el.style.cursor = 'grab';
    };
    const cancel = (e: PointerEvent): void => { pointers.delete(e.pointerId); dragging = false; };
    // zoom only when the wheel is over the globe itself, so the rest of the
    // hero still scrolls the page normally (trackpad pinch arrives as
    // ctrl+wheel, so it works too)
    const wheel = (e: WheelEvent): void => {
      if (!hits(e, this.globeHit)) return;
      e.preventDefault();
      this.zoom = Math.max(1, Math.min(3, this.zoom * Math.exp(-e.deltaY * 0.0015)));
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    el.addEventListener('wheel', wheel, { passive: false });
    this._dragCleanup = () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      el.removeEventListener('wheel', wheel);
    };
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

  initThree(): void {
    const scene = new THREE.Scene();
    this.scene = scene;
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 3.4);
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
    renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer = renderer;

    scene.add(new THREE.AmbientLight(0x8fa6c4, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(3, 2, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x5bb98a, 0.5); rim.position.set(-4, -1, -2); scene.add(rim);

    const group = new THREE.Group();
    this.group = group;
    group.scale.setScalar(1.25);
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

    // empty satellite rig — the GLB is loaded into `body` by loadModels
    const sat = new THREE.Group();
    const body = new THREE.Group();
    sat.add(body);
    scene.add(sat);
    this.sat = sat; this.satBody = body;

    this.loadModels(group, 1);

    // aim ~8° south of the clocktower so it's framed above center at a
    // 3/4 angle rather than seen top-down
    const aim = this.faceRot(34.25, -104.79);
    this.baseRotY = aim.rotY;
    this.baseRotX = aim.rotX;
    group.rotation.y = this.baseRotY;
    group.rotation.x = this.baseRotX;
  }

  loadModels(group: THREE.Group, R: number): void {
    const loader = new GLTFLoader();
    // some exported models carry non-finite node transforms, which poison both
    // bounds measurement and rendering — repair them, then fit normally
    const finite3 = (p: { x: number; y: number; z: number }): boolean =>
      isFinite(p.x) && isFinite(p.y) && isFinite(p.z);
    const fit = (obj: THREE.Object3D, targetR: number): THREE.Group => {
      obj.traverse((o) => {
        if (!finite3(o.position)) o.position.set(0, 0, 0);
        if (!isFinite(o.quaternion.x) || !isFinite(o.quaternion.w)) o.quaternion.identity();
        if (!finite3(o.scale) || o.scale.x === 0 || o.scale.y === 0 || o.scale.z === 0) o.scale.set(1, 1, 1);
      });
      const sphere = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
      const wrap = new THREE.Group();
      if (isFinite(sphere.radius) && sphere.radius > 0) {
        obj.position.sub(sphere.center);
        wrap.scale.setScalar(targetR / sphere.radius);
      }
      wrap.add(obj);
      return wrap;
    };
    loader.load('/models/earth.glb', (gltf) => {
      const earth = fit(gltf.scene, R);
      // spin the model so its painted continents line up with the latLon math
      earth.rotation.y = 0.7;
      group.add(earth);
    });
    loader.load('/models/satellite.glb', (gltf) => {
      this.satBody.clear();
      this.satBody.add(fit(gltf.scene, 0.33));
    });
    loader.load('/models/clocktower.glb', (gltf) => {
      // the export bundles dozens of untextured near-black meshes that render
      // as a brown blob around the tower — drop them BEFORE fitting so the
      // bounds/centering come from the real textured tower only
      const junk: THREE.Object3D[] = [];
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!(mesh as { isMesh?: boolean }).isMesh) return;
        const mat = mesh.material;
        if (Array.isArray(mat) || !(mat as THREE.MeshBasicMaterial).map) junk.push(mesh);
      });
      junk.forEach((m) => m.parent?.remove(m));
      // Ithaca on this earth model's painted geography (click-calibrated);
      // 0.571 is the model's true surface radius after fit()
      const g = this.surfaceGroup(group, 42.25, -104.79, 0.571);
      const tower = fit(gltf.scene, 0.063);
      // ground the base exactly on the surface point
      const grounded = new THREE.Box3().setFromObject(tower);
      tower.position.y = -grounded.min.y;
      g.add(tower);
      // generous invisible click target — the tower itself is only a few px
      // wide on screen (raycaster ignores the visible flag)
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.09), new THREE.MeshBasicMaterial());
      hit.visible = false;
      hit.position.y = 0.06;
      g.add(hit);
      this.towerHit = hit;
    });
  }

  animate = (): void => {
    if (this._destroyed || this._noWebGL || !this.renderer) return;
    const renderer = this.renderer;
    this._raf = requestAnimationFrame(this.animate);
    this.time += 0.016;

    this.group.rotation.y = this.baseRotY + this.userYaw;
    this.group.rotation.x = Math.max(-1.25, Math.min(1.25, this.baseRotX + this.userPitch));
    // damped so wheel steps ease in instead of jumping
    const targetScale = 1.25 * this.zoom;
    this.group.scale.setScalar(this.group.scale.x + (targetScale - this.group.scale.x) * 0.12);
    this.stars.rotation.y += 0.0004;

    // satellite orbit (independent of earth surface spin)
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
    this.satBody.rotation.y += 0.01;

    renderer.render(this.scene, this.camera);
  };
}
