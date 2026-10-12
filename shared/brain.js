// The cat's brain, shared by the desktop app (Windows/macOS/Linux X11) and the GNOME
// Shell extension (Ubuntu). It is plain JavaScript with no platform APIs: feed it the
// pointer position every tick and it returns where the cat is and which sprite to show.
//
// Behaviour (like the classic "Neko"): the cat chases the pointer; once it catches up it
// sits, grooms, yawns and falls asleep. Moving the pointer away wakes it up again.

// Sprite sheet geometry: every frame is SIZE×SIZE pixels and the cat's feet are at
// (ANCHOR_X, ANCHOR_Y) in every frame.
export const SPRITE = { size: 128, anchorX: 64, anchorY: 112 };

// Screen directions, y pointing down; index = round(angle / 45°).
export const DIRECTIONS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];

export const ANIMS = {
  run: { frames: 8, fps: 14, loop: true, directional: true },
  sit: { frames: 12, fps: 8, loop: true },
  alert: { frames: 4, fps: 12, loop: false },
  groom: { frames: 12, fps: 10, loop: true },
  yawn: { frames: 10, fps: 10, loop: false },
  sleep: { frames: 16, fps: 6, loop: true },
};

export const COATS = ['ginger', 'smokey', 'snowball'];

export function spriteName(anim, dir) {
  return ANIMS[anim].directional ? `${anim}-${dir}` : anim;
}

// Every sprite the renderers need to load, as "name" → frame count.
export function allSprites() {
  const out = {};
  for (const [anim, a] of Object.entries(ANIMS)) {
    if (a.directional) for (const d of DIRECTIONS) out[`${anim}-${d}`] = a.frames;
    else out[anim] = a.frames;
  }
  return out;
}

// What the cat does after it reaches the pointer, in order (seconds).
const IDLE = [
  ['sit', 4],
  ['groom', 3],
  ['sit', 2],
  ['yawn', 1],
  ['sleep', Infinity],
];

export class CatBrain {
  // size: on-screen sprite size in pixels; speed: multiplier (1 = normal).
  constructor({ x = 0, y = 0, size = 72, speed = 1 } = {}) {
    this.x = x;
    this.y = y;
    this.dir = 'S';
    this.anim = 'sit';
    this.t = 0; // time in the current animation
    this.idleStep = 0;
    this.idleT = 0;
    this.after = null; // what to do once a one-shot animation ends
    this.configure({ size, speed });
  }

  configure({ size = this.size, speed = this.speedFactor } = {}) {
    this.size = size;
    this.speedFactor = speed;
    this.speed = size * 3.4 * speed; // pixels per second
    this.wakeDistance = size * 0.6;
  }

  // Where the cat's feet go: just below and to the right of the pointer, so the cat
  // never covers what you are pointing at.
  target(px, py) {
    return [px + this.size * 0.35, py + this.size * 0.8];
  }

  update(dt, px, py) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    const [tx, ty] = this.target(px, py);
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    this.t += dt;

    switch (this.anim) {
      case 'run': {
        const step = this.speed * dt;
        if (dist <= step) {
          this.x = tx;
          this.y = ty;
          this._rest();
        } else {
          this.x += (dx / dist) * step;
          this.y += (dy / dist) * step;
          this._face(dx, dy);
        }
        break;
      }
      case 'alert':
        if (this.t >= this.alertTime) this._play('run');
        break;
      default: {
        // Resting (sit/groom/yawn/sleep): wake up when the pointer moves away.
        if (dist > this.wakeDistance) {
          this._face(dx, dy);
          this.alertTime = this.anim === 'sleep' ? 0.6 : 0.25;
          this._play('alert');
          break;
        }
        this.idleT += dt;
        const [, duration] = IDLE[this.idleStep];
        if (this.idleT >= duration && this.idleStep < IDLE.length - 1) {
          this.idleStep++;
          this.idleT = 0;
          this._play(IDLE[this.idleStep][0]);
        }
      }
    }
    return this.state();
  }

  state() {
    const a = ANIMS[this.anim];
    let frame = Math.floor(this.t * a.fps);
    frame = a.loop ? frame % a.frames : Math.min(frame, a.frames - 1);
    return { x: this.x, y: this.y, anim: this.anim, sprite: spriteName(this.anim, this.dir), frame };
  }

  _rest() {
    this.idleStep = 0;
    this.idleT = 0;
    this._play('sit');
  }

  _play(anim) {
    if (this.anim !== anim) this.t = 0;
    this.anim = anim;
  }

  // Pick the 8-way direction, with some hysteresis so it doesn't flicker on diagonals.
  _face(dx, dy) {
    if (dx === 0 && dy === 0) return;
    const angle = Math.atan2(dy, dx);
    const current = DIRECTIONS.indexOf(this.dir) * (Math.PI / 4);
    let diff = Math.abs(angle - current) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < Math.PI / 8 + 0.15) return;
    const i = Math.round(angle / (Math.PI / 4));
    this.dir = DIRECTIONS[(i + 8) % 8];
  }
}
