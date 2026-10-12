// Procedural cel-shaded 3D cat used to render the sprite frames. The cat faces +z,
// stands on y = 0 and is posed through a small set of joint angles.
import * as THREE from 'three';

export const COAT_COLORS = {
  ginger: { fur: 0xff9a3c, light: 0xfff1de, dark: 0xc8601a, eye: 0x7ddc5a, collar: 0xff3b5c, stripes: true },
  smokey: { fur: 0x8d96a8, light: 0xeef1f7, dark: 0x596173, eye: 0xffc83d, collar: 0x2bd9ff, stripes: true },
  snowball: { fur: 0xebe6dc, light: 0xf7f4ee, dark: 0xc9c0b2, eye: 0x55b7ff, collar: 0xff7eb6, stripes: false },
};

const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([70, 150, 215, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap });
const inkMat = new THREE.MeshBasicMaterial({ color: 0x15121c, side: THREE.BackSide });

function part(geo, mat, line = 0.022) {
  const m = new THREE.Mesh(geo, mat);
  if (line > 0) {
    geo.computeBoundingSphere();
    const hull = new THREE.Mesh(geo, inkMat);
    hull.scale.setScalar(1 + line / Math.max(geo.boundingSphere.radius, 0.01));
    m.add(hull);
  }
  return m;
}

const R = 0.2; // torso radius
const LEG = 0.27;
const H0 = LEG + R * 0.75; // torso centre height
const LEG_LEN = H0 - R * 0.5;

export function buildCat(coat) {
  const C = COAT_COLORS[coat];
  const m = {
    fur: toon(C.fur), light: toon(C.light), dark: toon(C.dark), pink: toon(0xff9fb0),
    white: toon(0xffffff), iris: toon(C.eye), pupil: toon(0x111122), collar: toon(C.collar),
    mouth: toon(0x7a2236), shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    whisker: new THREE.MeshBasicMaterial({ color: 0x2b2633 }),
  };

  const root = new THREE.Group();
  const body = new THREE.Group(); // torso centre; pitch/height animate here
  body.position.y = H0;
  root.add(body);

  const torsoGeo = new THREE.CapsuleGeometry(R, 0.46, 8, 20);
  torsoGeo.rotateX(Math.PI / 2);
  body.add(part(torsoGeo, m.fur, 0.03));
  const chest = part(new THREE.SphereGeometry(0.5, 16, 12), m.light, 0);
  chest.scale.set(0.27, 0.28, 0.2);
  chest.position.set(0, -0.03, 0.34);
  body.add(chest);
  if (C.stripes) {
    for (const z of [-0.2, -0.07, 0.06]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(R * 0.99, 0.026, 6, 20, Math.PI * 0.8), m.dark);
      band.rotation.z = Math.PI * 0.1;
      band.position.z = z;
      body.add(band);
    }
  }

  // Head
  const head = new THREE.Group();
  head.position.set(0, R * 0.6, 0.38);
  body.add(head);
  const skull = part(new THREE.SphereGeometry(0.235, 24, 18), m.fur, 0.03);
  skull.scale.set(1.1, 0.93, 0.95);
  skull.position.set(0, 0.12, 0.06);
  head.add(skull);
  const ears = [];
  for (const s of [1, -1]) {
    const ear = new THREE.Group();
    ear.position.set(s * 0.13, 0.3, 0.04);
    ear.rotation.z = -s * 0.3;
    const outer = part(new THREE.ConeGeometry(0.085, 0.2, 12), m.fur, 0.02);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.13, 10), m.pink);
    inner.position.set(0, -0.02, 0.035);
    ear.add(outer, inner);
    head.add(ear);
    ears.push(ear);
  }
  const eyes = [];
  for (const s of [1, -1]) {
    const eye = new THREE.Group();
    eye.position.set(s * 0.095, 0.14, 0.255);
    const white = part(new THREE.SphereGeometry(0.064, 18, 14), m.white, 0.014);
    white.scale.z = 0.5;
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), m.iris);
    iris.scale.z = 0.5;
    iris.position.z = 0.012;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.046, 12, 10), m.pupil);
    pupil.scale.set(0.4, 1, 0.5);
    pupil.position.z = 0.022;
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), m.shine);
    shine.position.set(0.018, 0.022, 0.036);
    eye.add(white, iris, pupil, shine);
    head.add(eye);
    eyes.push(eye);
  }
  for (const s of [1, -1]) {
    const cheek = part(new THREE.SphereGeometry(0.06, 14, 10), m.light, 0);
    cheek.scale.set(1.1, 0.8, 0.8);
    cheek.position.set(s * 0.042, 0.045, 0.27);
    head.add(cheek);
    for (let k = 0; k < 3; k++) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4), m.whisker);
      w.rotation.z = Math.PI / 2 + s * (k - 1) * 0.18;
      w.position.set(s * 0.17, 0.055 - (k - 1) * 0.022, 0.25);
      head.add(w);
    }
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), m.pink);
  nose.scale.set(1.3, 0.8, 1);
  nose.position.set(0, 0.085, 0.31);
  head.add(nose);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), m.mouth);
  mouth.position.set(0, 0.0, 0.27);
  mouth.scale.set(1, 0.01, 0.5);
  head.add(mouth);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.025, 8, 28), m.collar);
  collar.rotation.x = Math.PI / 2 - 0.35;
  collar.position.set(0, -0.02, 0);
  head.add(collar);

  // Legs: front at +z, back at -z.
  const legs = {};
  for (const [name, x, z] of [['FL', 0.11, 0.26], ['FR', -0.11, 0.26], ['BL', 0.11, -0.26], ['BR', -0.11, -0.26]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, -R * 0.5, z);
    const leg = part(new THREE.CapsuleGeometry(0.06, LEG_LEN - 0.12, 6, 12), m.fur, 0.02);
    leg.position.y = -LEG_LEN / 2 + 0.03;
    const paw = part(new THREE.SphereGeometry(0.068, 14, 10), m.light, 0.018);
    paw.scale.set(1, 0.62, 1.3);
    paw.position.set(0, -LEG_LEN + 0.04, 0.02);
    pivot.add(leg, paw);
    body.add(pivot);
    legs[name] = pivot;
  }

  // Tail: a chain of segments that curl and sway.
  const tail = [];
  let parent = body;
  for (let i = 0; i < 7; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, i === 0 ? R * 0.35 : 0, i === 0 ? -0.42 : -0.082);
    const ball = part(new THREE.SphereGeometry(0.056 - i * 0.004, 12, 10), i >= 5 && C.stripes ? m.dark : m.fur, 0.014);
    ball.scale.z = 1.5;
    ball.position.z = -0.04;
    seg.add(ball);
    parent.add(seg);
    parent = seg;
    tail.push(seg);
  }

  return { root, body, head, ears, eyes, mouth, legs, tail };
}

export function restPose() {
  return {
    yaw: 0, y: 0, pitch: 0, roll: 0, stretch: 1, sy: 1,
    headX: 0, headY: 0, headZ: 0,
    FL: 0, FR: 0, BL: 0, BR: 0, frontLen: 1,
    tailUp: 0.6, tailCurl: 0.12, tailWrap: 0, tailWag: 0, tailPhase: 0,
    ears: 0, blink: 0, mouth: 0,
  };
}

export function applyPose(cat, p) {
  cat.root.rotation.y = p.yaw;
  cat.body.position.y = H0 + p.y;
  cat.body.rotation.set(p.pitch, 0, p.roll);
  cat.body.scale.set(1, p.sy, p.stretch);
  cat.head.rotation.set(p.headX, p.headY, p.headZ);
  for (const k of ['FL', 'FR', 'BL', 'BR']) cat.legs[k].rotation.x = -p[k];
  cat.legs.FL.scale.y = cat.legs.FR.scale.y = p.frontLen;
  cat.tail.forEach((seg, i) => {
    seg.rotation.x = i === 0 ? p.tailUp : p.tailCurl;
    seg.rotation.y = p.tailWrap + p.tailWag * Math.sin(p.tailPhase * Math.PI * 2 - i * 0.7);
  });
  for (const e of cat.ears) e.rotation.x = -p.ears * 0.7;
  for (const e of cat.eyes) e.scale.y = Math.max(0.08, 1 - p.blink);
  cat.mouth.scale.y = Math.max(0.01, p.mouth);
  cat.mouth.visible = p.mouth > 0.02;
}

// ------------------------------------------------------------------ poses
const TAU = Math.PI * 2;

function sitBase(p) {
  p.pitch = -0.55;
  p.y = -0.07;
  p.FL = p.FR = -0.55;
  p.frontLen = 1.28;
  p.BL = p.BR = 1.35;
  p.headX = 0.45;
  p.tailUp = -0.55;
  p.tailCurl = 0.05;
  p.tailWrap = 0.3;
  return p;
}

function lyingBase(p) {
  p.y = -(H0 - R * 0.95);
  p.FL = p.FR = 1.45;
  p.BL = p.BR = 1.5;
  p.tailUp = -0.15;
  p.tailCurl = 0.03;
  p.tailWrap = 0.35;
  return p;
}

// u: progress through the loop, 0..1. yaw: facing.
export const POSES = {
  run(u, yaw) {
    const p = restPose();
    const a = u * TAU;
    p.yaw = yaw;
    p.FL = Math.sin(a) * 0.95;
    p.FR = Math.sin(a - 0.5) * 0.95;
    p.BL = Math.sin(a + Math.PI) * 0.9;
    p.BR = Math.sin(a + Math.PI - 0.5) * 0.9;
    p.pitch = Math.sin(a + 0.6) * 0.13;
    p.y = Math.abs(Math.sin(a)) * 0.07;
    p.stretch = 1 + Math.sin(a + Math.PI / 2) * 0.07;
    p.headX = -Math.sin(a + 0.6) * 0.12;
    p.tailUp = 0.3;
    p.tailCurl = 0.05;
    p.tailWag = 0.15;
    p.tailPhase = u;
    p.ears = 0.45;
    return p;
  },
  sit(u, yaw) {
    const p = sitBase(restPose());
    p.yaw = yaw;
    p.headZ = Math.sin(u * TAU) * 0.1;
    p.headY = Math.sin(u * TAU) * 0.15;
    p.tailWag = 0.18;
    p.tailPhase = u;
    p.blink = u > 0.7 && u < 0.8 ? 1 : 0;
    return p;
  },
  alert(u, yaw) {
    const p = sitBase(restPose());
    p.yaw = yaw;
    p.y += Math.sin(Math.min(u * 1.3, 1) * Math.PI) * 0.08;
    p.headX = 0.25;
    p.ears = -0.3;
    p.tailUp = 0.6;
    p.tailWrap = 0;
    p.tailCurl = 0.25;
    return p;
  },
  groom(u, yaw) {
    const p = sitBase(restPose());
    p.yaw = yaw;
    p.FR = -0.55 + 2.0;
    p.headX = 0.8 + Math.sin(u * TAU * 2) * 0.12;
    p.headY = -0.35;
    p.blink = 0.85;
    p.tailWag = 0.1;
    p.tailPhase = u;
    return p;
  },
  yawn(u, yaw) {
    const p = sitBase(restPose());
    const k = Math.sin(u * Math.PI);
    p.yaw = yaw;
    p.headX = 0.45 - 0.6 * k;
    p.mouth = 1.4 * k;
    p.blink = k;
    p.ears = 0.4 * k;
    p.sy = 1 + 0.04 * k;
    return p;
  },
  sleep(u, yaw) {
    const p = lyingBase(restPose());
    p.yaw = yaw;
    p.headX = 0.42;
    p.headZ = 0.35;
    p.blink = 1;
    p.sy = 1 + Math.sin(u * TAU) * 0.04;
    p.tailWag = 0.04;
    p.tailPhase = u;
    return p;
  },
};
