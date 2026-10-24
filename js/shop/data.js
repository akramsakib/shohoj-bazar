/* Shohoj Bazar — Section 1 data: departments, staff, aisle products
   Prices are indicative for the prototype. Real catalogue arrives in Section 4. */

export const DEPARTMENTS = [
  { id: 'rice',     en: 'Rice & Grains',       bn: 'চাল ও দানা',        icon: '🌾', colour: '#c9a961', aisle: 1 },
  { id: 'oil',      en: 'Oil & Ghee',          bn: 'তেল ও ঘি',          icon: '🫗', colour: '#e0a92b', aisle: 2 },
  { id: 'spices',   en: 'Spices & Masala',     bn: 'মসলা',              icon: '🌶️', colour: '#c0392b', aisle: 3 },
  { id: 'pulses',   en: 'Pulses & Lentils',    bn: 'ডাল',               icon: '🫘', colour: '#b98a4b', aisle: 4 },
  { id: 'veg',      en: 'Fresh Vegetables',    bn: 'তাজা সবজি',         icon: '🥬', colour: '#4a9d4f', aisle: 5 },
  { id: 'fruit',    en: 'Fresh Fruit',         bn: 'তাজা ফল',           icon: '🍎', colour: '#d64545', aisle: 6 },
  { id: 'protein',  en: 'Fish & Meat',         bn: 'মাছ ও মাংস',        icon: '🐟', colour: '#3b7fa8', aisle: 7 },
  { id: 'dairy',    en: 'Dairy & Eggs',        bn: 'দুধ ও ডিম',         icon: '🥛', colour: '#5b8fd6', aisle: 8 },
  { id: 'bakery',   en: 'Frozen & Bakery',     bn: 'ফ্রোজেন ও বেকারি',  icon: '🍞', colour: '#c99a5b', aisle: 9 },
  { id: 'snacks',   en: 'Snacks & Beverages',  bn: 'স্ন্যাকস ও পানীয়',  icon: '🍪', colour: '#d97b2b', aisle: 10 },
  { id: 'care',     en: 'Baby & Personal Care',bn: 'শিশু ও ব্যক্তিগত',  icon: '🧼', colour: '#8e6fc4', aisle: 11 },
  { id: 'home',     en: 'Household & Cleaning',bn: 'ঘরোয়া ও পরিষ্কার',  icon: '🧹', colour: '#4f8f7a', aisle: 12 },
];

export const STAFF = [
  { id: 's1', name: 'Nusrat Jahan',   role: 'Shop floor assistant', dept: 'rice',    shift: 'On shift · until 9 PM', online: true,  colour: '#2f7a52', initials: 'NJ',
    greeting: "Hi! I'm Nusrat from the rice & grains aisle. Looking for good miniket today?" },
  { id: 's2', name: 'Rafiq Hossain',  role: 'Fresh produce specialist', dept: 'veg', shift: 'On shift · until 8 PM', online: true,  colour: '#4a9d4f', initials: 'RH',
    greeting: "Rafiq here at the vegetable aisle. Today's potato and onion are from Bogura — fresh this morning." },
  { id: 's3', name: 'Sadia Afrin',    role: 'Dairy & eggs',          dept: 'dairy',   shift: 'On shift · until 9 PM', online: true,  colour: '#5b8fd6', initials: 'SA',
    greeting: "Sadia from dairy. Milk came in at 6 this morning — I can check the expiry for you." },
  { id: 's4', name: 'Imran Kabir',    role: 'Ordering assistant',    dept: null,      shift: 'Back office · 10 AM – 7 PM', online: false, colour: '#8a6d3b', initials: 'IK',
    greeting: "Imran here — I pack and place your order once it's confirmed." },
];

/* Aisle 1 — Rice & Grains. shape: bag | pouch | box | bottle | jar | sack
   Each product is what a Bangladeshi shelf actually holds. */
export const PRODUCTS = [
  { id: 'p1',  dept: 'rice', name: 'Miniket Rice',        bn: 'মিনিকেট চাল',      unit: '5 kg bag',  price: 420, mrp: 480, brand: 'Pusti',      shape: 'sack',   colour: '#e8dcc0', accent: '#2f7a52', weight: '5 kg',  rating: 4.7, sold: 2140, tier: 1,
    blurb: 'Polished miniket — small grain, cooks fluffy, everyday rice for the family pot.' },
  { id: 'p2',  dept: 'rice', name: 'Nazirshail Rice',     bn: 'নাজিরশাইল চাল',    unit: '5 kg bag',  price: 465, mrp: 520, brand: 'Aman',       shape: 'sack',   colour: '#f0e8d6', accent: '#1f5f8b', weight: '5 kg',  rating: 4.8, sold: 1780, tier: 1,
    blurb: 'Long, slender nazirshail. Slightly sticky, holds together well for pulao and biryani.' },
  { id: 'p3',  dept: 'rice', name: 'Chinigura Rice',      bn: 'চিনিগুঁড়া চাল',    unit: '2 kg pack', price: 340, mrp: 380, brand: 'Rupsha',     shape: 'pouch',  colour: '#efe4cf', accent: '#a8611f', weight: '2 kg',  rating: 4.6, sold: 640,  tier: 2,
    blurb: 'Aromatic small-grain rice for payesh and special dishes.' },
  { id: 'p4',  dept: 'rice', name: 'Kataribhog Rice',     bn: 'কাটারিভোগ চাল',    unit: '2 kg pack', price: 395, mrp: 0,   brand: 'Rupsha',     shape: 'pouch',  colour: '#f2e9d5', accent: '#8b5a2b', weight: '2 kg',  rating: 4.7, sold: 410,  tier: 2,
    blurb: 'Fine aromatic rice, the classic choice for polao.' },
  { id: 'p5',  dept: 'rice', name: 'Fresh Atta',          bn: 'আটা',              unit: '2 kg pack', price: 145, mrp: 160, brand: 'Fresh',      shape: 'pouch',  colour: '#f5efe2', accent: '#c0392b', weight: '2 kg',  rating: 4.6, sold: 2560, tier: 1,
    blurb: 'Whole wheat flour, stone ground for soft ruti.' },
  { id: 'p6',  dept: 'rice', name: 'Maida',               bn: 'ময়দা',             unit: '1 kg pack', price: 78,  mrp: 90,  brand: 'Fresh',      shape: 'pouch',  colour: '#fbf7ef', accent: '#c0392b', weight: '1 kg',  rating: 4.4, sold: 1310, tier: 3,
    blurb: 'Fine refined flour for bread, cake and porota.' },
  { id: 'p7',  dept: 'rice', name: 'Suji (Semolina)',     bn: 'সুজি',             unit: '500 g pack',price: 62,  mrp: 0,   brand: 'Fresh',      shape: 'pouch',  colour: '#f7efdd', accent: '#c0392b', weight: '500 g', rating: 4.3, sold: 720,  tier: 3,
    blurb: 'Coarse semolina for halwa and crispy fried snacks.' },
  { id: 'p8',  dept: 'rice', name: 'Masoor Dal',          bn: 'মসুর ডাল',         unit: '1 kg pack', price: 155, mrp: 175, brand: 'Teer',       shape: 'pouch',  colour: '#f0d9a8', accent: '#b3261e', weight: '1 kg',  rating: 4.7, sold: 3210, tier: 1,
    blurb: 'Red split lentil, quick cooking, the everyday dal.' },
  { id: 'p9',  dept: 'rice', name: 'Mung Dal',            bn: 'মুগ ডাল',          unit: '1 kg pack', price: 195, mrp: 220, brand: 'Teer',       shape: 'pouch',  colour: '#e6e2b0', accent: '#5c7c1f', weight: '1 kg',  rating: 4.5, sold: 1120, tier: 2,
    blurb: 'Small yellow mung beans — light on the stomach.' },
  { id: 'p10', dept: 'rice', name: 'Chickpeas',           bn: 'ছোলা',             unit: '1 kg pack', price: 130, mrp: 150, brand: 'Teer',       shape: 'pouch',  colour: '#e3c98f', accent: '#7a4b12', weight: '1 kg',  rating: 4.4, sold: 890,  tier: 2,
    blurb: 'Whole chola for bhuna khichuri and iftar.' },
  { id: 'p11', dept: 'rice', name: 'Khesari Dal',         bn: 'খেসারি ডাল',       unit: '1 kg pack', price: 110, mrp: 0,   brand: 'Local',      shape: 'pouch',  colour: '#e9dfae', accent: '#6b6b1f', weight: '1 kg',  rating: 4.1, sold: 430,  tier: 3,
    blurb: 'Traditional khesari dal — needs a good soak.' },
  { id: 'p12', dept: 'rice', name: 'Basmati Rice',        bn: 'বাসমতি চাল',       unit: '1 kg pack', price: 235, mrp: 260, brand: 'Aman',       shape: 'pouch',  colour: '#f6f1e0', accent: '#1f5f8b', weight: '1 kg',  rating: 4.6, sold: 980,  tier: 2,
    blurb: 'Long-grain basmati for special-occasion cooking.' },
  { id: 'p13', dept: 'rice', name: 'Brown Rice',          bn: 'ব্রাউন রাইস',      unit: '1 kg pack', price: 165, mrp: 0,   brand: 'Aman',       shape: 'pouch',  colour: '#e4d6b8', accent: '#6b5a2b', weight: '1 kg',  rating: 4.2, sold: 260,  tier: 3,
    blurb: 'Unpolished brown rice, higher fibre, a little chewier.' },
  { id: 'p14', dept: 'rice', name: 'Breadcrumbs',         bn: 'ব্রেড ক্রাম্বস',    unit: '250 g pack',price: 95,  mrp: 0,   brand: 'Fresh',      shape: 'pouch',  colour: '#f3e6c8', accent: '#c0392b', weight: '250 g', rating: 4.0, sold: 180,  tier: 3,
    blurb: 'For crispy cutlets and fried chicken coating.' },
];

export function money(n) {
  return '৳' + Math.round(Number(n) || 0).toLocaleString('en-BD');
}

export const ORDER_CONFIG = {
  freeDeliveryOver: 1999,
  minOrders: 299,
  delivery: { Dhaka: 60, Chattogram: 90, Other: 120 },
};


/* Section 1 needs a shelf that looks stocked, the way a real aisle does:
   the same items in several pack sizes, standing side by side.
   These are generated variants of the base products above. */
const PACKS = [
  { suffix: '1 kg', factor: 0.22, weight: '1 kg', shape: 'pouch' },
  { suffix: '2 kg', factor: 0.42, weight: '2 kg', shape: 'pouch' },
  { suffix: '500 g', factor: 0.13, weight: '500 g', shape: 'pouch' },
];

function variantOf(base, pack, idx) {
  const price = Math.max(28, Math.round((base.price * pack.factor) / 5) * 5);
  return {
    ...base,
    id: base.id + '-' + idx,
    name: base.name + ' · ' + pack.suffix,
    bn: base.bn + ' ' + pack.suffix,
    unit: pack.suffix + ' pack',
    weight: pack.weight,
    shape: pack.shape,
    price,
    mrp: base.mrp ? Math.round(base.mrp * pack.factor) : 0,
    tier: pack.suffix === '500 g' ? 3 : 2,
    isVariant: true,
    baseId: base.id,
  };
}

export const SHELF_PRODUCTS = (() => {
  const out = [];
  PRODUCTS.forEach((base, bi) => {
    out.push(base);
    PACKS.forEach((pack, pi) => {
      if ((bi + pi) % 3 === 0) out.push(variantOf(base, pack, pi + 1));
    });
  });
  return out;
})();
