// One interface over both kinds of pet (the biped heroes and the cats): each pet gets its
// own activity director, and `animate()` advances, poses and updates it in one call.
import { HEROES, buildHero, applyPose, updateHero } from './characters.js';
import { Director, neutralPose } from './activities.js';
import { CATS, buildCat, applyCatPose, updateCat, CatDirector, catPose } from './cat.js';

export const PETS = [...CATS, ...HEROES];
export const DEFAULT_PET = CATS[0].id;
export const isCat = (def) => def?.kind === 'cat';

export function findPet(id) {
  return PETS.find((p) => p.id === id);
}

// opts: { heroPools, catPools, track, facing, inPlace, jumpH }
export function createPet(def, opts = {}) {
  if (isCat(def)) {
    const rig = buildCat(def);
    const director = new CatDirector(opts.catPools ? { pools: opts.catPools } : {});
    Object.assign(director.ctx, {
      track: opts.track ?? 1.1,
      facing: opts.facing ?? 0.5,
      inPlace: !!opts.inPlace,
      jumpH: opts.jumpH,
      runHz: opts.runHz,
    });
    rig.director = director;
    rig.animate = (dt, t, energyFloor = 0) => {
      const p = director.update(dt);
      applyCatPose(rig, p, t);
      const e = Math.max(p.energy, energyFloor);
      updateCat(rig, t, dt, e);
      return e;
    };
    rig.restPose = () => {
      const p = catPose();
      p.rotY = 0.6;
      applyCatPose(rig, p, 0);
      updateCat(rig, 0, 0, 0);
    };
    return rig;
  }
  const rig = buildHero(def);
  const director = new Director(opts.heroPools ? { pools: opts.heroPools } : {});
  director.ctx.track = opts.track ?? 1.1;
  director.ctx.legLen = rig.legLen;
  rig.director = director;
  rig.animate = (dt, t, energyFloor = 0) => {
    const p = director.update(dt);
    applyPose(rig, p, t);
    const e = Math.max(p.energy, energyFloor);
    updateHero(rig, t, dt, e);
    return e;
  };
  rig.restPose = () => {
    applyPose(rig, neutralPose(), 0);
    updateHero(rig, 0, 0, 0);
  };
  return rig;
}
