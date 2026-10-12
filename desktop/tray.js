// Renders the tray / top-bar icon: a tiny 3D hero acting out the battery state while
// standing on a mini charge icon. Frames are sent to the Electron main process, which
// swaps them into the tray at a few frames per second (like RunCat).
import * as THREE from 'three';
import { HEROES, buildHero, applyPose, updateHero } from '../js/characters.js';
import { Director } from '../js/activities.js';

const bridge = window.chargerPetDesktop;
const params = new URLSearchParams(location.search);
const SIZE = Number(params.get('size')) || 44;
const FPS = Number(params.get('fps')) || 10;
let dark = params.get('dark') !== '0';

// Small activities only: big jumps and flips would leave the icon frame.
const TRAY_POOLS = {
  charging: ['dance', 'cheer', 'run', 'spin', 'powerup', 'pump', 'wave', 'dance'],
  full: ['cheer', 'dance', 'spin', 'wave'],
  battery: ['idle', 'wave', 'idle', 'stretch', 'run'],
  low: ['sad', 'sleep', 'sad'],
};

// Layout of the icon (in icon pixels).
const BAT_H = Math.round(SIZE * 0.3);
const BAT_Y = SIZE - BAT_H - Math.max(1, Math.round(SIZE / 44));
const PET_H = BAT_Y + Math.round(SIZE * 0.06); // pet's feet sink slightly into the battery top
const SS = 3; // supersampling for smooth edges

let gl = null;
try {
  gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  gl.setPixelRatio(1);
  gl.setSize(SIZE * SS, PET_H * SS, false);
  gl.setClearColor(0x000000, 0);
  gl.toneMapping = THREE.NeutralToneMapping;
} catch {
  // No WebGL at all: keep a working (non-3D) battery icon rather than no icon.
  gl = null;
}

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x445577, 1.7));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(-2, 4, 5);
scene.add(key);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);

const out = document.getElementById('preview');
out.width = out.height = SIZE;
const g = out.getContext('2d');

const director = new Director({ pools: TRAY_POOLS });
director.ctx.track = 0.32;

let rig = null;
let heroId = params.get('hero') || 'volt';
const rigs = new Map();

function setHero(id) {
  const def = HEROES.find((h) => h.id === id) ?? HEROES[1];
  heroId = def.id;
  if (rig) scene.remove(rig.root);
  if (!rigs.has(def.id)) rigs.set(def.id, buildHero(def));
  rig = rigs.get(def.id);
  scene.add(rig.root);
  director.ctx.legLen = rig.legLen;
  // Frame the hero: feet on the bottom edge, head + accessories inside the top.
  const top = (rig.height + (def.topExtra ?? 0.1) * 0.7) * (def.scale ?? 1) + 0.12;
  // Wide heroes (raised arms) need a bigger frame so they are not clipped at the sides.
  const reach = (def.arms.x + def.arms.len + (def.arms.hand ?? 0.1)) * (def.scale ?? 1);
  const half = Math.max(top / 2, reach * (PET_H / SIZE));
  camera.left = -half * (SIZE / PET_H);
  camera.right = half * (SIZE / PET_H);
  camera.top = half;
  camera.bottom = -half;
  // A slight top-down view for a 3D feel.
  const pitch = 0.16;
  camera.position.set(0, half + Math.sin(pitch) * 10, Math.cos(pitch) * 10);
  camera.lookAt(0, half, 0);
  camera.updateProjectionMatrix();
  director.play('cheer', 1.6);
}

// ------------------------------------------------------------------ battery
const state = { level: 1, charging: false, supported: false };

async function initBattery() {
  if (!('getBattery' in navigator)) return;
  try {
    const b = await navigator.getBattery();
    state.supported = true;
    const sync = () => {
      const plugged = !state.charging && b.charging;
      state.level = b.level;
      state.charging = b.charging;
      director.setMode(mode());
      if (plugged) director.play('cheer', 2.4);
      bridge?.battery({
        level: b.level,
        charging: b.charging,
        chargingTime: b.chargingTime,
        dischargingTime: b.dischargingTime,
      });
    };
    for (const ev of ['chargingchange', 'levelchange', 'chargingtimechange', 'dischargingtimechange']) b.addEventListener(ev, sync);
    sync();
  } catch {
    state.supported = false;
  }
}

function mode() {
  if (state.charging) return state.level >= 0.995 ? 'full' : 'charging';
  return state.level < 0.2 ? 'low' : 'battery';
}

// ------------------------------------------------------------------ drawing
function roundRect(x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawBattery(t) {
  const u = SIZE / 44;
  const x = 1.5 * u;
  const w = SIZE - 7 * u;
  const y = BAT_Y;
  const h = BAT_H;
  const line = Math.max(1, 2.4 * u);
  const ink = dark ? '#eef3ff' : '#1b2033';

  g.lineWidth = line;
  g.strokeStyle = ink;
  g.fillStyle = dark ? 'rgba(8, 12, 30, 0.85)' : 'rgba(255, 255, 255, 0.85)';
  roundRect(x, y, w, h, 3.5 * u);
  g.fill();
  g.stroke();
  g.fillStyle = ink;
  roundRect(x + w + 1 * u, y + h * 0.3, 3.2 * u, h * 0.4, 1 * u);
  g.fill();

  const lvl = Math.max(0.06, state.level);
  let fill = lvl < 0.2 ? '#ff3b4a' : lvl < 0.45 ? '#ffb020' : '#3dff7a';
  if (!state.charging && lvl < 0.2 && Math.sin(t * 6) < 0) fill = '#7a1520';
  const pad = line + 1 * u;
  g.fillStyle = fill;
  roundRect(x + pad, y + pad, (w - pad * 2) * lvl, h - pad * 2, 1.5 * u);
  g.fill();

  if (state.charging) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const s = (h / 44) * 1.5;
    const pulse = 1 + Math.sin(t * 8) * 0.08;
    g.save();
    g.translate(cx, cy);
    g.scale(s * pulse, s * pulse);
    g.beginPath();
    const pts = [[4, -20], [-10, 2], [-1, 2], [-5, 20], [10, -4], [1, -4]];
    pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.closePath();
    g.lineWidth = 5;
    g.strokeStyle = '#0a0a18';
    g.stroke();
    g.fillStyle = '#fff27a';
    g.fill();
    g.restore();
  }
}

// ------------------------------------------------------------------ loop
let t = 0;
function tick() {
  const dt = 1 / FPS;
  t += dt;
  const pose = director.update(dt);
  applyPose(rig, pose, t);
  updateHero(rig, t, dt, Math.max(pose.energy, state.charging ? 0.3 : 0));
  g.clearRect(0, 0, SIZE, SIZE);
  drawBattery(t);
  if (gl) {
    gl.render(scene, camera);
    g.drawImage(gl.domElement, 0, 0, SIZE * SS, PET_H * SS, 0, 0, SIZE, PET_H);
  }
  bridge?.frame(out.toDataURL('image/png'));
}

bridge?.onSetHero((id) => setHero(id));
bridge?.onTheme((isDark) => (dark = isDark));

setHero(heroId);
bridge?.heroes(HEROES.map((h) => ({ id: h.id, name: h.name, power: h.power })));
await initBattery();
setInterval(tick, 1000 / FPS);

// Handle for automated checks.
window.trayPet = { setHero, state, director, tick, canvas: out, currentHero: () => heroId };
