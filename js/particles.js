// Lightweight GPU point-sprite particles (embers, sparks, snow, bubbles, petals…).
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 pcolor;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = size * uScale / max(0.1, -mv.z);
    vColor = pcolor;
    vAlpha = alpha;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uGain;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d);
    if (a * vAlpha < 0.01) discard;
    gl_FragColor = vec4(vColor * uGain, a * vAlpha);
  }
`;

class Layer {
  constructor(max, additive) {
    this.max = max;
    this.positions = new Float32Array(max * 3);
    this.colors = new Float32Array(max * 3);
    this.sizes = new Float32Array(max);
    this.alphas = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('pcolor', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uScale: { value: 400 }, uGain: { value: additive ? 1.8 : 1.0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.items = [];
  }

  update(dt, t) {
    let n = 0;
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i];
      p.age += dt;
      if (p.age >= p.life) {
        items[i] = items[items.length - 1];
        items.pop();
      }
    }
    for (const p of items) {
      p.vel.y += p.gravity * dt;
      p.vel.multiplyScalar(1 - p.drag * dt);
      p.pos.addScaledVector(p.vel, dt);
      let x = p.pos.x;
      let z = p.pos.z;
      if (p.wobble) {
        x += Math.sin(p.age * 4 + p.seed) * 0.05 * p.wobble;
        z += Math.cos(p.age * 3 + p.seed) * 0.05 * p.wobble;
      }
      const u = p.age / p.life;
      let a = Math.min(1, u * 6) * (1 - u);
      if (p.twinkle) a *= 0.5 + 0.5 * Math.sin(p.age * 18 + p.seed);
      this.positions[n * 3] = x;
      this.positions[n * 3 + 1] = p.pos.y;
      this.positions[n * 3 + 2] = z;
      this.colors[n * 3] = p.color.r;
      this.colors[n * 3 + 1] = p.color.g;
      this.colors[n * 3 + 2] = p.color.b;
      this.sizes[n] = p.size * (1 - u * 0.4);
      this.alphas[n] = a;
      n++;
    }
    const geo = this.points.geometry;
    geo.setDrawRange(0, n);
    for (const k of ['position', 'pcolor', 'size', 'alpha']) geo.attributes[k].needsUpdate = true;
  }
}

export class Particles {
  constructor(max = 700) {
    this.group = new THREE.Group();
    this.glow = new Layer(max, true);
    this.solid = new Layer(Math.floor(max / 2), false);
    this.group.add(this.glow.points, this.solid.points);
  }

  setViewport(heightPx, fovDeg) {
    const s = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
    this.glow.uniforms.uScale.value = s;
    this.solid.uniforms.uScale.value = s;
  }

  emit({ pos, vel, color, size = 0.1, life = 1, gravity = 0, drag = 0.4, wobble = 0, twinkle = 0, additive = true }) {
    const layer = additive ? this.glow : this.solid;
    if (layer.items.length >= layer.max) return;
    layer.items.push({
      pos: pos.clone(),
      vel: vel.clone(),
      color: new THREE.Color(color),
      size, life, gravity, drag, wobble, twinkle,
      age: 0,
      seed: Math.random() * 100,
    });
  }

  burst(origin, colors, count = 50, speed = 3) {
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.randomDirection().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      this.emit({
        pos: origin,
        vel: v,
        color: colors[i % colors.length],
        size: 0.08 + Math.random() * 0.1,
        life: 0.5 + Math.random() * 0.6,
        gravity: -1.5,
        drag: 1.5,
      });
    }
  }

  update(dt, t) {
    this.glow.update(dt, t);
    this.solid.update(dt, t);
  }
}
