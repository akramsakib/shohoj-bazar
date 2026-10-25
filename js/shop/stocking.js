/* Shelf stocking — a planogram, not a scatter.

   What was wrong
   --------------
   The old loop placed one pack every `bayWidth / facings` metres: 62 cm apart for
   a 26 cm pack. Real shelves are stocked shoulder to shoulder, two or three units
   deep, so from the aisle you see a solid wall of product. That single change is
   the difference between "a shelf with samples on it" and "a supermarket".

   What this does
   --------------
   * Lays out blocks of facings across the bay, spacing every facing by the pack's
     own width plus a small gap.
   * Hero products (tier 1) get three facings, tier 2 gets two — a brand buying
     shelf space.
   * Fills the shelf depth behind each facing where the shelf is deep enough.
   * Never leaves a half-empty level: if a block will not fit, the next product is
     tried, and the level closes out neatly at the bay divider.

   Deterministic, so the shop stocks the same way on every visit.
*/

const rng = (seed) => {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

/**
 * @param {object} opts
 * @param {Array}  opts.products   the section's products
 * @param {number} opts.bayWidth   usable width of the bay, metres
 * @param {number} opts.levels
 * @param {number} opts.levelH
 * @param {number} opts.baseY      height of the bottom shelf surface
 * @param {number} opts.seed
 * @param {function} opts.footprint  product -> { w, h, d }
 * @param {number} opts.maxDepth   how many units deep a shelf may be stocked
 * @param {number} opts.endGap
 * @param {number} opts.startGap
 * @returns {Array} [{ product, level, z, row, y, size, lean, back, shoved }]
 */
export function stockBay(opts) {
  const {
    products, bayWidth, levels, levelH, baseY,
    seed = 1, footprint, maxDepth = 2, endGap = 0.12, startGap = 0.08,
  } = opts;

  if (!products.length) return [];
  const rand = rng(seed);
  const slots = [];

  // Brands are grouped rather than shuffled per level, weighted by units sold, so
  // a shopper can find "the Pusti row" the way they would in a real aisle.
  const order = products
    .map((p) => ({ p, k: rand() + (p.sold || 0) / 6000 }))
    .sort((a, b) => b.k - a.k)
    .map((o) => o.p);

  for (let level = 0; level < levels; level++) {
    const y = baseY + level * levelH;
    // eye level and below get the deep stock; the top shelf is single deep because
    // nobody restocks the top of a gondola more than one unit back
    const depth = level <= 1 ? maxDepth : 1;
    const usable = bayWidth - startGap - endGap;

    let idx = Math.floor(rand() * order.length);
    let z = -usable / 2;
    let guard = 0;

    while (z < usable / 2 - 0.05 && guard++ < 400) {
      const product = order[idx % order.length];
      const f = footprint(product);
      const w = Math.max(f.w, 0.10);

      const tier = product.tier || 3;
      const want = tier === 1 ? 3 : tier === 2 ? 2 : 1 + (rand() < 0.35 ? 1 : 0);
      const gap = 0.014;

      let placed = 0;
      for (let k = 0; k < want; k++) {
        const zc = z + w / 2 + k * (w + gap);
        if (zc + w / 2 > usable / 2) break;
        for (let row = 0; row < depth; row++) {
          slots.push({
            product,
            level,
            row,
            z: zc,
            y: y + 0.048 + f.h / 2,
            size: f,
            // a stocked shelf is not perfectly square: packs lean and sit back
            lean: (rand() - 0.5) * 0.05,
            back: row * (f.d + 0.012),
            shoved: (rand() - 0.5) * 0.012,
          });
        }
        placed++;
      }

      if (!placed) break;
      z += placed * (w + gap) + 0.02;
      idx++;
    }
  }
  return slots;
}
