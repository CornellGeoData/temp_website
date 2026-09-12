import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import URDFLoader from 'urdf-loader';
import { animationPose, phaseForJoint } from './motion.js';
import { describePart } from './parts.js';

const $ = id => document.getElementById(id);
const LEGS = ['lf', 'lm', 'lr', 'rf', 'rm', 'rr'];
const KINDS = ['coxa_yaw', 'femur_pitch', 'tibia_pitch'];
const NAMES = { lf: 'Left front', lm: 'Left middle', lr: 'Left rear', rf: 'Right front', rm: 'Right middle', rr: 'Right rear' };
const TINT = { body: 0xcad7e5, coxa: 0xb49ddc, femur: 0x8dbdff, tibia: 0x80ddba, tibia_push_lever: 0xf3bc72, tibia_pushrod: 0xea9490 };
const BASE = new URL('/hexapod/model/', location.href);
const rad = THREE.MathUtils.degToRad;
const deg = THREE.MathUtils.radToDeg;

async function start() {
  const fetchFile = async path => {
    const response = await fetch(new URL(path, BASE));
    if (!response.ok) throw new Error(`Could not load ${path}. Please reload to try again.`);
    return response;
  };
  const [stance, limits, models] = await Promise.all(
    ['stance_v2.json', 'joint_limits.json', 'models.json'].map(async path => (await fetchFile(path)).json()),
  );
  const stancePose = Object.fromEntries(LEGS.flatMap(leg => KINDS.map(kind => [`${leg}_${kind}`, stance[`${kind}_rad`]])));
  let q = { ...stancePose }, robot, selectedPart, footSpheres = [], ready = false;
  let motorHousings = [];
  let playing = false, phase = 0, lastTime = 0, motionTime = 0, animationBase = {};
  let frame = 0;
  function requestRender() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(render);
  }
  const geometries = new Map();
  const stage = $('view');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0e141c');
  scene.fog = new THREE.Fog('#0e141c', 1.8, 4);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.005, 20);
  camera.up.set(0, 0, 1);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.append(renderer.domElement);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.12;
  orbit.minDistance = 0.25;
  orbit.maxDistance = 3;
  orbit.listenToKeyEvents(stage);
  orbit.addEventListener('change', requestRender);
  scene.add(new THREE.HemisphereLight(0xecf5ff, 0x43505f, 2));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(1, -1.3, 2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fcfff, 1);
  rim.position.set(-1, 0.6, 1);
  scene.add(rim);
  const grid = new THREE.GridHelper(4, 80, 0x293b47, 0x1c2a36);
  grid.rotation.x = Math.PI / 2;
  scene.add(grid);
  let framing = 1;
  // the panel starts closed, so the robot opens dead centre; the offsets below
  // only step it aside while the panel is actually covering that corner
  const panel = document.querySelector('.panel');
  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    const nextFraming = width > 720 ? 1 : Math.max(1, height / width * 0.9);
    camera.position.sub(orbit.target).multiplyScalar(nextFraming / framing).add(orbit.target);
    framing = nextFraming;
    orbit.maxDistance = Math.max(3, framing * 2);
    camera.aspect = width / height;
    // Reserve room for the floating panel without shrinking the canvas.
    const wide = width > 720;
    camera.setViewOffset(width, height, panel.open && wide ? -140 : 0, panel.open && !wide ? height * 0.22 : 0, width, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    requestRender();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  panel.addEventListener('toggle', resize);
  resize();
  const views = { iso: [0.90, -1.05, 0.68], top: [0, -0.001, 1.5], front: [0, -1.4, 0.25], side: [1.4, 0, 0.25] };
  function setView(name) {
    orbit.target.set(0, 0, 0.13);
    camera.position.set(...views[name]).sub(orbit.target).multiplyScalar(framing).add(orbit.target);
    orbit.update();
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', button.dataset.view === name));
  }
  document.querySelectorAll('[data-view]').forEach(button => { button.onclick = () => setView(button.dataset.view); });
  setView('iso');

  const colliderAncestor = object => { for (let node = object; node; node = node.parent) if (node.isURDFCollider) return node; return null; };
  const linkAncestor = object => { for (let node = object; node; node = node.parent) if (node.isURDFLink) return node; return null; };
  function indexMotors() {
    motorHousings = [];
    for (const leg of LEGS) for (const segment of ['coxa', 'femur']) {
      const link = robot.links[`${leg}_${segment}`];
      const housings = [];
      link.traverse(mesh => {
        if (mesh.userData.file === 'motor_1_1_06_eb463_507.stl') housings.push(mesh);
      });
      // The housing at the femur pivot drives the femur; the second drives the tibia.
      const distance = mesh => link.worldToLocal(mesh.getWorldPosition(new THREE.Vector3())).lengthSq();
      housings.sort((a, b) => distance(a) - distance(b));
      housings.forEach((mesh, index) => motorHousings.push({ mesh, leg, kind: segment === 'coxa' ? 'coxa' : index === 0 ? 'femur' : 'tibia' }));
    }
  }
  function motorForPart(mesh, link) {
    const [leg, segment] = link.name.split('_');
    const kinds = segment === 'coxa' ? ['coxa', 'femur'] : segment === 'femur' ? ['femur', 'tibia'] : segment === 'tibia' ? ['tibia'] : ['coxa'];
    const candidates = motorHousings.filter(motor => (link.name === 'body' || motor.leg === leg) && kinds.includes(motor.kind));
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const position = mesh.localToWorld(mesh.geometry.boundingBox.getCenter(new THREE.Vector3()));
    // A hub or bearing can live on the adjacent link. Match its center to the
    // actuator axis, not to the link name or the mesh's arbitrary CAD origin.
    const distance = motor => {
      const axis = new THREE.Vector3(0, 0, 1).transformDirection(motor.mesh.matrixWorld);
      const delta = position.clone().sub(motor.mesh.getWorldPosition(new THREE.Vector3()));
      return delta.lengthSq() - delta.dot(axis) ** 2;
    };
    return candidates.reduce((nearest, candidate) => distance(candidate) < distance(nearest) ? candidate : nearest);
  }
  const collisionMaterial = new THREE.MeshBasicMaterial({ color: 0x80ddba, wireframe: true, transparent: true, opacity: 0.45, depthTest: false });
  function paint() {
    robot?.traverse(object => {
      if (!object.isMesh) return;
      const collision = Boolean(colliderAncestor(object));
      object.userData.collision = collision;
      object.visible = !collision || $('collisions').checked;
      if (collision) { object.material = collisionMaterial; object.renderOrder = 1; return; }
      if (!object.userData.cadColor) { object.material = object.material.clone(); object.userData.cadColor = object.material.color.clone(); }
      const link = linkAncestor(object)?.name || 'body';
      const kind = link === 'body' ? 'body' : link.split('_').slice(1).join('_');
      object.material.color.copy(object.userData.cadColor);
      if ($('colors').checked) object.material.color.setHex(TINT[kind] || TINT.body);
      object.material.emissive.setHex(link.startsWith(`${$('leg').value}_`) ? 0x123a29 : 0x000000);
      if (object === selectedPart) {
        object.material.color.setHex(0xfff000);
        object.material.emissive.setHex(0x665500);
      }
    });
    requestRender();
  }
  function clearPart() {
    selectedPart = null;
    $('point-info').hidden = true;
    paint();
  }
  for (const id of ['collisions', 'colors']) $(id).onchange = paint;

  function syncControls(editing = false) {
    for (const kind of KINDS) {
      const value = deg(q[`${$('leg').value}_${kind}`]);
      $(`s_${kind}`).value = value;
      if (!editing || document.activeElement !== $(`n_${kind}`)) $(`n_${kind}`).value = value.toFixed(1);
    }
  }
  function setPose(values, editing = false) {
    q = { ...values };
    for (const [name, value] of Object.entries(q)) robot?.setJointValue(name, value);
    syncControls(editing);
    if (robot && footSpheres.length) {
      robot.updateMatrixWorld(true);
      const lowest = Math.min(...footSpheres.map(({ link, center, radius }) => center.clone().applyMatrix4(robot.links[link].matrixWorld).z - radius));
      $('clearance').textContent = `${(lowest * 1000).toFixed(1)} mm`;
      $('clearance').style.color = lowest < 0 ? '#ffb6ac' : '';
    }
    requestRender();
  }
  function pause() {
    playing = false;
    $('play').setAttribute('aria-pressed', 'false');
    $('play').querySelector('span').textContent = 'Play motion';
    $('play').querySelector('path').setAttribute('d', 'm5 3 7 5-7 5Z');
  }
  function manualJoint(kind, value) {
    pause();
    if (!Number.isFinite(value)) { syncControls(); return; }
    const { lower, upper } = limits[kind];
    setPose({ ...q, [`${$('leg').value}_${kind}`]: THREE.MathUtils.clamp(rad(value), lower, upper) }, true);
  }
  for (const kind of KINDS) {
    const row = document.createElement('div');
    const label = kind.split('_')[0];
    const name = label[0].toUpperCase() + label.slice(1);
    row.className = 'joint';
    row.innerHTML = `<div class="joint-heading"><label for="s_${kind}">${name}</label><div class="joint-value"><input id="n_${kind}" type="number" step="0.1" aria-label="${name} angle in degrees"/><span>°</span></div></div><input id="s_${kind}" type="range" step="0.1" aria-label="${name} joint"/>`;
    $('joints').append(row);
    for (const prefix of ['s', 'n']) {
      const input = $(`${prefix}_${kind}`);
      input.min = Math.ceil(deg(limits[kind].lower) * 10) / 10;
      input.max = Math.floor(deg(limits[kind].upper) * 10) / 10;
    }
    $(`s_${kind}`).oninput = event => manualJoint(kind, event.target.valueAsNumber);
    $(`n_${kind}`).oninput = event => { if (Number.isFinite(event.target.valueAsNumber)) manualJoint(kind, event.target.valueAsNumber); };
    $(`n_${kind}`).onblur = () => syncControls();
  }
  $('leg').onchange = () => { pause(); syncControls(); clearPart(); };
  $('reset').onclick = () => { pause(); setPose(stancePose); };

  function disposeRobot(previous) {
    if (!previous) return;
    scene.remove(previous);
    previous.traverse(object => {
      if (object.material && object.material !== collisionMaterial) object.material.dispose();
      if (object.geometry && !object.userData.file) object.geometry.dispose();
    });
  }
  async function loadModel(mode) {
    pause();
    clearPart();
    ready = false;
    $('model').disabled = $('joint-controls').disabled = $('motion-controls').disabled = true;
    $('loading').hidden = false;
    $('load-message').textContent = 'Opening the hexapod…';
    const spec = models[mode];
    const text = await (await fetchFile(spec.urdf)).text();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    if ([...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('') !== spec.sha256) throw new Error('The robot model does not match its source. Please reload.');
    const xml = new DOMParser().parseFromString(text, 'application/xml');
    footSpheres = [...xml.querySelectorAll('link')].filter(link => link.getAttribute('name').endsWith('_tibia')).flatMap(link => [...link.querySelectorAll('collision')].filter(c => c.querySelector('sphere')).map(c => ({ link: link.getAttribute('name'), center: new THREE.Vector3(...c.querySelector('origin').getAttribute('xyz').split(/\s+/).map(Number)), radius: Number(c.querySelector('sphere').getAttribute('radius')) })));
    $('mass').textContent = `${[...xml.querySelectorAll('inertial > mass')].reduce((sum, node) => sum + Number(node.getAttribute('value')), 0).toFixed(2)} kg`;
    const loader = new URDFLoader();
    loader.packages = { hexapod_mkii_assy: BASE.href };
    loader.parseCollision = true;
    const pending = [];
    loader.loadMeshCb = (path, manager, done) => {
      if (!geometries.has(path)) geometries.set(path, new STLLoader(manager).loadAsync(path).then(geometry => { geometry.computeVertexNormals(); return geometry; }));
      pending.push(geometries.get(path).then(geometry => {
        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xc0ccdb, metalness: 0.28, roughness: 0.5 }));
        mesh.userData.file = path.split('/').pop();
        done(mesh);
      }));
    };
    const next = loader.parse(text, BASE.href);
    await Promise.all(pending);
    disposeRobot(robot);
    robot = next;
    robot.position.z = stance.reset_root_height_m;
    scene.add(robot);
    paint();
    setPose(q);
    indexMotors();
    $('model-info').textContent = mode === 'linkage' ? 'Linkage' : 'Serial';
    $('model').disabled = $('joint-controls').disabled = $('motion-controls').disabled = false;
    $('loading').hidden = true;
    ready = true;
  }
  $('model').onchange = () => loadModel($('model').value).catch(showError);
  $('play').onclick = () => {
    if (playing) { pause(); return; }
    if (!ready) return;
    animationBase = { ...q };
    const kind = $('motion-joint').value;
    if ($('motion').value === 'joint') phase = phaseForJoint(q[`${$('leg').value}_${kind}`], limits[kind].lower, limits[kind].upper);
    motionTime = 0;
    lastTime = performance.now();
    playing = true;
    $('play').setAttribute('aria-pressed', 'true');
    $('play').querySelector('span').textContent = 'Pause motion';
    $('play').querySelector('path').setAttribute('d', 'M4 3h3v10H4ZM9 3h3v10H9Z');
    requestRender();
  };
  for (const id of ['motion', 'motion-joint']) $(id).onchange = () => {
    pause();
    phase = 0;
    $('sweep-controls').hidden = $('motion').value !== 'joint';
  };
  const raycaster = new THREE.Raycaster();
  let pointerStart;
  renderer.domElement.addEventListener('pointerdown', event => { pointerStart = [event.clientX, event.clientY]; });
  renderer.domElement.addEventListener('pointerup', event => {
    if (!ready || !pointerStart || Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
    const hit = raycaster.intersectObject(robot, true).find(hit => hit.object.isMesh && hit.object.visible && !hit.object.userData.collision);
    if (!hit) { clearPart(); return; }
    selectedPart = hit.object;
    const link = linkAncestor(hit.object);
    const part = describePart(hit.object.userData.file);
    const motor = part.motor ? motorForPart(hit.object, link) : null;
    const leg = motor?.leg || link.name.split('_')[0];
    if (LEGS.includes(leg)) { $('leg').value = leg; pause(); syncControls(); }
    paint();
    $('point-details').replaceChildren();
    const title = document.createElement('strong');
    title.textContent = motor ? `${motor.kind[0].toUpperCase()}${motor.kind.slice(1)} ${part.name.toLowerCase()}` : part.name;
    const location = document.createElement('p');
    location.textContent = NAMES[leg] || 'Body';
    $('point-details').append(title, location);
    $('point-info').hidden = false;
  });
  $('close-point').onclick = clearPart;
  window.addEventListener('keydown', event => { if (event.key === 'Escape') { pause(); clearPart(); } });
  function render(now) {
    frame = 0;
    if (playing && ready) {
      const dt = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
      motionTime += dt;
      phase += dt * Number($('speed').value) * 2 * Math.PI / ($('motion').value === 'gait' ? 1.6 : 8);
      lastTime = now;
      setPose(animationPose({ mode: $('motion').value, phase, basePose: animationBase, stancePose, legs: LEGS, kinds: KINDS, limits, leg: $('leg').value, joint: $('motion-joint').value, transition: Math.min(motionTime * 2, 1) }));
    }
    orbit.update();
    renderer.render(scene, camera);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pause();
      cancelAnimationFrame(frame);
      frame = 0;
    } else requestRender();
  });
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    orbit.dispose();
    disposeRobot(robot);
    geometries.forEach(promise => promise.then(geometry => geometry.dispose()).catch(() => {}));
    collisionMaterial.dispose();
    grid.geometry.dispose();
    grid.material.dispose();
    renderer.dispose();
  });
  await loadModel('linkage');
  setPose(stancePose);
}

function showError(error) {
  $('loading').hidden = false;
  $('loading').dataset.error = 'true';
  $('load-message').textContent = error.message || 'The model could not be opened. Please reload.';
}
start().catch(showError);
