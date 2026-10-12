// The ten Charge Squad heroes. Every hero is built procedurally from primitives on a
// shared rig (root → scaler → flip → body → hips → upper/legs) so all activities work
// for every character.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toon, glow, mesh, boltGeometry } from './toon.js';

const ARM_REST = 0.12;

function shapeGeometry(shape, w, h, d) {
  let g;
  switch (shape) {
    case 'capsule': {
      const r = w / 2;
      g = new THREE.CapsuleGeometry(r, Math.max(h - w, 0.01), 8, 24);
      g.scale(1, 1, d / w);
      return g;
    }
    case 'box':
      return new RoundedBoxGeometry(w, h, d, 4, Math.min(w, h, d) * 0.24);
    case 'rock':
      g = new THREE.DodecahedronGeometry(0.5, 0);
      break;
    case 'crystal':
      g = new THREE.OctahedronGeometry(0.5, 0);
      break;
    case 'gem':
      g = new THREE.IcosahedronGeometry(0.5, 0);
      break;
    case 'sphere':
    default:
      g = new THREE.SphereGeometry(0.5, 32, 22);
  }
  g.scale(w, h, d);
  return g;
}

// Approximate z of the front surface of a shape at offset (dx, dy) from its centre.
function surfaceZ(shape, w, h, d, dx, dy) {
  if (shape === 'box') return d / 2;
  const nx = dx / (w / 2);
  const ny = dy / (h / 2);
  const k = Math.max(0.05, 1 - nx * nx - ny * ny);
  const z = (d / 2) * Math.sqrt(k);
  return shape === 'sphere' || shape === 'capsule' ? z : z * 0.9 + 0.02;
}

function makeEye(size, style, mats) {
  const g = new THREE.Group();
  if (style === 'screen') {
    const screen = mesh(new RoundedBoxGeometry(size * 1.5, size * 1.9, size * 0.4, 2, size * 0.25), mats.glow, { line: 0.02 });
    g.add(screen);
    return g;
  }
  const white = mesh(new THREE.SphereGeometry(size, 20, 14), style === 'glow' ? mats.glow : mats.eyeWhite, { line: 0.018 });
  white.scale.z = 0.5;
  g.add(white);
  if (style !== 'glow') {
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(size * 0.56, 16, 12), mats.pupil);
    pupil.position.set(0, -size * 0.06, size * 0.3);
    pupil.scale.z = 0.5;
    const shine = new THREE.Mesh(new THREE.SphereGeometry(size * 0.2, 10, 8), mats.shine);
    shine.position.set(size * 0.22, size * 0.2, size * 0.5);
    g.add(pupil, shine);
  }
  return g;
}

export function buildHero(def) {
  const C = def.colors;
  const mats = {
    body: toon(C.body, { opacity: def.opacity, flat: def.flat }),
    accent: toon(C.accent, { flat: def.flat }),
    dark: toon(C.dark, { flat: def.flat }),
    glow: glow(C.glow, 2.2),
    eyeWhite: toon(0xffffff),
    pupil: toon(0x121226),
    shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    mouth: new THREE.MeshBasicMaterial({ color: 0x1a0d16 }),
  };
  const T = def.torso;
  const H = def.head;
  const A = def.arms;
  const L = def.legs ? def.legs.len : def.float ?? 0.03;

  const root = new THREE.Group();
  const scaler = new THREE.Group();
  const flip = new THREE.Group();
  const body = new THREE.Group();
  const hips = new THREE.Group();
  const upper = new THREE.Group();
  const centerH = L + T.h * 0.5;
  root.add(scaler);
  scaler.add(flip);
  flip.position.y = centerH;
  flip.add(body);
  body.position.y = -centerH;
  body.add(hips);
  hips.position.y = L;
  hips.add(upper);

  // Torso
  const torso = mesh(shapeGeometry(T.shape, T.w, T.h, T.d), mats.body);
  torso.position.y = T.h / 2;
  upper.add(torso);

  // Head
  const head = new THREE.Group();
  head.position.y = T.h + (H.neck ?? 0.0);
  upper.add(head);
  let faceShape = H.shape;
  let face = { w: H.w, h: H.h, d: H.d, cy: H.h / 2, parent: head };
  if (H.shape !== 'none') {
    const headMesh = mesh(shapeGeometry(H.shape, H.w, H.h, H.d), mats[H.mat ?? 'body']);
    headMesh.position.y = H.h / 2;
    head.add(headMesh);
  } else {
    // Face lives on the torso (blob-style heroes).
    faceShape = T.shape;
    face = { w: T.w, h: T.h, d: T.d, cy: T.h / 2, parent: upper };
  }

  // Eyes
  const eyes = [];
  const E = def.eyes ?? { count: 2, size: 0.09, spacing: 0.13 };
  const eyeY = face.h * (E.y ?? 0.56);
  if (E.count > 0) {
    const xs = E.count === 1 ? [0] : [-E.spacing, E.spacing];
    for (const x of xs) {
      const eye = makeEye(E.size, E.style, mats);
      const z = surfaceZ(faceShape, face.w, face.h, face.d, x, eyeY - face.cy);
      eye.position.set(x, eyeY, z - E.size * 0.12);
      face.parent.add(eye);
      eyes.push(eye);
    }
  }

  // Mouth: a half torus whose y-scale doubles as the mood (smile ↔ frown).
  const mouth = new THREE.Group();
  const mouthArc = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 6, 18, Math.PI), mats.mouth);
  mouthArc.rotation.z = Math.PI;
  mouth.add(mouthArc);
  const mouthY = eyeY - (E.size ?? 0.09) * 1.7 - 0.02;
  mouth.position.set(0, mouthY, surfaceZ(faceShape, face.w, face.h, face.d, 0, mouthY - face.cy) + 0.004);
  if (!def.noMouth) face.parent.add(mouth);

  // Chest emblem: the Charge Squad bolt badge.
  const emblem = new THREE.Group();
  const badge = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 28), mats.dark, { line: 0.015 });
  badge.rotation.x = Math.PI / 2;
  const bolt = new THREE.Mesh(boltGeometry(0.03), mats.glow);
  bolt.scale.setScalar(0.15);
  bolt.position.z = 0.025;
  emblem.add(badge, bolt);
  const ey = T.h * (def.emblemY ?? 0.6);
  emblem.position.set(0, ey, surfaceZ(T.shape, T.w, T.h, T.d, 0, ey - T.h / 2) + 0.004);
  if (!def.noEmblem) upper.add(emblem);

  // Arms (index 0 on +x, index 1 on -x)
  const arms = [];
  const hands = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * A.x, A.y ?? T.h * 0.8, 0);
    const arm = mesh(new THREE.CapsuleGeometry(A.r, Math.max(A.len - 2 * A.r, 0.01), 6, 14), mats[A.mat ?? 'body']);
    arm.position.y = -A.len / 2 + A.r;
    const hand = mesh(new THREE.SphereGeometry(A.hand ?? A.r * 1.3, 16, 12), mats[A.handMat ?? 'accent']);
    hand.position.y = -A.len + A.r;
    pivot.add(arm, hand);
    upper.add(pivot);
    arms.push(pivot);
    hands.push(hand);
  }

  // Legs
  const legs = [];
  if (def.legs) {
    const G = def.legs;
    for (const s of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * G.x, 0, 0);
      const leg = mesh(new THREE.CapsuleGeometry(G.r, Math.max(L - 2 * G.r, 0.01), 6, 14), mats[G.mat ?? 'body']);
      leg.position.y = -L / 2 + G.r * 0.6;
      const foot = mesh(new THREE.SphereGeometry(G.r * 1.35, 16, 12), mats[G.footMat ?? 'dark']);
      foot.scale.set(1.1, 0.62, 1.45);
      foot.position.set(0, -L + G.r * 0.75, G.r * 0.45);
      pivot.add(leg, foot);
      hips.add(pivot);
      legs.push(pivot);
    }
  }

  // Anchors used for particles and the speech bubble.
  const headTop = new THREE.Object3D();
  headTop.position.y = (H.shape !== 'none' ? H.h : 0) + (def.topExtra ?? 0.1);
  head.add(headTop);
  const chest = new THREE.Object3D();
  chest.position.y = T.h * 0.5;
  upper.add(chest);

  const rig = {
    def, mats, root, scaler, flip, body, hips, upper, head, torso, arms, hands, legs, eyes, mouth, emblem,
    anchors: { head: headTop, body: chest, feet: root },
    centerH,
    legLen: L,
    height: L + T.h + (H.neck ?? 0) + (H.shape !== 'none' ? H.h : 0),
    updaters: [],
  };

  const ctx = { mats, mesh, toon, glow, boltGeometry, THREE, shapeGeometry, surfaceZ };
  const upd = def.decorate?.(rig, ctx);
  if (upd) rig.updaters.push(upd);

  root.traverse((o) => {
    if (o.isMesh) o.userData.hero = def.id;
  });
  scaler.scale.setScalar(def.scale ?? 1);
  return rig;
}

export function applyPose(rig, p, t) {
  const hover = rig.def.hover ? 0.08 + Math.sin(t * 2.2) * 0.06 : 0;
  rig.root.position.x = p.x;
  rig.root.rotation.y = p.rotY;
  rig.flip.rotation.x = p.rotX;
  rig.flip.rotation.z = p.rotZ;
  rig.body.position.y = -rig.centerH + p.y + hover;
  rig.body.scale.set(p.sx, p.sy, p.sx);
  rig.upper.rotation.x = p.tilt;
  rig.upper.rotation.y = p.twist;
  rig.head.rotation.set(p.headX, p.headY, p.headZ);
  rig.arms[0].rotation.set(-p.armASwing, 0, ARM_REST + p.armARaise);
  rig.arms[1].rotation.set(-p.armBSwing, 0, -(ARM_REST + p.armBRaise));
  if (rig.legs.length) {
    rig.legs[0].rotation.x = -p.legASwing;
    rig.legs[1].rotation.x = -p.legBSwing;
  }
  const open = Math.max(0.08, 1 - p.blink);
  for (const e of rig.eyes) e.scale.y = open;
  const m = THREE.MathUtils.clamp(p.mood, -1, 1);
  rig.mouth.scale.y = Math.abs(m) < 0.15 ? 0.15 * Math.sign(m || 1) : m;
}

export function updateHero(rig, t, dt, energy) {
  rig.mats.glow.emissiveIntensity = 1.8 + energy * 2.2 + Math.sin(t * 6) * 0.3 * energy;
  for (const u of rig.updaters) u(t, dt, energy);
}

// ---------------------------------------------------------------------------
// Hero definitions
// ---------------------------------------------------------------------------

export const HEROES = [
  {
    id: 'blaze',
    name: 'Blaze',
    power: 'Fire elemental',
    lines: ['Feeling hot, hot, hot!', 'Careful, I sizzle!', 'Fire it up!'],
    colors: { body: 0xff5a1f, accent: 0xffb400, dark: 0x3a1208, glow: 0xffd23f },
    torso: { shape: 'capsule', w: 0.62, h: 0.7, d: 0.52 },
    head: { shape: 'sphere', w: 0.62, h: 0.58, d: 0.56 },
    arms: { len: 0.55, r: 0.085, x: 0.36, hand: 0.11, handMat: 'dark' },
    legs: { len: 0.42, r: 0.1, x: 0.14 },
    eyes: { count: 2, size: 0.085, spacing: 0.13 },
    topExtra: 0.45,
    fx: { colors: [0xffb400, 0xff5a1f, 0xffe08a], rate: 14, life: [0.6, 1.2], from: 'head', speed: 0.9, spread: 0.25, gravity: 0.8, size: [0.09, 0.18] },
    decorate(rig, { mats, mesh, THREE, glow }) {
      const flames = [];
      const outer = glow(0xff7a1a, 2.4);
      const inner = glow(0xffe066, 3);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const h = 0.3 + (i % 3) * 0.08;
        const cone = mesh(new THREE.ConeGeometry(0.11, h, 10), i % 2 ? inner : outer, { line: 0 });
        const r = 0.17;
        cone.position.set(Math.cos(a) * r, 0.5 + h / 2 - 0.05, Math.sin(a) * r * 0.9);
        cone.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
        cone.userData.h = h;
        rig.head.add(cone);
        flames.push(cone);
      }
      const core = mesh(new THREE.ConeGeometry(0.16, 0.5, 12), inner, { line: 0 });
      core.position.y = 0.72;
      rig.head.add(core);
      flames.push(core);
      for (const s of [1, -1]) {
        const rock = mesh(new THREE.DodecahedronGeometry(0.12, 0), mats.dark);
        rock.position.set(s * 0.3, 0.62, 0);
        rig.upper.add(rock);
      }
      return (t) => {
        flames.forEach((f, i) => {
          f.scale.y = 1 + Math.sin(t * 13 + i * 1.7) * 0.22 + Math.sin(t * 7.3 + i) * 0.1;
          f.scale.x = f.scale.z = 1 - Math.sin(t * 11 + i) * 0.08;
        });
      };
    },
  },
  {
    id: 'volt',
    name: 'Volt',
    power: 'Living lightning',
    lines: ['Zap! Right on time.', 'Bzzzt! Fully wired.', 'I run on 100% voltage!'],
    colors: { body: 0xffe14d, accent: 0x2bd9ff, dark: 0x1d2340, glow: 0x7af7ff },
    torso: { shape: 'capsule', w: 0.5, h: 0.66, d: 0.42 },
    head: { shape: 'sphere', w: 0.56, h: 0.54, d: 0.52 },
    arms: { len: 0.56, r: 0.07, x: 0.3, hand: 0.09 },
    legs: { len: 0.46, r: 0.08, x: 0.12, mat: 'dark' },
    eyes: { count: 2, size: 0.09, spacing: 0.13 },
    topExtra: 0.4,
    fx: { colors: [0x7af7ff, 0xffffff, 0xffe14d], rate: 20, life: [0.15, 0.35], from: 'body', speed: 2.4, spread: 1, gravity: 0, size: [0.05, 0.1] },
    decorate(rig, { mats, mesh, THREE, boltGeometry }) {
      const crest = [];
      [-0.5, 0, 0.5].forEach((a, i) => {
        const b = mesh(boltGeometry(0.06), mats.glow, { line: 0.02 });
        const s = i === 1 ? 0.48 : 0.34;
        b.scale.setScalar(s);
        b.position.set(Math.sin(a) * 0.2, 0.56 + s * 0.35, -0.02);
        b.rotation.z = -a * 0.9;
        rig.head.add(b);
        crest.push(b);
      });
      for (const p of rig.arms) {
        const orb = mesh(new THREE.SphereGeometry(0.08, 14, 10), mats.accent);
        p.add(orb);
      }
      const belt = mesh(new THREE.TorusGeometry(0.235, 0.03, 8, 32), mats.dark, { line: 0 });
      belt.rotation.x = Math.PI / 2;
      belt.position.y = 0.16;
      rig.upper.add(belt);
      return (t, dt, energy) => {
        crest.forEach((b, i) => {
          b.rotation.y = Math.sin(t * 20 + i * 2) * 0.12 * (0.4 + energy);
        });
      };
    },
  },
  {
    id: 'frostbyte',
    name: 'Frostbyte',
    power: 'Ice crystal',
    lines: ['Stay frosty!', 'Chill… I got this.', 'Ice to meet you!'],
    colors: { body: 0x8fe3ff, accent: 0xe8fbff, dark: 0x1b4f7a, glow: 0xb8f4ff },
    opacity: 0.92,
    flat: true,
    torso: { shape: 'crystal', w: 0.78, h: 0.86, d: 0.62 },
    head: { shape: 'gem', w: 0.58, h: 0.56, d: 0.52 },
    arms: { len: 0.56, r: 0.09, x: 0.36, hand: 0.11 },
    legs: { len: 0.4, r: 0.1, x: 0.15, mat: 'accent' },
    eyes: { count: 2, size: 0.08, spacing: 0.12 },
    emblemY: 0.58,
    topExtra: 0.3,
    fx: { colors: [0xffffff, 0xcff6ff], rate: 10, life: [1.4, 2.4], from: 'around', radius: 1.1, speed: 0.15, spread: 0.2, gravity: -0.25, size: [0.05, 0.1] },
    decorate(rig, { mats, mesh, THREE }) {
      const spikes = [];
      for (const s of [1, -1]) {
        for (let i = 0; i < 3; i++) {
          const c = mesh(new THREE.ConeGeometry(0.06, 0.28 - i * 0.05, 5), mats.accent);
          c.position.set(s * (0.28 + i * 0.05), 0.72 - i * 0.04, -0.05 - i * 0.08);
          c.rotation.z = -s * (0.6 + i * 0.25);
          c.rotation.x = -0.3;
          rig.upper.add(c);
          spikes.push(c);
        }
      }
      for (const [x, h] of [[-0.12, 0.26], [0.1, 0.34], [0.0, 0.22]]) {
        const c = mesh(new THREE.ConeGeometry(0.06, h, 5), mats.accent);
        c.position.set(x, 0.56 + h / 2 - 0.04, -0.06);
        c.rotation.z = -x * 2;
        rig.head.add(c);
      }
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), mats.glow);
      core.position.y = 0.43;
      rig.upper.add(core);
      return (t) => {
        core.rotation.y = t * 2;
      };
    },
  },
  {
    id: 'boulder',
    name: 'Boulder',
    power: 'Rock golem',
    lines: ['Rock solid!', 'Nothing moves me.', 'Let me crush that low battery!'],
    colors: { body: 0x8b7d6b, accent: 0xc9b79c, dark: 0x3b332b, glow: 0xffa23a },
    flat: true,
    torso: { shape: 'rock', w: 1.0, h: 0.84, d: 0.74 },
    head: { shape: 'rock', w: 0.46, h: 0.42, d: 0.44, neck: -0.08 },
    arms: { len: 0.74, r: 0.13, x: 0.55, y: 0.68, hand: 0.19, handMat: 'dark' },
    legs: { len: 0.32, r: 0.13, x: 0.2 },
    eyes: { count: 2, size: 0.06, spacing: 0.1, style: 'glow' },
    emblemY: 0.5,
    fx: { colors: [0xc9b79c, 0x8b7d6b, 0xffa23a], rate: 6, life: [0.8, 1.4], from: 'feet', speed: 0.5, spread: 0.8, rise: 1, gravity: -0.6, size: [0.1, 0.2], additive: false },
    decorate(rig, { mats, mesh, THREE }) {
      const cracks = [];
      for (const [x, y, rz, l] of [[-0.24, 0.35, 0.5, 0.2], [0.26, 0.62, -0.7, 0.16], [0.2, 0.24, 0.9, 0.14]]) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(l, 0.025, 0.02), mats.glow);
        c.position.set(x, y, 0.3);
        c.rotation.z = rz;
        rig.upper.add(c);
        cracks.push(c);
      }
      const moss = mesh(new THREE.DodecahedronGeometry(0.1, 0), mats.accent);
      moss.position.set(-0.1, 0.4, -0.05);
      moss.scale.set(1.4, 0.5, 1.2);
      rig.head.add(moss);
      for (const s of [1, -1]) {
        const pad = mesh(new THREE.DodecahedronGeometry(0.17, 0), mats.dark);
        pad.position.set(s * 0.48, 0.74, 0);
        rig.upper.add(pad);
      }
      return () => {};
    },
  },
  {
    id: 'zip',
    name: 'Zip',
    power: 'Super speed',
    lines: ['Already done!', 'Catch me if you can!', 'Zoom zoom!'],
    colors: { body: 0x1f6dff, accent: 0x00e5ff, dark: 0x0b1638, glow: 0x00e5ff },
    torso: { shape: 'capsule', w: 0.46, h: 0.64, d: 0.42 },
    head: { shape: 'sphere', w: 0.5, h: 0.48, d: 0.6 },
    arms: { len: 0.5, r: 0.065, x: 0.29, hand: 0.085 },
    legs: { len: 0.5, r: 0.075, x: 0.11, mat: 'dark', footMat: 'accent' },
    eyes: { count: 0 },
    noMouth: false,
    topExtra: 0.2,
    fx: { colors: [0x00e5ff, 0xffffff, 0x1f6dff], rate: 14, life: [0.25, 0.45], from: 'body', dir: 'back', speed: 2.2, spread: 0.25, gravity: 0, size: [0.06, 0.11] },
    decorate(rig, { mats, mesh, THREE, shapeGeometry }) {
      const visor = mesh(new THREE.TorusGeometry(0.235, 0.05, 10, 32, Math.PI * 0.9), mats.glow, { line: 0.02 });
      visor.rotation.set(Math.PI / 2, 0, Math.PI * 0.05);
      visor.position.set(0, 0.29, 0.06);
      visor.scale.set(1, 1.25, 1);
      rig.head.add(visor);
      rig.mouth.position.y = 0.14;
      const fin = mesh(new THREE.ConeGeometry(0.07, 0.38, 8), mats.accent);
      fin.position.set(0, 0.5, -0.15);
      fin.rotation.x = -1.1;
      rig.head.add(fin);
      for (const s of [1, -1]) {
        const stripe = mesh(new THREE.BoxGeometry(0.04, 0.5, 0.05), mats.accent, { line: 0.012 });
        stripe.position.set(s * 0.12, 0.33, 0.2);
        stripe.rotation.z = s * 0.25;
        rig.upper.add(stripe);
      }
      const tail = new THREE.Group();
      tail.position.set(0, 0.1, -0.18);
      rig.hips.add(tail);
      let parent = tail;
      const segs = [];
      for (let i = 0; i < 3; i++) {
        const seg = new THREE.Group();
        const c = mesh(new THREE.ConeGeometry(0.07 - i * 0.015, 0.22, 10), i === 2 ? mats.accent : mats.body);
        c.rotation.x = -Math.PI / 2;
        c.position.z = -0.1;
        seg.add(c);
        seg.position.z = i === 0 ? 0 : -0.17;
        parent.add(seg);
        parent = seg;
        segs.push(seg);
      }
      tail.rotation.x = -0.5;
      return (t) => {
        segs.forEach((s, i) => (s.rotation.y = Math.sin(t * 8 - i * 0.8) * 0.35));
      };
    },
  },
  {
    id: 'gloop',
    name: 'Gloop',
    power: 'Slime shifter',
    lines: ['Squish!', 'I am 99% goo.', 'Blub blub, hi!'],
    colors: { body: 0x45e06a, accent: 0xb6ff6b, dark: 0x145a2a, glow: 0xb6ff6b },
    opacity: 0.86,
    torso: { shape: 'sphere', w: 0.98, h: 0.82, d: 0.84 },
    head: { shape: 'none', w: 0, h: 0, d: 0 },
    arms: { len: 0.34, r: 0.085, x: 0.46, y: 0.42, hand: 0.1, handMat: 'body' },
    legs: null,
    float: 0.02,
    eyes: { count: 0 },
    emblemY: 0.42,
    topExtra: 0.5,
    fx: { colors: [0xb6ff6b, 0xe8ffd0, 0x45e06a], rate: 6, life: [1, 2], from: 'body', speed: 0.4, spread: 0.4, gravity: 0.25, size: [0.06, 0.14], wobble: 1 },
    decorate(rig, { mats, mesh, THREE }) {
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), mats.glow);
      core.position.set(0.12, 0.38, 0);
      rig.upper.add(core);
      const stalks = [];
      for (const s of [1, -1]) {
        const stalk = new THREE.Group();
        stalk.position.set(s * 0.15, 0.7, 0.1);
        stalk.rotation.z = -s * 0.35;
        const stem = mesh(new THREE.CapsuleGeometry(0.035, 0.24, 4, 8), mats.body);
        stem.position.y = 0.14;
        stalk.add(stem);
        const eyeGroup = new THREE.Group();
        eyeGroup.position.y = 0.32;
        const white = mesh(new THREE.SphereGeometry(0.1, 18, 14), mats.eyeWhite, { line: 0.018 });
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), mats.pupil);
        pupil.position.set(0, 0, 0.075);
        const shine = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), mats.shine);
        shine.position.set(0.025, 0.025, 0.11);
        eyeGroup.add(white, pupil, shine);
        stalk.add(eyeGroup);
        rig.upper.add(stalk);
        rig.eyes.push(eyeGroup);
        stalks.push(stalk);
      }
      rig.mouth.position.set(0, 0.46, 0.41);
      rig.mouth.scale.x = 1.6;
      rig.anchors.head.position.set(0, 0.6, 0);
      return (t) => {
        stalks.forEach((s, i) => (s.rotation.x = Math.sin(t * 3 + i * 1.3) * 0.18));
        rig.torso.scale.set(1 + Math.sin(t * 4) * 0.025, 1 - Math.sin(t * 4) * 0.03, 1 + Math.sin(t * 4) * 0.025);
      };
    },
  },
  {
    id: 'sprout',
    name: 'Sprout',
    power: 'Plant power',
    lines: ['Photosynthesis… and USB!', 'Leaf it to me!', 'Grow, grow, grow!'],
    colors: { body: 0x5cc95c, accent: 0xff7eb6, dark: 0x2d6b2d, glow: 0xc6ff7a },
    torso: { shape: 'capsule', w: 0.52, h: 0.62, d: 0.45 },
    head: { shape: 'sphere', w: 0.58, h: 0.56, d: 0.54 },
    arms: { len: 0.55, r: 0.06, x: 0.3, mat: 'dark', hand: 0.09, handMat: 'body' },
    legs: { len: 0.42, r: 0.08, x: 0.12, mat: 'dark', footMat: 'dark' },
    eyes: { count: 2, size: 0.09, spacing: 0.13 },
    topExtra: 0.4,
    fx: { colors: [0xff7eb6, 0xffc2dc, 0x9be36b], rate: 5, life: [1.6, 2.6], from: 'around', radius: 1.0, speed: 0.2, spread: 0.3, gravity: -0.2, size: [0.07, 0.12], wobble: 1.5, additive: false },
    decorate(rig, { mats, mesh, THREE, toon }) {
      const leafMat = toon(0x7be36b);
      const leaves = [];
      for (const s of [1, -1]) {
        const pivot = new THREE.Group();
        pivot.position.set(s * 0.04, 0.54, 0);
        const leaf = mesh(new THREE.SphereGeometry(0.5, 18, 10), leafMat, { line: 0.012 });
        leaf.scale.set(0.42, 0.05, 0.2);
        leaf.position.x = s * 0.2;
        pivot.add(leaf);
        pivot.rotation.z = s * 0.7;
        rig.head.add(pivot);
        leaves.push(pivot);
      }
      const flower = new THREE.Group();
      flower.position.set(-0.22, 0.42, 0.15);
      flower.rotation.set(0.3, -0.5, 0.3);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const petal = mesh(new THREE.SphereGeometry(0.06, 10, 8), mats.accent, { line: 0.01 });
        petal.scale.set(1, 0.5, 1);
        petal.position.set(Math.cos(a) * 0.07, 0, Math.sin(a) * 0.07);
        flower.add(petal);
      }
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), toon(0xffd84a));
      center.position.y = 0.02;
      flower.add(center);
      flower.rotation.x = Math.PI / 2 - 0.2;
      rig.head.add(flower);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const l = mesh(new THREE.SphereGeometry(0.5, 12, 8), leafMat, { line: 0.01 });
        l.scale.set(0.16, 0.04, 0.1);
        l.position.set(Math.cos(a) * 0.2, 0.62, Math.sin(a) * 0.18);
        l.rotation.y = -a;
        l.rotation.z = 0.4;
        rig.upper.add(l);
      }
      return (t) => {
        leaves.forEach((l, i) => (l.rotation.z = (i ? -1 : 1) * (0.7 + Math.sin(t * 2.5 + i) * 0.15)));
      };
    },
  },
  {
    id: 'gizmo',
    name: 'Gizmo',
    power: 'Robo tinkerer',
    lines: ['Beep boop! Battery detected.', 'Calculating fun… 100%', 'Upgrade complete!'],
    colors: { body: 0xb8c4d6, accent: 0xff9f1c, dark: 0x2c3440, glow: 0xffa62b },
    torso: { shape: 'box', w: 0.7, h: 0.62, d: 0.5 },
    head: { shape: 'box', w: 0.62, h: 0.5, d: 0.5 },
    arms: { len: 0.52, r: 0.075, x: 0.42, mat: 'dark', hand: 0.1 },
    legs: { len: 0.4, r: 0.09, x: 0.17, mat: 'dark', footMat: 'accent' },
    eyes: { count: 2, size: 0.08, spacing: 0.14, style: 'screen', y: 0.55 },
    topExtra: 0.4,
    fx: { colors: [0xffa62b, 0xffe0a0, 0xffffff], rate: 8, life: [0.3, 0.6], from: 'head', speed: 1.6, spread: 0.8, rise: 1, gravity: -3, size: [0.05, 0.09] },
    decorate(rig, { mats, mesh, THREE }) {
      const rod = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.24, 8), mats.dark, { line: 0.01 });
      rod.position.y = 0.62;
      rig.head.add(rod);
      const bulb = mesh(new THREE.SphereGeometry(0.06, 14, 10), mats.glow, { line: 0.015 });
      bulb.position.y = 0.76;
      rig.head.add(bulb);
      for (const s of [1, -1]) {
        const ear = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 16), mats.accent);
        ear.rotation.z = Math.PI / 2;
        ear.position.set(s * 0.33, 0.25, 0);
        rig.head.add(ear);
        const shoulder = mesh(new THREE.SphereGeometry(0.1, 14, 10), mats.accent);
        rig.arms[s > 0 ? 0 : 1].add(shoulder);
      }
      const lights = [0xff4d6d, 0x4dff88, 0x4dc3ff].map((c, i) => {
        const m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: 1.5 });
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), m);
        b.position.set(-0.1 + i * 0.1, 0.18, 0.255);
        rig.upper.add(b);
        return m;
      });
      return (t) => {
        bulb.scale.setScalar(1 + Math.max(0, Math.sin(t * 5)) * 0.3);
        lights.forEach((m, i) => (m.emissiveIntensity = (Math.floor(t * 3 + i) % 3 === 0) ? 3 : 0.4));
      };
    },
  },
  {
    id: 'nova',
    name: 'Nova',
    power: 'Cosmic star',
    lines: ['Written in the stars!', 'To infinity and full charge!', 'Shine bright!'],
    colors: { body: 0x4a2596, accent: 0xff6bd6, dark: 0x1a0d40, glow: 0xffe66b },
    torso: { shape: 'capsule', w: 0.54, h: 0.66, d: 0.46 },
    head: { shape: 'sphere', w: 0.6, h: 0.58, d: 0.56 },
    arms: { len: 0.55, r: 0.075, x: 0.31, hand: 0.095 },
    legs: { len: 0.44, r: 0.085, x: 0.13, footMat: 'accent' },
    eyes: { count: 2, size: 0.1, spacing: 0.14 },
    topExtra: 0.3,
    fx: { colors: [0xffe66b, 0xff6bd6, 0xffffff], rate: 8, life: [0.6, 1.2], from: 'around', radius: 0.9, speed: 0.1, spread: 0.1, gravity: 0, size: [0.05, 0.12], twinkle: 1 },
    decorate(rig, { mats, THREE }) {
      const speckGeo = new THREE.SphereGeometry(0.018, 6, 5);
      const rand = mulberry32(7);
      for (let i = 0; i < 18; i++) {
        const s = new THREE.Mesh(speckGeo, mats.glow);
        const onHead = i < 7;
        const a = rand() * Math.PI - Math.PI / 2;
        const y = onHead ? 0.38 + rand() * 0.15 : 0.12 + rand() * 0.45;
        const r = onHead ? 0.29 : 0.26;
        s.position.set(Math.sin(a) * r, y, Math.cos(a) * r * 0.9);
        (onHead ? rig.head : rig.upper).add(s);
      }
      const orbit = new THREE.Group();
      orbit.position.y = 0.3;
      orbit.rotation.set(0.35, 0, 0.25);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.018, 8, 64), mats.glow);
      ring.rotation.x = Math.PI / 2;
      orbit.add(ring);
      const moon = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), mats.accent);
      orbit.add(moon);
      rig.head.add(orbit);
      return (t, dt, energy) => {
        const a = t * (1.5 + energy * 2);
        moon.position.set(Math.cos(a) * 0.46, 0, Math.sin(a) * 0.46);
      };
    },
  },
  {
    id: 'wisp',
    name: 'Wisp',
    power: 'Phantom spirit',
    lines: ['Boo! Did I scare you?', 'Floating on full power…', 'Ooooo, spooky charge!'],
    colors: { body: 0xe6dcff, accent: 0x9b6bff, dark: 0x2a1a4a, glow: 0xc9a8ff },
    opacity: 0.88,
    hover: true,
    torso: { shape: 'sphere', w: 0.66, h: 0.72, d: 0.58 },
    head: { shape: 'sphere', w: 0.66, h: 0.6, d: 0.6, neck: -0.12 },
    arms: { len: 0.44, r: 0.06, x: 0.32, y: 0.5, hand: 0.075, handMat: 'body' },
    legs: null,
    float: 0.42,
    eyes: { count: 1, size: 0.16, y: 0.55 },
    topExtra: 0.2,
    fx: { colors: [0xc9a8ff, 0xe6dcff, 0x9b6bff], rate: 9, life: [1, 1.8], from: 'feet', speed: 0.25, spread: 0.3, gravity: 0.25, size: [0.12, 0.22] },
    decorate(rig, { mats, mesh, THREE }) {
      const tail = new THREE.Group();
      tail.position.y = 0.05;
      rig.hips.add(tail);
      const segs = [];
      let parent = tail;
      for (let i = 0; i < 3; i++) {
        const seg = new THREE.Group();
        const r = 0.26 - i * 0.08;
        const c = mesh(new THREE.ConeGeometry(r, 0.22, 16, 1, true), mats.body, { line: 0.02 });
        c.material.side = THREE.DoubleSide;
        c.rotation.x = Math.PI;
        c.position.y = -0.1;
        seg.add(c);
        seg.position.y = i === 0 ? 0 : -0.16;
        parent.add(seg);
        parent = seg;
        segs.push(seg);
      }
      const hood = mesh(new THREE.TorusGeometry(0.31, 0.04, 8, 32), mats.accent, { line: 0.012 });
      hood.rotation.x = Math.PI / 2;
      hood.position.y = 0.62;
      rig.upper.add(hood);
      return (t) => {
        segs.forEach((s, i) => (s.rotation.z = Math.sin(t * 3 - i * 0.9) * 0.3));
      };
    },
  },
];

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
