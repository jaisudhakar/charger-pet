// Battery state from the Battery Status API, with a demo simulator for browsers that
// do not expose it (Safari, Firefox) or for trying the pet without a cable.

export class BatteryMonitor extends EventTarget {
  constructor() {
    super();
    this.supported = false;
    this.demo = false;
    this.real = null;
    this.level = 0.42;
    this.charging = false;
    this.chargingTime = Infinity;
    this.dischargingTime = Infinity;
    this._sim = { level: 0.42, charging: false };
  }

  async init() {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        this.real = await navigator.getBattery();
        this.supported = true;
        const sync = () => this._sync();
        for (const ev of ['chargingchange', 'levelchange', 'chargingtimechange', 'dischargingtimechange']) {
          this.real.addEventListener(ev, sync);
        }
      } catch {
        this.supported = false;
      }
    }
    if (!this.supported) this.demo = true;
    this._sync();
  }

  setDemo(on) {
    const next = on || !this.supported;
    if (next && !this.demo) {
      this._sim.level = this.level;
      this._sim.charging = this.charging;
    }
    this.demo = next;
    this._sync();
  }

  toggleDemoPlug() {
    if (!this.demo) return;
    this._sim.charging = !this._sim.charging;
    this._sync();
  }

  setDemoLevel(level) {
    this._sim.level = Math.min(1, Math.max(0, level));
    this._sync();
  }

  // Advances the simulator; real batteries update through events.
  tick(dt) {
    if (!this.demo) return;
    const before = Math.round(this._sim.level * 100);
    if (this._sim.charging) this._sim.level = Math.min(1, this._sim.level + dt / 70);
    else this._sim.level = Math.max(0.01, this._sim.level - dt / 900);
    if (Math.round(this._sim.level * 100) !== before) this._sync();
  }

  _sync() {
    const prevCharging = this.charging;
    if (this.demo) {
      this.level = this._sim.level;
      this.charging = this._sim.charging;
      this.chargingTime = this.charging ? (1 - this.level) * 70 : Infinity;
      this.dischargingTime = this.charging ? Infinity : this.level * 900;
    } else {
      this.level = this.real.level;
      this.charging = this.real.charging;
      this.chargingTime = this.real.chargingTime;
      this.dischargingTime = this.real.dischargingTime;
    }
    this.dispatchEvent(new CustomEvent('change', {
      detail: { plugged: !prevCharging && this.charging, unplugged: prevCharging && !this.charging },
    }));
  }

  get mode() {
    if (this.charging) return this.level >= 0.995 ? 'full' : 'charging';
    return this.level < 0.2 ? 'low' : 'battery';
  }
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const m = Math.round(seconds / 60);
  if (m < 1) return '<1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}
