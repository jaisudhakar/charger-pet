// Shared cel-shading helpers: toon materials, glow materials and inverted-hull outlines.
import * as THREE from 'three';

const gradientMap = (() => {
  const data = new Uint8Array([60, 130, 200, 255]);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

export function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.opacity !== undefined && opts.opacity < 1,
    opacity: opts.opacity ?? 1,
  });
}

// Emissive material that is bright enough to trigger the bloom pass.
export function glow(color, intensity = 2.5) {
  return new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 1,
    metalness: 0,
  });
}

export const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0x0a0a18, side: THREE.BackSide });
const noRaycast = () => {};

// Adds a slightly larger back-face copy behind the mesh to draw a cartoon outline.
export function outline(mesh, thickness = 0.035) {
  const geo = mesh.geometry;
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  const r = Math.max(geo.boundingSphere.radius, 0.01);
  const hull = new THREE.Mesh(geo, outlineMaterial);
  hull.scale.setScalar(1 + thickness / r);
  hull.raycast = noRaycast;
  hull.userData.isOutline = true;
  mesh.add(hull);
  return mesh;
}

export function mesh(geometry, material, { line = 0.035, shadow = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = shadow;
  m.receiveShadow = false;
  if (line > 0) outline(m, line);
  return m;
}

// Lightning-bolt silhouette, roughly 1 unit tall, centred on the origin.
export function boltShape() {
  const s = new THREE.Shape();
  s.moveTo(0.12, 0.5);
  s.lineTo(-0.28, -0.04);
  s.lineTo(-0.02, -0.04);
  s.lineTo(-0.14, -0.5);
  s.lineTo(0.3, 0.08);
  s.lineTo(0.03, 0.08);
  s.closePath();
  return s;
}

export function boltGeometry(depth = 0.08) {
  const geo = new THREE.ExtrudeGeometry(boltShape(), {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}
