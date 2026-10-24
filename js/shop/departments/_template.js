/* ============================================================
   TEMPLATE — copy this file to add a new department.
   ------------------------------------------------------------
   1. Copy this file to js/shop/departments/<your-department>.js
   2. Change id / name / nameBn / icon / colour
   3. Write the sections and products (see rice.js for a full example)
   4. Register it in js/shop/departments/index.js
   5. Set `open: true` on it there, and it becomes walkable

   Nothing else needs to change. The aisle geometry, lighting,
   shelf talkers, price rails, the in-hand viewer, search and the
   trolley all read from this object.
   ============================================================ */

export default {
  /* ---- identity ---- */
  id: 'oils-and-ghee',              // url-ish, lowercase, unique
  name: 'Oil & Ghee',               // English name shown in the map
  nameBn: 'তেল ও ঘি',                // Bangla name
  icon: '🫗',                        // emoji for the map and HUD
  colour: '#e0a92b',                // dominates the department palette
  accent: '#0d6138',                // drawn on packaging as the brand band
  tagline: 'What the pan needs every single day',
  taglineBn: 'প্রতিদিনের রান্নার তেল',

  /* ---- shelves ----
     bays: how many 6.2 m shelf runs on each side.
           1 bay  = a short corner-shop aisle
           3 bays = the rice department
           5 bays = a full supermarket run
     levels: 4 is realistic; 5 works for small packs.
     facings: how many products stand side by side per level.
     bulkDisplay: 'sacks' | 'crates' | 'none'
     endcap: 'weigh-counter' | 'fridge' | 'none' */
  layout: {
    bays: 2,
    levels: 4,
    facings: { desktop: 8, mobile: 6 },
    bulkDisplay: 'none',
    endcap: 'none',
  },

  /* ---- sections inside the department ----
     `bays` says which bays this section occupies, so the hanging
     signs land in the right place. A section can share a bay. */
  sections: [
    { id: 'cooking-oil', name: 'Cooking Oil', nameBn: 'রান্নার তেল', bays: [0], note: 'Soybean, mustard, sunflower' },
    { id: 'ghee-butter', name: 'Ghee & Butter', nameBn: 'ঘি ও মাখন', bays: [1], note: 'Pure ghee and table butter' },
  ],

  /* ---- products ----
     required: id, section, name, bn, brand, unit, weight, shape,
               price, colour, accent
     optional: mrp, rating, sold, tier, origin, grade, cook, blurb
     shape: sack | pouch | box | bottle | jar
     tier:  1 = full 3D in hand · 2 = turntable · 3 = front/back      */
  products: [
    {
      id: 'o01', section: 'cooking-oil',
      name: 'Soybean Oil', bn: 'সয়াবিন তেল',
      brand: 'Fresh', unit: '5 litre bottle', weight: '5 l',
      shape: 'bottle', price: 890, mrp: 950,
      colour: '#e8b93f', accent: '#c0392b',
      rating: 4.7, sold: 4100, tier: 1, origin: 'Dhaka', grade: 'Refined',
      cook: 'Neutral flavour, high smoke point — the default pan oil.',
      blurb: 'The bottle every Bangladeshi kitchen buys without thinking.',
    },
  ],

  /* ---- bulk display bags/sacks stacked at the aisle mouth ---- */
  bulk: [],

  /* ---- shelf talkers: small "OFFER" cards clipped above the rail ---- */
  talkers: [],
};
