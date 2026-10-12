// Pose-based activities. Each activity writes into a plain pose object, which the
// director cross-fades and the rig applies, so every hero can perform every activity.

export function neutralPose() {
  return {
    x: 0, y: 0, rotX: 0, rotY: 0, rotZ: 0,
    sx: 1, sy: 1, tilt: 0, twist: 0,
    headX: 0, headY: 0, headZ: 0,
    armARaise: 0, armASwing: 0, armBRaise: 0, armBSwing: 0,
    legASwing: 0, legBSwing: 0,
    blink: 0, mood: 1, energy: 0,
  };
}

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const ease = (a, b, t) => smooth(clamp((t - a) / (b - a), 0, 1));

// One hop cycle: crouch → launch → air → land. c is the phase in [0, 1).
function hop(p, c, height, { flip = 0, arms = true } = {}) {
  if (c < 0.2) {
    const k = smooth(c / 0.2);
    p.sy = 1 - 0.16 * k;
    p.sx = 1 + 0.08 * k;
    p.tilt = 0.15 * k;
    if (arms) p.armARaise = p.armBRaise = -0.05;
    if (arms) p.armASwing = p.armBSwing = -0.5 * k;
  } else if (c < 0.78) {
    const u = (c - 0.2) / 0.58;
    p.y = 4 * height * u * (1 - u);
    const stretch = Math.max(0, 1 - u * 3);
    p.sy = 1 + 0.14 * stretch;
    p.sx = 1 - 0.06 * stretch;
    p.legASwing = p.legBSwing = 0.5 * Math.sin(u * Math.PI);
    if (arms) p.armARaise = p.armBRaise = 2.4 * Math.sin(u * Math.PI);
    if (flip) p.rotX = -flip * TAU * smooth(u);
  } else {
    const k = 1 - (c - 0.78) / 0.22;
    p.sy = 1 - 0.18 * Math.sin(k * Math.PI);
    p.sx = 1 + 0.09 * Math.sin(k * Math.PI);
  }
}

export const ACTIVITIES = {
  idle: {
    label: 'Chilling',
    dur: [4, 7],
    fn(p, t) {
      const b = Math.sin(t * 2.2);
      p.sy = 1 + b * 0.025;
      p.sx = 1 - b * 0.012;
      p.headY = Math.sin(t * 0.6) * 0.35;
      p.headZ = Math.sin(t * 0.9) * 0.06;
      p.armARaise = p.armBRaise = 0.05 + b * 0.04;
      p.rotY = Math.sin(t * 0.35) * 0.25;
    },
  },
  wave: {
    label: 'Waving',
    dur: [2.6, 3.4],
    fn(p, t, ctx) {
      const k = ease(0, 0.3, t) * (1 - ease(ctx.dur - 0.35, ctx.dur, t));
      p.armBRaise = k * (2.5 + Math.sin(t * 11) * 0.35);
      p.armBSwing = 0.25 * k;
      p.headZ = 0.15 * k;
      p.headY = 0.12 * k;
      p.rotZ = -0.05 * k;
      p.sy = 1 + Math.sin(t * 5) * 0.02;
    },
  },
  jump: {
    label: 'Jumping',
    dur: [2.2, 2.2],
    fn(p, t) {
      hop(p, (t % 1.1) / 1.1, 0.75);
    },
  },
  backflip: {
    label: 'Backflip!',
    dur: [1.6, 1.6],
    fn(p, t) {
      hop(p, Math.min(t / 1.6, 0.999), 1.25, { flip: 1 });
      p.blink = 0.5;
    },
  },
  dance: {
    label: 'Dancing',
    dur: [5, 7],
    fn(p, t) {
      const b = t * 7;
      p.rotZ = Math.sin(b * 0.5) * 0.12;
      p.x = Math.sin(b * 0.5) * 0.15;
      p.rotY = Math.sin(t * 1.3) * 0.6;
      p.armARaise = 1.3 + Math.sin(b) * 1.0;
      p.armBRaise = 1.3 - Math.sin(b) * 1.0;
      p.armASwing = Math.cos(b) * 0.5;
      p.armBSwing = -Math.cos(b) * 0.5;
      p.legASwing = Math.max(0, Math.sin(b)) * 0.6;
      p.legBSwing = Math.max(0, -Math.sin(b)) * 0.6;
      p.y = Math.abs(Math.sin(b)) * 0.08;
      p.headZ = -Math.sin(b * 0.5) * 0.2;
      p.sy = 1 - Math.abs(Math.cos(b)) * 0.05;
      p.blink = 0.35;
      p.energy = 0.4;
    },
  },
  spin: {
    label: 'Spinning',
    dur: [2.4, 2.4],
    fn(p, t, ctx) {
      const u = clamp(t / ctx.dur, 0, 1);
      p.rotY = (smooth(u) * TAU * 3) % TAU;
      const k = Math.sin(u * Math.PI);
      p.armARaise = p.armBRaise = 1.5 * Math.min(1, k * 2);
      p.y = k * 0.25;
      p.sy = 1 + k * 0.05;
      p.blink = 0.6;
      p.energy = 0.5 * k;
    },
  },
  run: {
    label: 'Running laps',
    dur: [6.98, 6.98],
    fn(p, t, ctx) {
      const w = 0.9;
      p.x = Math.sin(t * w) * ctx.track;
      const dir = Math.cos(t * w);
      p.rotY = (Math.PI / 2) * clamp(dir * 5, -1, 1);
      const s = t * 13;
      p.legASwing = Math.sin(s) * 0.8;
      p.legBSwing = -Math.sin(s) * 0.8;
      p.armASwing = -Math.sin(s) * 0.7;
      p.armBSwing = Math.sin(s) * 0.7;
      p.armARaise = p.armBRaise = 0.15;
      p.tilt = 0.18;
      p.y = Math.abs(Math.sin(s)) * 0.07;
      p.energy = 0.3;
    },
  },
  powerup: {
    label: 'Powering up',
    dur: [3.4, 3.4],
    fn(p, t, ctx) {
      const charge = ease(0, 0.5, t) * (1 - ease(1.5, 1.7, t));
      const burst = ease(1.5, 1.75, t) * (1 - ease(ctx.dur - 0.5, ctx.dur, t));
      p.y = -0.06 * charge + 0.3 * burst + Math.sin(t * 3) * 0.03 * burst;
      p.sy = 1 - 0.08 * charge + 0.06 * burst;
      p.sx = 1 + 0.05 * charge;
      p.x = Math.sin(t * 70) * 0.02 * charge;
      p.armARaise = p.armBRaise = 0.7 * charge + 2.6 * burst;
      p.armASwing = p.armBSwing = -0.5 * charge;
      p.tilt = 0.2 * charge - 0.1 * burst;
      p.headX = 0.15 * charge - 0.3 * burst;
      p.blink = 0.7 * charge;
      p.energy = Math.max(charge, burst * 1.3);
    },
  },
  cheer: {
    label: 'Cheering',
    dur: [2.6, 3.4],
    fn(p, t) {
      p.armARaise = 2.7 + Math.sin(t * 14) * 0.2;
      p.armBRaise = 2.7 + Math.cos(t * 14) * 0.2;
      p.y = Math.abs(Math.sin(t * 7)) * 0.25;
      p.sy = 1 + Math.abs(Math.sin(t * 7)) * 0.05;
      p.legASwing = p.legBSwing = Math.abs(Math.sin(t * 7)) * 0.25;
      p.headX = -0.15;
      p.blink = 0.55;
      p.energy = 0.6;
    },
  },
  pump: {
    label: 'Pumping power',
    dur: [3.6, 4.4],
    fn(p, t, ctx) {
      const k = ease(0, 0.35, t) * (1 - ease(ctx.dur - 0.35, ctx.dur, t));
      const beat = Math.max(0, Math.sin(t * 6));
      p.tilt = 0.55 * k;
      p.y = -0.08 * k - beat * 0.06 * k;
      p.sy = 1 - beat * 0.06 * k;
      p.armASwing = p.armBSwing = (1.1 + beat * 0.3) * k;
      p.armARaise = p.armBRaise = 0.15 * k;
      p.legASwing = p.legBSwing = 0.3 * k;
      p.headX = -0.35 * k;
      p.energy = 0.8 * k;
      if (ctx.onBeat && Math.floor(t * 6 / Math.PI) !== Math.floor((t - ctx.dt) * 6 / Math.PI)) ctx.onBeat();
    },
  },
  stretch: {
    label: 'Stretching',
    dur: [3.2, 3.2],
    fn(p, t, ctx) {
      const k = ease(0.2, 1.1, t) * (1 - ease(ctx.dur - 1, ctx.dur - 0.1, t));
      p.armARaise = p.armBRaise = 2.95 * k;
      p.sy = 1 + 0.08 * k;
      p.sx = 1 - 0.03 * k;
      p.headX = -0.25 * k;
      p.blink = k;
      p.mood = 1 - k * 0.8;
      p.rotZ = Math.sin(t * 2) * 0.06 * k;
    },
  },
  sad: {
    label: 'Feeling drained',
    dur: [4, 6],
    fn(p, t) {
      p.headX = 0.45;
      p.headZ = Math.sin(t * 0.8) * 0.08;
      p.tilt = 0.15;
      p.armARaise = p.armBRaise = -0.08;
      p.sy = 0.96;
      p.rotZ = Math.sin(t) * 0.04;
      p.blink = 0.45;
      p.mood = -1;
    },
  },
  sleep: {
    label: 'Napping',
    dur: [6, 9],
    fn(p, t, ctx) {
      const k = ease(0, 0.8, t) * (1 - ease(ctx.dur - 0.6, ctx.dur, t));
      p.legASwing = p.legBSwing = 1.45 * k;
      p.y = -ctx.legLen * 0.88 * k;
      p.tilt = 0.25 * k;
      p.headX = 0.5 * k;
      p.headZ = 0.2 * k;
      p.armARaise = p.armBRaise = 0.25 * k;
      p.armASwing = p.armBSwing = 0.5 * k;
      p.blink = k;
      p.mood = 1 - 0.8 * k;
      p.sy = 1 + Math.sin(t * 1.6) * 0.03 * k;
    },
  },
};

// Which activities fit which battery mood.
export const POOLS = {
  charging: ['dance', 'powerup', 'cheer', 'run', 'jump', 'spin', 'backflip', 'pump', 'wave', 'pump', 'powerup'],
  full: ['cheer', 'dance', 'spin', 'wave', 'backflip', 'idle'],
  battery: ['idle', 'idle', 'wave', 'stretch', 'run', 'jump', 'idle'],
  low: ['sad', 'sleep', 'sad', 'stretch'],
};

const BLEND = 0.45;

export class Director {
  constructor() {
    this.mode = 'battery';
    this.current = null;
    this.t = 0;
    this.dur = 3;
    this.from = neutralPose();
    this.last = neutralPose();
    this.blendT = BLEND;
    this.blinkTimer = 2;
    this.blinkT = 1;
    this.ctx = { track: 1.1, legLen: 0.4, dur: 3, dt: 0, onBeat: null };
    this.onActivity = null;
    this.play('idle');
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.next();
  }

  play(name, dur) {
    const a = ACTIVITIES[name];
    this.from = { ...this.last };
    this.blendT = 0;
    this.current = name;
    this.t = 0;
    this.dur = dur ?? a.dur[0] + Math.random() * (a.dur[1] - a.dur[0]);
    this.onActivity?.(name, a.label);
  }

  next() {
    const pool = POOLS[this.mode] ?? POOLS.battery;
    let pick = pool[(Math.random() * pool.length) | 0];
    for (let i = 0; i < 4 && pick === this.current; i++) pick = pool[(Math.random() * pool.length) | 0];
    this.play(pick);
  }

  update(dt) {
    this.t += dt;
    this.blendT += dt;
    if (this.t >= this.dur) this.next();

    const p = neutralPose();
    this.ctx.dur = this.dur;
    this.ctx.dt = dt;
    ACTIVITIES[this.current].fn(p, this.t, this.ctx);

    // Natural blinking on top of every activity.
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkT = 0;
      this.blinkTimer = 2.5 + Math.random() * 3;
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
