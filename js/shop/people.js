/* ------------------------------------------------------------------------
   People — shoppers and staff.

   These used to be assembled from capsules here, in three.js, with an
   "animate" function that swung rigid limbs about fixed pivots. They are now
   real skinned characters authored in Blender (see tools/make_human.py) with a
   17-bone skeleton and two animation clips, cloned per person and recoloured.

   The public API is unchanged on purpose: everything in the shop already calls
   buildPerson(...) and then person.userData.animate(t, moving).
   ---------------------------------------------------------------------- */
import { makeCharacter, preloadHuman, BODIES } from './characters.js';

const SKIN = ['#d8a37a', '#c68d63', '#b57a4e', '#a26a42', '#e0b48e'];

let seedCounter = 0;

export function buildPerson(opts = {}) {
  // Cycle through the body set so the crowd is not one person copied six times.
  // A caller can still ask for a specific body with opts.variant.
  const variant = opts.variant || BODIES[seedCounter % BODIES.length];
  const merged = {
    ...opts,
    variant,
    skin: opts.skin || SKIN[seedCounter % SKIN.length],
    scarf: variant === 'scarf' ? (opts.scarf || '#a63a44') : opts.scarf,
    seed: seedCounter++,
  };
  return makeCharacter(merged);
}

/* Warm the model up as soon as the scene boots, so the first shopper is not
   a gap in the aisle. */
export function warmPeople() {
  return Promise.all(BODIES.map((b) => preloadHuman(b)));
}

export function buildWalker(opts) {
  return makeCharacter(opts);
}
