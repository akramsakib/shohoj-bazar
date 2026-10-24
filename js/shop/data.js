/* Shohoj Bazar — shop-wide data: the department index, staff, helpers.
   Products live inside each department file in js/shop/departments/. */

/* The twelve departments a Bangladeshi super shop is laid out in.
   `built: true` means the aisle exists; the rest show as SOON on the map. */
export const DEPARTMENT_INDEX = [
  { id: 'rice',    en: 'Rice & Grains',        bn: 'চাল ও দানা',         icon: '🌾', aisle: 1,  built: true  },
  { id: 'oil',     en: 'Oil & Ghee',           bn: 'তেল ও ঘি',           icon: '🫗', aisle: 2,  built: false },
  { id: 'spices',  en: 'Spices & Masala',      bn: 'মসলা',               icon: '🌶️', aisle: 3,  built: false },
  { id: 'veg',     en: 'Fresh Vegetables',     bn: 'তাজা সবজি',          icon: '🥬', aisle: 4,  built: false },
  { id: 'fruit',   en: 'Fresh Fruit',          bn: 'তাজা ফল',            icon: '🍎', aisle: 5,  built: false },
  { id: 'protein', en: 'Fish & Meat',          bn: 'মাছ ও মাংস',         icon: '🐟', aisle: 6,  built: false },
  { id: 'dairy',   en: 'Dairy & Eggs',         bn: 'দুধ ও ডিম',          icon: '🥛', aisle: 7,  built: false },
  { id: 'bakery',  en: 'Frozen & Bakery',      bn: 'ফ্রোজেন ও বেকারি',   icon: '🍞', aisle: 8,  built: false },
  { id: 'snacks',  en: 'Snacks & Beverages',   bn: 'স্ন্যাকস ও পানীয়',   icon: '🍪', aisle: 9,  built: false },
  { id: 'care',    en: 'Baby & Personal Care', bn: 'শিশু ও ব্যক্তিগত',   icon: '🧼', aisle: 10, built: false },
  { id: 'home',    en: 'Household & Cleaning', bn: 'ঘরোয়া ও পরিষ্কার',   icon: '🧹', aisle: 11, built: false },
  { id: 'pharma',  en: 'Pharmacy Essentials',  bn: 'ফার্মেসি',           icon: '💊', aisle: 12, built: false },
];

export const STAFF = [
  { id: 's1', name: 'Nusrat Jahan',  role: 'Rice & grains specialist', dept: 'rice', shift: 'On shift · until 9 PM', online: true,  colour: '#2f7a52', initials: 'NJ',
    greeting: "Hi, I'm Nusrat — I look after the rice and dal aisle. Tell me how many people you cook for and I'll tell you which sack is best value." },
  { id: 's2', name: 'Rafiq Hossain', role: 'Fresh produce specialist', dept: 'veg',  shift: 'On shift · until 8 PM', online: true,  colour: '#4a9d4f', initials: 'RH',
    greeting: "Rafiq here at the vegetable aisle. Today's potato and onion came in from Bogura this morning." },
  { id: 's3', name: 'Sadia Afrin',   role: 'Dairy & eggs',            dept: 'dairy', shift: 'On shift · until 9 PM', online: true,  colour: '#5b8fd6', initials: 'SA',
    greeting: "Sadia from dairy. Milk arrived at 6 this morning — I can read you the expiry date." },
  { id: 's4', name: 'Imran Kabir',   role: 'Ordering assistant',      dept: null,    shift: 'Back office · 10 AM – 7 PM', online: false, colour: '#8a6d3b', initials: 'IK',
    greeting: "Imran here — I pack your order and place it with the mill once it is confirmed." },
];

export function money(n) {
  return '৳' + Math.round(Number(n) || 0).toLocaleString('en-BD');
}

export const ORDER_CONFIG = {
  freeDeliveryOver: 1999,
  minOrder: 299,
  delivery: { Dhaka: 60, Chattogram: 90, Other: 120 },
};
