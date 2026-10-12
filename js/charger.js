// The 3D charge icon: a glass battery whose fill tracks the real battery level, a glowing
// bolt, and a plug + cable that slides in when the device is charging.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toon, glow, mesh, outline, outlineMaterial, boltGeometry } from './toon.js';

const W = 3.4;
const H = 1.45;
const D = 1.3;
const LIFT = 0.12;
const PAD = 0.17;

const LOW = new THREE.Color(0xff3b4a);
const MID = new THREE.Color(0xffb020);
const HIGH = new THREE.Color(0x3dff7a);

export class ChargerIcon {
  constructor() {
    this.group = new THREE.Group();
    this.top = LIFT + H; // y of the surface the hero stands on
    this.halfWidth = W / 2;
    this.level = 0.5;
    this.shownLevel = 0.5;
    this.charging = false;
    this.plugK = 0; // 0 = unplugged, 1 = plugged in
    this.pulse = 0;

    const body = new THREE.Group();
    body.position.y = LIFT + H / 2;
    this.group.add(body);
    this.body = body;

    // Dark interior panel gives the fill something to glow against.
    const inner = new THREE.Mesh(new RoundedBoxGeometry(W - 0.12, H - 0.12, D - 0.12, 4, 0.22), toon(0x111a33));
    inner.material.side = THREE.BackSide;
    inner.receiveShadow = true;
    body.add(inner);

    // Level fill, anchored on its left edge so scale.x is the level.
    const fillGeo = new THREE.BoxGeometry(1, H - PAD * 2, D - PAD * 2);
    fillGeo.translate(0.5, 0, 0);
    this.fillMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: HIGH.clone(), emissiveIntensity: 1, roughness: 0.4 });
    this.fill = new THREE.Mesh(fillGeo, this.fillMat);
    this.fill.position.x = -W / 2 + PAD;
    body.add(this.fill);
    this.fillMax = W - PAD * 2;

    // Bright sweep that runs through the fill while charging.
    this.sweepMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.sweep = new THREE.Mesh(new THREE.BoxGeometry(0.12, H - PAD * 2 + 0.01, D - PAD * 2 + 0.01), this.sweepMat);
    body.add(this.sweep);

    // Glass shell with a cartoon outline.
    const shellGeo = new RoundedBoxGeometry(W, H, D, 6, 0.3);
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xcfefff, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.1,
      clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false,
    });
    const shell = new THREE.Mesh(shellGeo, glass);
    shell.renderOrder = 2;
    outline(shell, 0.06);
    body.add(shell);
    this.shell = shell;

    // Terminal nub.
    const metal = toon(0x9aa7bd);
    const nub = mesh(new RoundedBoxGeometry(0.24, 0.62, 0.62, 3, 0.08), metal, { line: 0.04 });
    nub.position.x = W / 2 + 0.09;
    body.add(nub);
    this.terminalX = W / 2 + 0.21;

    // Bolt on the front face.
    this.boltMat = glow(0xfff27a, 1);
    const bolt = mesh(boltGeometry(0.12), this.boltMat, { line: 0.03 });
    bolt.scale.setScalar(1.05);
    bolt.position.z = D / 2 + 0.06;
    body.add(bolt);
    this.bolt = bolt;

    // Little rubber feet.
    const feetMat = toon(0x1c2238);
    for (const x of [-W / 2 + 0.5, W / 2 - 0.5]) {
      for (const z of [-D / 2 + 0.3, D / 2 - 0.3]) {
        const f = mesh(new THREE.CylinderGeometry(0.13, 0.15, LIFT + 0.04, 16), feetMat, { line: 0.02 });
        f.position.set(x, (LIFT + 0.04) / 2 - 0.02, z);
        this.group.add(f);
      }
    }

    // Light cast by the battery onto the hero standing on it.
    this.light = new THREE.PointLight(0x3dff7a, 0, 6, 1.6);
    this.light.position.set(0, this.top + 0.3, 0.9);
    this.group.add(this.light);

    this._buildPlug();
  }

  _buildPlug() {
    this.plug = new THREE.Group();
    const dark = toon(0x2a3048);
    const casing = mesh(new RoundedBoxGeometry(0.6, 0.5, 0.5, 3, 0.1), dark, { line: 0.04 });
    casing.position.x = 0.3;
    const collar = mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.25, 16), toon(0x3d4566), { line: 0.03 });
    collar.rotation.z = Math.PI / 2;
    collar.position.x = 0.7;
    this.plugLed = glow(0x3dff7a, 2);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), this.plugLed);
    led.position.set(0.32, 0.12, 0.25);
    const prongMat = toon(0xd9dee8);
    for (const z of [-0.1, 0.1]) {
      const prong = mesh(new THREE.BoxGeometry(0.22, 0.06, 0.04), prongMat, { line: 0.012 });
      prong.position.set(-0.1, 0, z);
      this.plug.add(prong);
    }
    this.plug.add(casing, collar, led);
    this.group.add(this.plug);

    this.cableMat = toon(0x2a3048);
    this.cable = new THREE.Mesh(new THREE.BufferGeometry(), this.cableMat);
    this.cable.castShadow = true;
    this.cableHull = new THREE.Mesh(new THREE.BufferGeometry(), outlineMaterial);
    this.group.add(this.cable, this.cableHull);

    this.orbMat = glow(0x7dffb0, 3);
    this.orbs = [];
    const orbGeo = new THREE.SphereGeometry(0.075, 10, 8);
    for (let i = 0; i < 7; i++) {
      const o = new THREE.Mesh(orbGeo, this.orbMat);
      o.userData.u = i / 7;
      this.group.add(o);
      this.orbs.push(o);
    }
    this._placePlug(true);
  }

  _placePlug(force = false) {
    const k = this.plugK;
    const inX = this.terminalX + 0.08;
    const y0 = LIFT + H / 2;
    const px = inX + (1 - k) * 1.0;
    const py = y0 - (1 - k) * 0.35;
    this.plug.position.set(px, py, 0);
    this.plug.rotation.z = -(1 - k) * 0.35;
    if (!force && Math.abs(this._lastK - k) < 1e-4) return;
    this._lastK = k;
    const end = new THREE.Vector3(px + 0.85 * Math.cos(this.plug.rotation.z), py + 0.85 * Math.sin(this.plug.rotation.z), 0);
    this.curve = new THREE.CatmullRomCurve3([
      end,
      new THREE.Vector3(end.x + 0.6, end.y - 0.1, 0.05),
      new THREE.Vector3(end.x + 1.0, 0.25, 0.2),
      new THREE.Vector3(end.x + 1.8, 0.07, -0.4),
      new THREE.Vector3(9, 0.07, -3),
    ]);
    this.cable.geometry.dispose();
    this.cableHull.geometry.dispose();
    this.cable.geometry = new THREE.TubeGeometry(this.curve, 64, 0.075, 10, false);
    this.cableHull.geometry = new THREE.TubeGeometry(this.curve, 64, 0.1, 10, false);
  }

  setLevel(level) {
    this.level = THREE.MathUtils.clamp(level, 0, 1);
    if (!this.hasLevel) this.shownLevel = this.level;
    this.hasLevel = true;
  }

  setCharging(on) {
    this.charging = on;
  }

  bump(amount = 1) {
    this.pulse = Math.min(1.5, this.pulse + amount);
  }

  update(t, dt) {
    // Plug slides in / out.
    const target = this.charging ? 1 : 0;
    this.plugK += (target - this.plugK) * Math.min(1, dt * 6);
    if (Math.abs(target - this.plugK) < 0.002) this.plugK = target;
    this._placePlug();

    // Smoothly animate the fill toward the real level.
    this.shownLevel += (this.level - this.shownLevel) * Math.min(1, dt * 3);
    const lvl = Math.max(0.03, this.shownLevel);
    this.fill.scale.x = lvl * this.fillMax;

    const c = new THREE.Color();
    if (lvl < 0.35) c.lerpColors(LOW, MID, THREE.MathUtils.smoothstep(lvl, 0.12, 0.3));
    else c.lerpColors(MID, HIGH, THREE.MathUtils.smoothstep(lvl, 0.35, 0.6));
    this.fillMat.emissive.copy(c);
    this.light.color.copy(c);

    let intensity;
    if (this.charging) intensity = 0.95 + Math.sin(t * 4) * 0.15;
    else if (lvl < 0.2) intensity = 0.5 + (Math.sin(t * 6) > 0 ? 0.9 : 0);
    else intensity = 0.7;
    this.pulse = Math.max(0, this.pulse - dt * 2.5);
    this.fillMat.emissiveIntensity = intensity + this.pulse * 1.0;

    // Sweep highlight.
    if (this.charging) {
      const u = (t * 0.6) % 1;
      this.sweep.position.x = -W / 2 + PAD + u * lvl * this.fillMax;
      this.sweepMat.opacity = 0.45 * Math.sin(u * Math.PI);
    } else {
      this.sweepMat.opacity = 0;
    }

    this.boltMat.emissiveIntensity = this.charging ? 2.6 + Math.sin(t * 8) * 0.6 + this.pulse * 2 : 0.35;
    this.bolt.scale.setScalar(1.05 + (this.charging ? Math.sin(t * 8) * 0.04 : 0) + this.pulse * 0.08);
    this.light.intensity = (this.charging ? 1.4 : 0.6) + this.pulse * 1.5;
    this.body.scale.setScalar(1 + this.pulse * 0.025);
    this.plugLed.emissiveIntensity = this.plugK > 0.95 ? 2 + Math.sin(t * 5) : 0;

    // Energy orbs flowing up the cable into the battery.
    const show = this.plugK > 0.95;
    for (const o of this.orbs) {
      o.visible = show;
      if (!show) continue;
      o.userData.u = (o.userData.u - dt * 0.12 + 1) % 1;
      const u = o.userData.u;
      this.curve.getPointAt(u * 0.55, o.position);
      o.scale.setScalar(0.6 + Math.sin(u * Math.PI) * 0.6);
    }
  }
}
