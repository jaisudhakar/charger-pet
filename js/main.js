import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PETS as HEROES, DEFAULT_PET, createPet, isCat } from './pets.js';
import { ACTIVITIES } from './activities.js';
import { ChargerIcon } from './charger.js';
import { Particles } from './particles.js';
import { BatteryMonitor, formatDuration } from './battery.js';
import { Favicon, Sfx, Awake } from './extras.js';

const $ = (id) => document.getElementById(id);
// Present when running inside the desktop (tray) app; see desktop/preload.cjs.
const desktop = window.chargerPetDesktop;
if (desktop) document.body.classList.add('desktop');
const FOV = 36;

// ---------------------------------------------------------------- settings
const SETTINGS_KEY = 'charger-pet:v1';
const settings = {
  hero: DEFAULT_PET,
  demo: false,
  transformOnPlug: true,
  keepAwake: true,
  sound: false,
};
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
} catch {}
// v2 made the cat the default pet.
if ((settings.version ?? 1) < 2) {
  settings.hero = DEFAULT_PET;
  settings.version = 2;
}
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

// ---------------------------------------------------------------- renderer
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
const lookTarget = new THREE.Vector3(0.3, 1.95, 0);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.45, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// Background gradient that shifts with the battery mood.
const bgCanvas = document.createElement('canvas');
bgCanvas.width = 2;
bgCanvas.height = 256;
const bgTexture = new THREE.CanvasTexture(bgCanvas);
bgTexture.colorSpace = THREE.SRGBColorSpace;
scene.background = bgTexture;
const MOOD_BG = {
  charging: ['#06281f', '#0b1530', '#04060f'],
  full: ['#1d3a10', '#0e1a33', '#04060f'],
  battery: ['#1a1747', '#0c1230', '#04060f'],
  low: ['#3a0d1c', '#160c26', '#04060f'],
};
function paintBackground(mode) {
  const g = bgCanvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  const [a, b, c] = MOOD_BG[mode];
  grad.addColorStop(0, a);
  grad.addColorStop(0.55, b);
  grad.addColorStop(1, c);
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  bgTexture.needsUpdate = true;
}

// ---------------------------------------------------------------- lights
const hemi = new THREE.HemisphereLight(0xbcd7ff, 0x1a1030, 1.1);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(-3, 7, 5);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -4;
key.shadow.camera.right = 4;
key.shadow.camera.top = 5;
key.shadow.camera.bottom = -2;
key.shadow.camera.near = 1;
key.shadow.camera.far = 20;
key.shadow.bias = -0.0008;
key.shadow.normalBias = 0.02;
scene.add(key);
const rim = new THREE.DirectionalLight(0x58ffd0, 1.6);
rim.position.set(3, 4, -5);
scene.add(rim);

// ---------------------------------------------------------------- stage
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(4.2, 64),
  new THREE.MeshStandardMaterial({ color: 0x141a36, roughness: 0.85, metalness: 0.1 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const ringMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x3dff7a, emissiveIntensity: 1.6 });
const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.03, 8, 128), ringMat);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.01;
scene.add(ring);

// Starfield
{
  const n = 500;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 20);
    v.y = Math.abs(v.y) * 0.8 + 1;
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xaab8ff, size: 0.12, sizeAttenuation: true }));
  stars.name = 'stars';
  scene.add(stars);
}

const charger = new ChargerIcon();
scene.add(charger.group);

const particles = new Particles();
scene.add(particles.group);

// Transform flash
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const flashBall = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), flashMat);
scene.add(flashBall);
const shockMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const shock = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 64), shockMat);
shock.rotation.x = -Math.PI / 2;
scene.add(shock);

// ---------------------------------------------------------------- heroes
const pet = new THREE.Group();
pet.position.y = charger.top;
scene.add(pet);

const rigs = new Map();
let mode = 'battery';
function getRig(id) {
  if (!rigs.has(id)) {
    const def = HEROES.find((h) => h.id === id);
    const r = createPet(def, { track: charger.halfWidth - (isCat(def) ? 0.85 : 0.55) });
    r.director.ctx.onBeat = () => {
      charger.bump(0.6);
      const p = new THREE.Vector3();
      r.hands[0].getWorldPosition(p);
      particles.burst(p, r.def.fx.colors, 6, 1.2);
    };
    r.director.onActivity = (name, label) => {
      if (r !== rig) return;
      $('activity').textContent = label;
      if (name === 'sleep') say('Zzz…', 3, 'sleepy');
    };
    rigs.set(id, r);
  }
  return rigs.get(id);
}

let heroIndex = Math.max(0, HEROES.findIndex((h) => h.id === settings.hero));
let rig = getRig(HEROES[heroIndex].id);
pet.add(rig.root);

// Hands the stage over to another pet, carrying the current battery mood along.
function mountRig(next) {
  pet.remove(rig.root);
  rig = next;
  pet.add(rig.root);
  rig.director.setMode(mode);
  rig.director.play(rig.director.current); // refreshes the activity label
}

let transform = null; // { t, from, to }

function switchHero(index, { animate = true, remote = false } = {}) {
  index = (index + HEROES.length) % HEROES.length;
  if (index === heroIndex && rig) return;
  const to = getRig(HEROES[index].id);
  heroIndex = index;
  settings.hero = HEROES[index].id;
  saveSettings();
  if (!remote) desktop?.heroChanged(settings.hero);
  updateHeroUI();
  if (!animate) {
    mountRig(to);
    return;
  }
  transform = { t: 0, from: rig, to, swapped: false };
  sfx.transform();
}

function updateTransform(dt) {
  if (!transform) return;
  transform.t += dt;
  const t = transform.t;
  const center = new THREE.Vector3(rig.root.position.x, charger.top + rig.height * 0.5, 0);
  if (!transform.swapped) {
    const k = Math.min(1, t / 0.28);
    rig.scaler.scale.setScalar((rig.def.scale ?? 1) * (1 - k * 0.9));
    transform.spin = (transform.spin ?? 0) + dt * 25;
    rig.root.rotation.y += transform.spin;
    if (k >= 1) {
      rig.scaler.scale.setScalar(rig.def.scale ?? 1);
      mountRig(transform.to);
      transform.swapped = true;
      flashMat.color.set(rig.def.colors.glow);
      shockMat.color.set(rig.def.colors.glow);
      particles.burst(center, [...rig.def.fx.colors, 0xffffff], 70, 4);
      document.body.classList.add('flash');
      setTimeout(() => document.body.classList.remove('flash'), 120);
      rig.director.play('cheer', 2.2);
      say(rig.def.lines[0], 2.4);
    }
  } else {
    const u = Math.min(1, (t - 0.28) / 0.55);
    const s = elasticOut(u);
    rig.scaler.scale.setScalar((rig.def.scale ?? 1) * (0.1 + 0.9 * s));
    if (u >= 1) transform = null;
  }
  const f = Math.min(1, t / 0.8);
  flashBall.position.copy(center);
  flashBall.scale.setScalar(0.3 + f * 1.4);
  flashMat.opacity = transform ? (1 - f) * (1 - f) * 0.45 : 0;
  shock.position.set(center.x, charger.top + 0.05, 0);
  shock.scale.setScalar(0.3 + f * 2.4);
  shockMat.opacity = transform ? (1 - f) * 0.8 : 0;
}

function elasticOut(x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
}

// ---------------------------------------------------------------- hero fx
const fxAcc = { v: 0 };
const tmpV = new THREE.Vector3();
const tmpVel = new THREE.Vector3();
function emitHeroFx(dt, energy) {
  const fx = rig.def.fx;
  fxAcc.v += fx.rate * dt * (1 + energy * 3);
  while (fxAcc.v >= 1) {
    fxAcc.v -= 1;
    const anchor = fx.from === 'feet' ? rig.anchors.feet : fx.from === 'head' ? rig.anchors.head : rig.anchors.body;
    anchor.getWorldPosition(tmpV);
    if (fx.from === 'around') {
      const r = fx.radius ?? 1;
      tmpV.x += (Math.random() - 0.5) * r * 2;
      tmpV.y += (Math.random() - 0.2) * r * 1.4;
      tmpV.z += (Math.random() - 0.5) * r;
    } else {
      tmpV.x += (Math.random() - 0.5) * 0.3;
      tmpV.y += (Math.random() - 0.5) * 0.2;
      tmpV.z += (Math.random() - 0.5) * 0.3;
    }
    tmpVel.randomDirection().multiplyScalar((fx.spread ?? 0.3) * fx.speed * 2);
    if (fx.dir === 'back') {
      const a = rig.root.rotation.y;
      tmpVel.x -= Math.sin(a) * fx.speed;
      tmpVel.z -= Math.cos(a) * fx.speed;
    } else if (fx.spread < 1) {
      tmpVel.y += fx.speed * (fx.rise ?? Math.sign(fx.gravity || 1));
    }
    const [s0, s1] = fx.size;
    const [l0, l1] = fx.life;
    particles.emit({
      pos: tmpV,
      vel: tmpVel,
      color: fx.colors[(Math.random() * fx.colors.length) | 0],
      size: (s0 + Math.random() * (s1 - s0)) * (1 + energy * 0.5),
      life: l0 + Math.random() * (l1 - l0),
      gravity: fx.gravity ?? 0,
      drag: 0.6,
      wobble: fx.wobble ?? 0,
      twinkle: fx.twinkle ?? 0,
      additive: fx.additive !== false,
    });
  }
}

// ---------------------------------------------------------------- speech bubble
const bubble = $('bubble');
let bubbleT = 0;
function say(text, seconds = 2.5, variant = '') {
  bubble.textContent = text;
  bubble.className = `bubble show ${variant}`;
  bubbleT = seconds;
}
function updateBubble(dt) {
  if (bubbleT > 0) {
    bubbleT -= dt;
    if (bubbleT <= 0) bubble.className = 'bubble';
  }
  rig.anchors.head.getWorldPosition(tmpV);
  tmpV.y += 0.15;
  tmpV.project(camera);
  const x = (tmpV.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-tmpV.y * 0.5 + 0.5) * window.innerHeight;
  bubble.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
}

const LINES = {
  plug: ['Power up! ⚡', 'Ooh, that tickles!', 'Charging mode: ON', 'Yum, electrons!'],
  unplug: ['Hey! I was eating!', 'Unplugged already?', 'Okay… battery mode.'],
  full: ['100%! I’m unstoppable!', 'Fully charged! 😎', 'All topped up!'],
  low: ['Plug me in… pleeease', 'Running low…', 'So… sleepy… need… power'],
};
const pick = (a) => a[(Math.random() * a.length) | 0];

// ---------------------------------------------------------------- battery
const battery = new BatteryMonitor();
const favicon = new Favicon();
const sfx = new Sfx();
const awake = new Awake();
sfx.enabled = settings.sound;
awake.enabled = settings.keepAwake;
let lastMode = null;
let lowNagT = 0;

function onBattery(e) {
  const { plugged, unplugged } = e.detail ?? {};
  charger.setLevel(battery.level);
  charger.setCharging(battery.charging);
  mode = battery.mode;
  if (mode !== lastMode) {
    paintBackground(mode);
    ringMat.emissive.set(mode === 'low' ? 0xff3b4a : mode === 'battery' ? 0x7a6bff : 0x3dff7a);
    rim.color.set(mode === 'low' ? 0xff5a7a : mode === 'battery' ? 0x8a7dff : 0x58ffd0);
    if (lastMode !== null && mode === 'full' && !plugged) say(pick(LINES.full), 3);
    lastMode = mode;
    rig.director.setMode(mode);
  }
  if (plugged) {
    sfx.plug();
    const p = new THREE.Vector3(charger.terminalX + 0.2, charger.top - 0.7, 0);
    particles.burst(p, [0x3dff7a, 0xfff27a, 0xffffff], 50, 3);
    charger.bump(1.2);
    // Cats just celebrate; heroes transform into another random hero.
    if (settings.transformOnPlug && !firstSync && !desktop && !isCat(HEROES[heroIndex])) {
      let next = heroIndex;
      while (next === heroIndex || isCat(HEROES[next])) next = (Math.random() * HEROES.length) | 0;
      switchHero(next);
    } else {
      rig.director.play('cheer', 2.6);
      say(pick(LINES.plug), 2.6);
    }
  } else if (unplugged) {
    sfx.unplug();
    rig.director.play('sad', 2.5);
    say(pick(LINES.unplug), 2.6);
  }
  updateHud();
  awake.set(battery.charging);
}
let firstSync = true;
battery.addEventListener('change', onBattery);

function updateHud() {
  const pct = Math.round(battery.level * 100);
  $('pct').textContent = pct;
  let status;
  if (battery.charging) {
    status = battery.level >= 0.995 ? 'Fully charged' : 'Charging';
    const eta = formatDuration(battery.chargingTime);
    if (eta && battery.level < 0.995) status += ` · ${eta} to full`;
  } else {
    status = battery.level < 0.2 ? 'Low battery — plug me in!' : 'On battery';
    const left = formatDuration(battery.dischargingTime);
    if (left) status += ` · ${left} left`;
  }
  if (battery.demo) status += battery.supported ? ' · demo' : ' · demo (no battery API)';
  $('status').textContent = status;
  document.body.dataset.mode = battery.mode;
  const plugBtn = $('plugBtn');
  plugBtn.hidden = !battery.demo;
  plugBtn.textContent = battery.charging ? 'Unplug cable' : 'Plug in cable';
  plugBtn.setAttribute('aria-pressed', String(battery.charging));
  const hero = HEROES[heroIndex];
  document.title = `${battery.charging ? '⚡ ' : ''}${pct}% · ${hero.name} — Charger Pet`;
  favicon.update({ level: battery.level, charging: battery.charging, color: '#' + new THREE.Color(hero.colors.glow).getHexString() });
}

// ---------------------------------------------------------------- UI
const dial = $('dial');
function buildDial(thumbs) {
  dial.innerHTML = '';
  HEROES.forEach((h, i) => {
    const b = document.createElement('button');
    b.className = 'dial-item';
    b.type = 'button';
    b.title = `${h.name} — ${h.power}`;
    b.setAttribute('aria-label', h.name);
    b.style.setProperty('--hero', '#' + new THREE.Color(h.colors.body).getHexString());
    b.style.setProperty('--hero-glow', '#' + new THREE.Color(h.colors.glow).getHexString());
    if (thumbs?.[i]) {
      const img = new Image();
      img.src = thumbs[i];
      img.alt = '';
      b.appendChild(img);
    } else {
      b.textContent = h.name[0];
    }
    b.addEventListener('click', () => {
      sfx.unlock();
      switchHero(i);
    });
    dial.appendChild(b);
  });
  updateHeroUI();
}

function updateHeroUI() {
  const h = HEROES[heroIndex];
  $('heroName').textContent = h.name;
  $('heroPower').textContent = h.power;
  $('heroNum').textContent = `${heroIndex + 1}/${HEROES.length}`;
  document.documentElement.style.setProperty('--hero-glow', '#' + new THREE.Color(h.colors.glow).getHexString());
  [...dial.children].forEach((b, i) => {
    b.classList.toggle('active', i === heroIndex);
    if (i === heroIndex) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  });
  if (battery) updateHud();
}

$('prevHero').addEventListener('click', () => { sfx.unlock(); switchHero(heroIndex - 1); });
$('nextHero').addEventListener('click', () => { sfx.unlock(); switchHero(heroIndex + 1); });
$('randomHero').addEventListener('click', () => {
  sfx.unlock();
  let n = heroIndex;
  while (n === heroIndex) n = (Math.random() * HEROES.length) | 0;
  switchHero(n);
});
$('plugBtn').addEventListener('click', () => { sfx.unlock(); battery.toggleDemoPlug(); });
desktop?.onSetHero((id) => {
  const i = HEROES.findIndex((h) => h.id === id);
  if (i >= 0) switchHero(i, { remote: true });
});

$('fullscreenBtn').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});

const sheet = $('settings');
$('settingsBtn').addEventListener('click', () => (sheet.hidden = !sheet.hidden));
$('closeSettings').addEventListener('click', () => (sheet.hidden = true));
function bindToggle(id, key, apply) {
  const el = $(id);
  el.checked = settings[key];
  el.addEventListener('change', () => {
    settings[key] = el.checked;
    saveSettings();
    apply?.(el.checked);
  });
}
bindToggle('optDemo', 'demo', (on) => battery.setDemo(on));
bindToggle('optTransform', 'transformOnPlug');
bindToggle('optAwake', 'keepAwake', (on) => { awake.enabled = on; awake.set(battery.charging); });
bindToggle('optSound', 'sound', (on) => { sfx.enabled = on; sfx.unlock(); });
$('demoLevel').addEventListener('input', (e) => {
  if (!battery.demo) {
    battery.setDemo(true);
    $('optDemo').checked = settings.demo = true;
    saveSettings();
  }
  battery.setDemoLevel(Number(e.target.value) / 100);
});

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.key === 'Escape') desktop?.hidePopup();
  if (e.key === 'ArrowRight') switchHero(heroIndex + 1);
  else if (e.key === 'ArrowLeft') switchHero(heroIndex - 1);
  else if (e.key === ' ' || e.key.toLowerCase() === 'p') { battery.setDemo(true); $('optDemo').checked = settings.demo = true; battery.toggleDemoPlug(); }
  else if (/^[0-9]$/.test(e.key)) switchHero(e.key === '0' ? 9 : Number(e.key) - 1);
});

// Drag to orbit the camera, tap the hero to make it react.
const raycaster = new THREE.Raycaster();
const orbit = { yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0, dragging: false, sx: 0, sy: 0, moved: 0, lastInput: -10 };
canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  orbit.dragging = true;
  orbit.sx = e.clientX;
  orbit.sy = e.clientY;
  orbit.moved = 0;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!orbit.dragging) return;
  const dx = e.clientX - orbit.sx;
  const dy = e.clientY - orbit.sy;
  orbit.moved += Math.abs(dx) + Math.abs(dy);
  orbit.sx = e.clientX;
  orbit.sy = e.clientY;
  orbit.targetYaw = THREE.MathUtils.clamp(orbit.targetYaw - dx * 0.006, -1.1, 1.1);
  orbit.targetPitch = THREE.MathUtils.clamp(orbit.targetPitch + dy * 0.004, -0.25, 0.45);
  orbit.lastInput = clock.elapsedTime;
});
canvas.addEventListener('pointerup', (e) => {
  orbit.dragging = false;
  if (orbit.moved > 8) return;
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObject(rig.root, true);
  if (hits.length) {
    sfx.boop();
    rig.director.play(Math.random() < 0.5 ? 'jump' : 'cheer', 1.8);
    say(pick(rig.def.lines), 2.2);
    rig.anchors.body.getWorldPosition(tmpV);
    particles.burst(tmpV, rig.def.fx.colors, 24, 2);
  } else {
    const hb = raycaster.intersectObject(charger.group, true);
    if (hb.length) {
      charger.bump(1);
      say(`${Math.round(battery.level * 100)}%${battery.charging ? ' and climbing!' : ''}`, 1.8);
    }
  }
});

// ---------------------------------------------------------------- layout
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;

  // Fit the stage into the free area between the top and bottom HUD panels.
  const topH = document.querySelector('.hud-top').getBoundingClientRect().bottom + 8;
  const bottomEl = document.querySelector('.hud-bottom').getBoundingClientRect();
  const sideBySide = bottomEl.left > w * 0.4;
  const botH = sideBySide ? 0 : h - bottomEl.top + 8;
  const free = Math.max(0.35, (h - topH - botH) / h);
  const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const fitH = 4.7 / (2 * tan * free);
  const fitW = (camera.aspect < 0.8 ? 5.8 : 6.4) / (2 * tan * camera.aspect * (sideBySide ? 0.55 : 1));
  camera.userData.dist = Math.max(fitH, fitW, 7);
  const shiftY = h / 2 - (topH + (h - topH - botH) / 2);
  const shiftX = sideBySide ? (w - bottomEl.left) / 2 : 0;
  camera.setViewOffset(w, h, shiftX, shiftY, w, h);
  camera.updateProjectionMatrix();
  particles.setViewport(h * renderer.getPixelRatio(), FOV);
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- thumbnails
function renderThumbnails() {
  try {
    const size = 128;
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(size, size);
    r.toneMapping = THREE.NeutralToneMapping;
    const s = new THREE.Scene();
    s.add(new THREE.HemisphereLight(0xffffff, 0x334466, 1.6));
    const d = new THREE.DirectionalLight(0xffffff, 2.2);
    d.position.set(-2, 3, 4);
    s.add(d);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    const out = [];
    for (const h of HEROES) {
      const rg = getRig(h.id);
      const parent = rg.root.parent;
      s.add(rg.root);
      rg.restPose();
      const top = rg.height + 0.15;
      const midY = top * (isCat(h) ? 0.5 : 0.62);
      cam.position.set(0.5, midY + 0.25, top * (isCat(h) ? 2.6 : 2.1));
      cam.lookAt(0, midY, 0);
      r.render(s, cam);
      out.push(r.domElement.toDataURL('image/png'));
      s.remove(rg.root);
      if (parent) parent.add(rg.root);
    }
    r.dispose();
    r.forceContextLoss();
    return out;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let started = false;
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  const t = clock.elapsedTime;

  battery.tick(dt);

  const energy = rig.animate(dt, t, battery.charging ? 0.25 : 0);
  updateTransform(dt);
  emitHeroFx(dt, energy);

  charger.update(t, dt);
  particles.update(dt, t);

  if (!battery.charging && battery.level < 0.2) {
    lowNagT -= dt;
    if (lowNagT <= 0) {
      lowNagT = 14;
      say(pick(LINES.low), 2.8);
    }
  }

  // Camera: gentle auto-sway, drag to orbit, eases back after a while.
  if (!orbit.dragging && t - orbit.lastInput > 4) {
    orbit.targetYaw *= 1 - Math.min(1, dt * 0.8);
    orbit.targetPitch *= 1 - Math.min(1, dt * 0.8);
  }
  orbit.yaw += (orbit.targetYaw - orbit.yaw) * Math.min(1, dt * 6);
  orbit.pitch += (orbit.targetPitch - orbit.pitch) * Math.min(1, dt * 6);
  const yaw = orbit.yaw + Math.sin(t * 0.25) * 0.12;
  const pitch = 0.18 + orbit.pitch + Math.sin(t * 0.33) * 0.02;
  const dist = camera.userData.dist;
  camera.position.set(
    lookTarget.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    lookTarget.y + Math.sin(pitch) * dist,
    Math.cos(yaw) * Math.cos(pitch) * dist,
  );
  camera.lookAt(lookTarget);

  ringMat.emissiveIntensity = 1.2 + Math.sin(t * 2) * 0.4 + (battery.charging ? 0.8 : 0);
  scene.getObjectByName('stars').rotation.y = t * 0.01;

  updateBubble(dt);
  composer.render();
  if (!started) {
    started = true;
    document.body.classList.add('ready');
  }
  requestAnimationFrame(frame);
}

async function start() {
  paintBackground('battery');
  buildDial(null);
  await battery.init();
  if (settings.demo) battery.setDemo(true);
  $('optDemo').checked = battery.demo;
  $('optDemo').disabled = !battery.supported;
  firstSync = false;
  requestAnimationFrame(frame);
  // Thumbnails render after the first frame so the scene shows up quickly.
  setTimeout(() => {
    const thumbs = renderThumbnails();
    if (thumbs) buildDial(thumbs);
  }, 300);
}

start();

if ('serviceWorker' in navigator && location.protocol !== 'file:' && !desktop) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// Expose a tiny handle for debugging and automated checks.
window.chargerPet = { battery, switchHero, get director() { return rig.director; }, ACTIVITIES, get hero() { return HEROES[heroIndex].id; } };
