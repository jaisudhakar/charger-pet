import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CatBrain, ANIMS, allSprites, DIRECTIONS } from '../shared/brain.js';

function run(brain, seconds, px, py, dt = 1 / 60) {
  let s;
  for (let t = 0; t < seconds; t += dt) s = brain.update(dt, px, py);
  return s;
}

test('chases the pointer and stops next to it', () => {
  const cat = new CatBrain({ x: 0, y: 0, size: 72 });
  assert.equal(cat.update(1 / 60, 800, -40).anim, 'alert'); // a short "!" before it runs
  const s = run(cat, 0.4, 800, -40);
  assert.equal(s.anim, 'run');
  assert.equal(s.sprite, 'run-E');
  const end = run(cat, 5, 800, -40);
  const [tx, ty] = cat.target(800, -40);
  assert.ok(['sit', 'groom'].includes(end.anim));
  assert.equal(end.x, tx);
  assert.equal(end.y, ty);
});

test('faces the direction it runs in', () => {
  const cases = [
    [0, 500, 'S'], [0, -500, 'N'], [-500, 0, 'W'], [500, 0, 'E'],
    [400, 400, 'SE'], [-400, -400, 'NW'], [-400, 400, 'SW'], [400, -400, 'NE'],
  ];
  for (const [px, py, dir] of cases) {
    const cat = new CatBrain({ size: 72 });
    const [ox, oy] = cat.target(0, 0);
    cat.x = ox;
    cat.y = oy;
    const s = run(cat, 0.6, px, py);
    assert.equal(s.sprite, `run-${dir}`, `pointer at ${px},${py}`);
  }
});

test('sits, grooms, yawns and falls asleep when the pointer stays still', () => {
  const cat = new CatBrain({ size: 72 });
  [cat.x, cat.y] = cat.target(0, 0);
  const seen = new Set();
  for (let t = 0; t < 14; t += 1 / 30) seen.add(cat.update(1 / 30, 0, 0).anim);
  assert.deepEqual([...seen], ['sit', 'groom', 'yawn', 'sleep']);
});

test('wakes up and chases again when the pointer moves', () => {
  const cat = new CatBrain({ size: 72 });
  [cat.x, cat.y] = cat.target(0, 0);
  run(cat, 14, 0, 0);
  assert.equal(cat.state().anim, 'sleep');
  assert.equal(cat.update(1 / 60, 600, 0).anim, 'alert');
  assert.equal(run(cat, 0.7, 600, 0).anim, 'run');
});

test('small pointer jitter does not wake a resting cat', () => {
  const cat = new CatBrain({ size: 72 });
  [cat.x, cat.y] = cat.target(100, 100);
  run(cat, 1, 100, 100);
  assert.equal(run(cat, 1, 110, 105).anim, 'sit');
});

test('frame numbers stay inside each animation', () => {
  const cat = new CatBrain({ size: 72 });
  for (let i = 0; i < 2000; i++) {
    const s = cat.update(1 / 30, Math.sin(i / 50) * 600, Math.cos(i / 70) * 400);
    assert.ok(s.frame >= 0 && s.frame < ANIMS[s.anim].frames);
  }
});

test('lists every sprite the renderers must provide', () => {
  const sprites = allSprites();
  for (const d of DIRECTIONS) assert.equal(sprites[`run-${d}`], ANIMS.run.frames);
  assert.equal(sprites.sleep, ANIMS.sleep.frames);
});
