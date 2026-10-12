// The charge cat: a cel-shaded 3D cat on a four-legged rig, with its own activities
// (gallop, walk, sit, groom, stretch, pounce, happy, mope, sleep). In the tray it
// gallops in place while charging, like RunCat.
import * as THREE from 'three';
import { toon, glow, mesh, boltGeometry } from './toon.js';

export const CATS = [
  {
    id: 'ginger',
    kind: 'cat',
    name: 'Ginger',
    power: 'Charge cat',
    lines: ['Mrrrow! Power!', 'Zoomies time!', 'Purr… charging…', 'Feed me electrons!'],
    colors: { body: 0xff9a3c, fur: 0xff9a3c, light: 0xfff1de, dark: 0xc8601a, eye: 0x7ddc5a, glow: 0x3dff7a, collar: 0xff3b5c },
    stripes: true,
    scale: 1.45,
    fx: { colors: [0x3dff7a, 0xfff27a, 0xffffff], rate: 4, life: [0.5, 1], from: 'body', speed: 0.3, spread: 0.5, gravity: 0.2, size: [0.05, 0.09] },
  },
  {
    id: 'smokey',
    kind: 'cat',
    name: 'Smokey',
    power: 'Grey tabby',
    lines: ['Prrrt?', 'Is that a charger? Mine now.', 'Meow. Plug me in.'],
    colors: { body: 0x8d96a8, fur: 0x8d96a8, light: 0xeef1f7, dark: 0x5a6274, eye: 0xffc83d, glow: 0x7af7ff, collar: 0x2bd9ff },
    stripes: true,
    scale: 1.45,
    fx: { colors: [0x7af7ff, 0xffffff], rate: 4, life: [0.5, 1], from: 'body', speed: 0.3, spread: 0.5, gravity: 0.2, size: [0.05, 0.09] },
  },
  {
    id: 'snowball',
    kind: 'cat',
    name: 'Snowball',
    power: 'Fluffy white cat',
    lines: ['Mew!', 'Soft and fully charged.', 'Purrrfect.'],
    colors: { body: 0xe9e4da, fur: 0xe9e4da, light: 0xf3f0e9, dark: 0xc9c0b2, eye: 0x55b7ff, glow: 0xff7eb6, collar: 0xff7eb6 },
    stripes: false,
    scale: 1.45,
    fx: { colors: [0xff7eb6, 0xffffff], rate: 4, life: [0.5, 1], from: 'body', speed: 0.3, spread: 0.5, gravity: 0.2, size: [0.05, 0.09] },
  },
];

const R = 0.21; // torso radius
const LEG = 0.3;
const H0 = LEG + R * 0.7; // torso centre height when standing
const LEG_LEN = H0 - R * 0.5;
const TAIL_SEGS = 7;

export function buildCat(def) {
  const C = def.colors;
  const mats = {
    fur: toon(C.fur),
    light: toon(C.light),
    dark: toon(C.dark),
    pink: toon(0xff9fb0),
    eyeWhite: toon(0xffffff),
    iris: toon(C.eye),
    pupil: toon(0x111122),
    shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    collar: toon(C.collar),
    glow: glow(C.glow, 2),
    whisker: new THREE.MeshBasicMaterial({ color: 0x2a2a3a }),
  };

  const root = new THREE.Group();
  const scaler = new THREE.Group();
  const flip = new THREE.Group();
  const body = new THREE.Group();
  root.add(scaler);
  scaler.add(flip);
  flip.position.y = H0;
  flip.add(body);

  // Torso along +z (the cat faces +z).
  const torsoGeo = new THREE.CapsuleGeometry(R, 0.5, 8, 20);
  torsoGeo.rotateX(Math.PI / 2);
  torsoGeo.scale(1, 0.95, 1);
  const torso = mesh(torsoGeo, mats.fur);
  body.add(torso);
  const chest = mesh(new THREE.SphereGeometry(0.5, 18, 12), mats.light, { line: 0 });
  chest.scale.set(0.28, 0.3, 0.2);
  chest.position.set(0, -0.03, 0.36);
  body.add(chest);
  if (def.stripes) {
    for (const z of [-0.22, -0.08, 0.06]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(R * 0.98, 0.028, 6, 20, Math.PI * 0.8), mats.dark);
      band.rotation.z = Math.PI * 0.1;
      band.position.z = z;
      body.add(band);
    }
  }

  // Head
  const head = new THREE.Group();
  head.position.set(0, R * 0.55, 0.4);
  body.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.24, 24, 18), mats.fur);
  skull.scale.set(1.08, 0.92, 0.95);
  skull.position.set(0, 0.12, 0.06);
  head.add(skull);
  const ears = [];
  for (const s of [1, -1]) {
    const ear = new THREE.Group();
    ear.position.set(s * 0.13, 0.3, 0.04);
    ear.rotation.z = -s * 0.32;
    const outer = mesh(new THREE.ConeGeometry(0.085, 0.2, 12), mats.fur, { line: 0.02 });
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.13, 10), mats.pink);
    inner.position.set(0, -0.02, 0.035);
    ear.add(outer, inner);
    head.add(ear);
    ears.push(ear);
    if (def.stripes) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.02), mats.dark);
      mark.position.set(s * 0.05, 0.31, 0.25);
      mark.rotation.z = s * 0.25;
      mark.rotation.x = -0.6;
      head.add(mark);
    }
  }
  const eyes = [];
  for (const s of [1, -1]) {
    const eye = new THREE.Group();
    eye.position.set(s * 0.095, 0.14, 0.255);
    const white = mesh(new THREE.SphereGeometry(0.062, 18, 14), mats.eyeWhite, { line: 0.012 });
    white.scale.z = 0.5;
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), mats.iris);
    iris.scale.z = 0.5;
    iris.position.z = 0.012;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), mats.pupil);
    pupil.scale.set(0.38, 1, 0.5);
    pupil.position.z = 0.022;
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), mats.shine);
    shine.position.set(0.018, 0.022, 0.035);
    eye.add(white, iris, pupil, shine);
    head.add(eye);
    eyes.push(eye);
  }
  for (const s of [1, -1]) {
    const cheek = mesh(new THREE.SphereGeometry(0.06, 14, 10), mats.light, { line: 0 });
    cheek.scale.set(1.1, 0.8, 0.8);
    cheek.position.set(s * 0.042, 0.045, 0.27);
    head.add(cheek);
    for (let k = 0; k < 3; k++) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4), mats.whisker);
      w.rotation.z = Math.PI / 2 + s * (k - 1) * 0.18;
      w.position.set(s * 0.17, 0.055 - (k - 1) * 0.022, 0.25);
      head.add(w);
    }
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), mats.pink);
  nose.scale.set(1.3, 0.8, 1);
  nose.position.set(0, 0.085, 0.31);
  head.add(nose);

  // Collar with a glowing bolt tag.
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.026, 8, 28), mats.collar);
  collar.rotation.x = Math.PI / 2 - 0.35;
  collar.position.set(0, -0.02, 0.0);
  head.add(collar);
  const tag = new THREE.Mesh(boltGeometry(0.03), mats.glow);
  tag.scale.setScalar(0.09);
  tag.position.set(0, -0.09, 0.17);
  head.add(tag);

  // Legs: front at +z, back at -z.
  const legs = {};
  for (const [name, x, z] of [['FL', 0.11, 0.27], ['FR', -0.11, 0.27], ['BL', 0.11, -0.27], ['BR', -0.11, -0.27]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, -R * 0.5, z);
    const leg = mesh(new THREE.CapsuleGeometry(0.062, LEG_LEN - 0.124, 6, 12), mats.fur);
    leg.position.y = -LEG_LEN / 2 + 0.03;
    const paw = mesh(new THREE.SphereGeometry(0.07, 14, 10), mats.light, { line: 0.02 });
    paw.scale.set(1, 0.62, 1.3);
    paw.position.set(0, -LEG_LEN + 0.04, 0.02);
    pivot.add(leg, paw);
    body.add(pivot);
    legs[name] = pivot;
  }

  // Tail: a chain of segments, each rotating a little to curl and sway.
  const tail = [];
  let parent = body;
  for (let i = 0; i < TAIL_SEGS; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, i === 0 ? R * 0.35 : 0, i === 0 ? -0.43 : -0.085);
    const r = 0.058 - i * 0.004;
    const tipMat = i >= TAIL_SEGS - 2 && def.stripes ? mats.dark : mats.fur;
    const ball = mesh(new THREE.SphereGeometry(r, 12, 10), tipMat, { line: 0.015 });
    ball.scale.z = 1.5;
    ball.position.z = -0.04;
    seg.add(ball);
    parent.add(seg);
    parent = seg;
    tail.push(seg);
  }

  const headTop = new THREE.Object3D();
  headTop.position.set(0, 0.48, 0.06);
  head.add(headTop);
  const center = new THREE.Object3D();
  body.add(center);

  const rig = {
    def, kind: 'cat', mats, root, scaler, flip, body, head, legs, tail, ears, eyes,
    anchors: { head: headTop, body: center, feet: root },
    hands: [legs.FL],
    legLen: LEG_LEN,
    height: H0 + R * 0.55 + 0.45,
    length: 1.5,
  };
  root.traverse((o) => {
    if (o.isMesh) o.userData.hero = def.id;
  });
  scaler.scale.setScalar(def.scale ?? 1);
  return rig;
}

export function catPose() {
  return {
    x: 0, y: 0, rotY: 0, pitch: 0, roll: 0, sy: 1, stretch: 1,
    headX: 0, headY: 0, headZ: 0,
    FL: 0, FR: 0, BL: 0, BR: 0, frontLen: 1,
    tailUp: 0.55, tailCurl: 0.12, tailWrap: 0, tailWag: 0.25, tailHz: 0.5,
    earsBack: 0, blink: 0, energy: 0,
  };
}

export function applyCatPose(rig, p, t) {
  rig.root.position.x = p.x;
  rig.root.rotation.y = p.rotY;
  rig.flip.rotation.x = p.pitch;
  rig.flip.rotation.z = p.roll;
  rig.body.position.y = p.y;
  rig.body.scale.set(1, p.sy, p.stretch);
  rig.head.rotation.set(p.headX, p.headY, p.headZ);
  for (const k of ['FL', 'FR', 'BL', 'BR']) rig.legs[k].rotation.x = -p[k];
  rig.legs.FL.scale.y = rig.legs.FR.scale.y = p.frontLen;
  rig.tail.forEach((seg, i) => {
    seg.rotation.x = i === 0 ? p.tailUp : p.tailCurl;
    seg.rotation.y = p.tailWrap + p.tailWag * Math.sin(t * p.tailHz * Math.PI * 2 - i * 0.7);
  });
  for (const e of rig.ears) e.rotation.x = -p.earsBack * 0.7;
  const open = Math.max(0.08, 1 - p.blink);
  for (const e of rig.eyes) e.scale.y = open;
}

export function updateCat(rig, t, dt, energy) {
  rig.mats.glow.emissiveIntensity = 1.6 + energy * 2 + Math.sin(t * 5) * 0.4 * energy;
}

// ------------------------------------------------------------------ activities
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const ease = (a, b, t) => smooth(clamp((t - a) / (b - a), 0, 1));

function gallop(p, phase, amp = 1) {
  const a = phase * TAU;
  p.FL = Math.sin(a) * 0.95 * amp;
  p.FR = Math.sin(a - 0.5) * 0.95 * amp;
  p.BL = Math.sin(a + Math.PI) * 0.9 * amp;
  p.BR = Math.sin(a + Math.PI - 0.5) * 0.9 * amp;
  p.pitch = Math.sin(a + 0.6) * 0.13 * amp;
  p.y = Math.abs(Math.sin(a)) * 0.07 * amp;
  p.stretch = 1 + Math.sin(a + Math.PI / 2) * 0.07 * amp;
  p.headX = -Math.sin(a + 0.6) * 0.12 * amp;
  p.tailUp = 0.25;
  p.tailCurl = 0.05;
  p.tailWag = 0.15;
  p.tailHz = 2.5;
  p.earsBack = 0.5 * amp;
}

function walkCycle(p, phase) {
  const a = phase * TAU;
  p.FL = Math.sin(a) * 0.45;
  p.BR = Math.sin(a + Math.PI / 2) * 0.45;
  p.FR = Math.sin(a + Math.PI) * 0.45;
  p.BL = Math.sin(a + Math.PI * 1.5) * 0.45;
  p.y = Math.abs(Math.sin(a * 2)) * 0.015;
  p.headY = Math.sin(a) * 0.08;
  p.tailUp = 0.85;
  p.tailCurl = 0.18;
  p.tailWag = 0.25;
  p.tailHz = 0.8;
}

function sitPose(p) {
  p.pitch = -0.55;
  p.y = -0.07;
  p.FL = p.FR = -0.55;
  p.frontLen = 1.28;
  p.BL = p.BR = 1.35;
  p.headX = 0.45;
  p.tailUp = -0.55;
  p.tailCurl = 0.05;
  p.tailWrap = 0.25;
  p.tailWag = 0.12;
  p.tailHz = 0.4;
}

function lyingPose(p) {
  p.y = -(H0 - R * 0.95);
  p.FL = p.FR = 1.45;
  p.BL = p.BR = 1.5;
  p.tailUp = -0.15;
  p.tailCurl = 0.02;
  p.tailWrap = 0.32;
  p.tailWag = 0.05;
  p.tailHz = 0.3;
}

// Facing for an activity that does not travel: 3/4 view in the scene, side view in the tray.
const face = (ctx) => ctx.facing ?? 0.5;

export const CAT_ACTS = {
  run: {
    label: 'Zoomies!',
    dur: [6.98, 6.98],
    fn(p, t, ctx) {
      gallop(p, t * (ctx.runHz ?? 2.6));
      if (ctx.inPlace) {
        p.rotY = face(ctx);
      } else {
        const w = 0.9;
        p.x = Math.sin(t * w) * ctx.track;
        p.rotY = (Math.PI / 2) * clamp(Math.cos(t * w) * 5, -1, 1);
      }
      p.energy = 0.6;
    },
  },
  walk: {
    label: 'Strolling',
    dur: [8.97, 8.97],
    fn(p, t, ctx) {
      walkCycle(p, t * 1.3);
      if (ctx.inPlace) {
        p.rotY = face(ctx);
      } else {
        const w = 0.7; // one full lap per 8.97 s, ending back in the middle
        p.x = Math.sin(t * w) * ctx.track;
        p.rotY = (Math.PI / 2) * clamp(Math.cos(t * w) * 5, -1, 1);
      }
    },
  },
  sit: {
    label: 'Sitting pretty',
    dur: [4, 7],
    fn(p, t, ctx) {
      sitPose(p);
      p.rotY = face(ctx);
      p.headY = Math.sin(t * 0.7) * 0.4;
      p.headZ = Math.sin(t * 0.5) * 0.12;
      p.sy = 1 + Math.sin(t * 2) * 0.015;
    },
  },
  groom: {
    label: 'Grooming',
    dur: [3.5, 4.5],
    fn(p, t, ctx) {
      sitPose(p);
      p.rotY = face(ctx);
      const k = ease(0, 0.4, t) * (1 - ease(ctx.dur - 0.4, ctx.dur, t));
      p.FR = -0.55 + 2.0 * k;
      p.frontLen = 1.28;
      p.headX = 0.45 + (0.35 + Math.sin(t * 9) * 0.12) * k;
      p.headY = -0.35 * k;
      p.blink = 0.85 * k;
    },
  },
  stretch: {
    label: 'Big stretch',
    dur: [3, 3],
    fn(p, t, ctx) {
      const k = ease(0.1, 0.9, t) * (1 - ease(ctx.dur - 0.8, ctx.dur, t));
      p.rotY = face(ctx);
      p.FL = p.FR = 1.05 * k;
      p.BL = p.BR = -0.25 * k;
      p.pitch = 0.32 * k;
      p.y = -0.06 * k;
      p.stretch = 1 + 0.12 * k;
      p.headX = -0.35 * k;
      p.tailUp = 0.55 + 0.7 * k;
      p.blink = k;
      p.earsBack = 0.4 * k;
    },
  },
  pounce: {
    label: 'Pounce!',
    dur: [1.6, 1.6],
    fn(p, t, ctx) {
      p.rotY = face(ctx);
      const h = ctx.jumpH ?? 0.55;
      if (t < 0.6) {
        const k = ease(0, 0.25, t);
        p.y = -0.1 * k;
        p.pitch = 0.12 * k;
        p.BL = p.BR = 0.5 * k;
        p.FL = p.FR = -0.2 * k;
        p.roll = Math.sin(t * 28) * 0.05 * k; // butt wiggle
        p.tailUp = 0.2;
        p.tailWag = 0.5;
        p.tailHz = 4;
        p.earsBack = 0.4;
      } else if (t < 1.1) {
        const u = (t - 0.6) / 0.5;
        p.y = 4 * h * u * (1 - u);
        p.pitch = -0.25 + u * 0.5;
        p.FL = p.FR = 1.0;
        p.BL = p.BR = -1.0;
        p.stretch = 1.1;
        p.tailUp = 0.1;
      } else {
        const k = 1 - (t - 1.1) / 0.5;
        p.sy = 1 - 0.12 * Math.sin(k * Math.PI);
        p.y = -0.05 * Math.sin(k * Math.PI);
      }
      p.energy = 0.6;
    },
  },
  happy: {
    label: 'Happy purrs',
    dur: [2.6, 3.4],
    fn(p, t, ctx) {
      sitPose(p);
      p.rotY = face(ctx);
      p.y += Math.abs(Math.sin(t * 6)) * 0.06;
      p.headZ = Math.sin(t * 3) * 0.2;
      p.headX = 0.3;
      p.tailUp = 0.9;
      p.tailWrap = 0;
      p.tailCurl = 0.25;
      p.tailWag = 0.45;
      p.tailHz = 2.2;
      p.blink = 0.55;
      p.energy = 0.6;
    },
  },
  mope: {
    label: 'Low on energy',
    dur: [4, 6],
    fn(p, t, ctx) {
      lyingPose(p);
      p.rotY = face(ctx);
      p.headX = 0.32;
      p.headZ = Math.sin(t * 0.6) * 0.06;
      p.blink = 0.45;
      p.earsBack = 1;
    },
  },
  sleep: {
    label: 'Napping',
    dur: [7, 10],
    fn(p, t, ctx) {
      const k = ease(0, 0.8, t) * (1 - ease(ctx.dur - 0.6, ctx.dur, t));
      const base = catPose();
      lyingPose(p);
      for (const key in p) p[key] = base[key] + (p[key] - base[key]) * k;
      p.rotY = face(ctx);
      p.headX = 0.42 * k;
      p.headZ = 0.35 * k;
      p.blink = k;
      p.sy = 1 + Math.sin(t * 1.5) * 0.035 * k;
    },
  },
};

// Biped activity names used elsewhere map onto the closest cat behaviour.
const ALIAS = {
  idle: 'sit', wave: 'happy', jump: 'pounce', backflip: 'pounce', dance: 'happy', spin: 'happy',
  powerup: 'happy', cheer: 'happy', pump: 'run', sad: 'mope',
};

export const CAT_POOLS = {
  charging: ['run', 'run', 'pounce', 'happy', 'run', 'groom'],
  full: ['happy', 'sit', 'groom', 'stretch', 'walk'],
  battery: ['walk', 'sit', 'groom', 'stretch', 'sit'],
  low: ['sleep', 'mope', 'sleep'],
};

const BLEND = 0.4;

export class CatDirector {
  constructor({ pools = CAT_POOLS } = {}) {
    this.pools = pools;
    this.mode = 'battery';
    this.current = null;
    this.t = 0;
    this.dur = 3;
    this.from = catPose();
    this.last = catPose();
    this.blendT = BLEND;
    this.blinkTimer = 2;
    this.blinkT = 1;
    this.ctx = { track: 1.1, dur: 3, facing: 0.5, inPlace: false };
    this.onActivity = null;
    this.play('sit');
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.next();
  }

  play(name, dur) {
    name = CAT_ACTS[name] ? name : ALIAS[name] ?? 'happy';
    const a = CAT_ACTS[name];
    this.from = { ...this.last };
    this.blendT = 0;
    this.current = name;
    this.t = 0;
    this.dur = dur ?? a.dur[0] + Math.random() * (a.dur[1] - a.dur[0]);
    this.onActivity?.(name, a.label);
  }

  next() {
    const pool = this.pools[this.mode] ?? this.pools.battery;
    let pick = pool[(Math.random() * pool.length) | 0];
    for (let i = 0; i < 4 && pick === this.current && pool.some((x) => x !== pick); i++) pick = pool[(Math.random() * pool.length) | 0];
    // Keep a looping activity going seamlessly (no re-blend, no phase jump) when it repeats.
    if (pick === this.current && (pick === 'run' || pick === 'walk')) {
      this.dur += CAT_ACTS[pick].dur[0];
      return;
    }
    this.play(pick);
  }

  update(dt) {
    this.t += dt;
    this.blendT += dt;
    if (this.t >= this.dur) this.next();

    const p = catPose();
    this.ctx.dur = this.dur;
    CAT_ACTS[this.current].fn(p, this.t, this.ctx);

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkT = 0;
      this.blinkTimer = 2.5 + Math.random() * 3.5;
    }
    this.blinkT += dt;
    if (this.blinkT < 0.16) p.blink = Math.max(p.blink, Math.sin((this.blinkT / 0.16) * Math.PI));

    if (this.blendT < BLEND) {
      const k = smooth(this.blendT / BLEND);
      for (const key in p) p[key] = this.from[key] + (p[key] - this.from[key]) * k;
    }
    this.last = p;
    return p;
  }
}
