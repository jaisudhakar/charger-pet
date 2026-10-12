// Small browser niceties: a live charge-icon favicon, synthesized sound effects,
// and a screen wake lock while charging.

export function drawChargeIcon(canvas, { level, charging, color }) {
  const s = canvas.width;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, s, s);
  const u = s / 64;
  const x = 4 * u, y = 16 * u, w = 50 * u, h = 32 * u, r = 7 * u;
  const fill = level < 0.2 ? '#ff3b4a' : level < 0.5 ? '#ffb020' : '#3dff7a';

  g.lineWidth = 4 * u;
  g.strokeStyle = color;
  g.fillStyle = '#0d1430';
  roundRect(g, x, y, w, h, r);
  g.fill();
  g.stroke();
  g.fillStyle = color;
  roundRect(g, x + w + 1 * u, y + 10 * u, 6 * u, 12 * u, 2 * u);
  g.fill();

  g.fillStyle = fill;
  const inner = (w - 10 * u) * Math.max(0.06, level);
  roundRect(g, x + 5 * u, y + 5 * u, inner, h - 10 * u, 3 * u);
  g.fill();

  if (charging) {
    g.fillStyle = '#fff27a';
    g.strokeStyle = '#0a0a18';
    g.lineWidth = 2.5 * u;
    g.beginPath();
    const cx = x + w / 2, cy = y + h / 2;
    const pts = [[4, -20], [-10, 2], [-1, 2], [-5, 20], [10, -4], [1, -4]];
    pts.forEach(([px, py], i) => (i ? g.lineTo : g.moveTo).call(g, cx + px * u, cy + py * u));
    g.closePath();
    g.stroke();
    g.fill();
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export class Favicon {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = 64;
    this.link = document.querySelector('link[rel="icon"]') ?? Object.assign(document.createElement('link'), { rel: 'icon' });
    if (!this.link.parentNode) document.head.appendChild(this.link);
    this.key = '';
  }

  update(state) {
    const key = `${Math.round(state.level * 100)}|${state.charging}|${state.color}`;
    if (key === this.key) return;
    this.key = key;
    drawChargeIcon(this.canvas, state);
    this.link.type = 'image/png';
    this.link.href = this.canvas.toDataURL('image/png');
  }
}

export class Sfx {
  constructor() {
    this.enabled = false;
    this.ctx = null;
  }

  unlock() {
    if (!this.enabled) return;
    try {
      this.ctx ??= new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  _tone(f0, f1, dur, type = 'sine', gain = 0.12, delay = 0) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  plug() {
    this._tone(220, 880, 0.35, 'triangle');
    this._tone(440, 1760, 0.3, 'sine', 0.08, 0.12);
  }

  unplug() {
    this._tone(660, 160, 0.4, 'triangle');
  }

  transform() {
    this._tone(180, 1400, 0.45, 'sawtooth', 0.05);
    this._tone(900, 1800, 0.2, 'sine', 0.08, 0.35);
  }

  boop() {
    this._tone(520, 780, 0.12, 'sine', 0.1);
  }
}

export class Awake {
  constructor() {
    this.enabled = true;
    this.sentinel = null;
    this.want = false;
    document.addEventListener('visibilitychange', () => this._apply());
  }

  set(want) {
    this.want = want;
    this._apply();
  }

  async _apply() {
    const should = this.enabled && this.want && document.visibilityState === 'visible';
    if (!('wakeLock' in navigator)) return;
    try {
      if (should && !this.sentinel) {
        this.sentinel = await navigator.wakeLock.request('screen');
        this.sentinel.addEventListener('release', () => (this.sentinel = null));
      } else if (!should && this.sentinel) {
        await this.sentinel.release();
        this.sentinel = null;
      }
    } catch {
      this.sentinel = null;
    }
  }
}
