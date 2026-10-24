/* ============================================================
   DEPARTMENT: Rice & Grains  (চাল ও দানা)
   This file is the whole department: its shelves, its sections,
   its products. Copy this file to add another department.

   Shelf layout is driven by `layout`, products by `products`.
   Nothing in scene.js needs to change when you add a department.
   ============================================================ */

export default {
  id: 'rice',
  name: 'Rice & Grains',
  nameBn: 'চাল ও দানা',
  icon: '🌾',
  colour: '#c9a961',
  accent: '#0d6138',
  tagline: 'Every grain a Bangladeshi kitchen runs on',
  taglineBn: 'বাঙালি রান্নাঘরের প্রতিদিনের দানা',

  /* ---------------------------------------------------------------
     Shelf layout. bays = how many shelf runs per side (each bay is
     6.2 m long, 4 levels). The aisle gets longer as you add bays.
     --------------------------------------------------------------- */
  layout: {
    bays: 3,
    levels: 4,
    facings: { desktop: 10, mobile: 7 },
    bulkDisplay: 'sacks',        // 25 kg sacks stacked at the aisle mouth
    endcap: 'weigh-counter',     // the loose-grain counter at the far end
  },

  /* Sections inside the department. Products reference these by id.
     Each section gets a hanging sign over its bays. */
  sections: [
    { id: 'rice',   name: 'Rice',          nameBn: 'চাল',            accent: '#0d6138', bays: [0], note: 'Aromatic, boiled and everyday rice by the sack' },
    { id: 'dal',    name: 'Lentils & Pulses', nameBn: 'ডাল ও ডালজাতীয়', accent: '#8a2f2a', bays: [1], note: 'Masoor, mung, chola and khesari' },
    { id: 'flour',  name: 'Flour & Flattened Rice', nameBn: 'আটা, ময়দা ও চিড়া', accent: '#a2601a', bays: [2], note: 'Atta, maida, suji, besan, chira and muri' },
  ],

  /* ---------------------------------------------------------------
     PRODUCTS
     shape: sack | pouch | box | bottle | jar
     tier:  1 = full 3D in hand · 2 = turntable · 3 = shelf + front/back
     mrp:   strike-through price (0 = no offer)
     --------------------------------------------------------------- */
  products: [
    /* ---------------- RICE · everyday ---------------- */
    { id: 'r01', section: 'rice', name: 'Miniket Rice', bn: 'মিনিকেট চাল', brand: 'Pusti', unit: '5 kg bag', weight: '5 kg', shape: 'sack', price: 420, mrp: 480, colour: '#25714c', accent: '#0d6138', rating: 4.7, sold: 2140, tier: 1, origin: 'Naogaon', grade: 'Fine', cook: 'Soak 20 min, 1:2 water, 12 min on low — fluffy and separate.',
      blurb: 'The everyday rice of most Bangladeshi kitchens. Small, polished grain that cooks soft without going sticky.' },
    { id: 'r02', section: 'rice', name: 'Miniket Rice', bn: 'মিনিকেট চাল', brand: 'Pusti', unit: '25 kg sack', weight: '25 kg', shape: 'sack', price: 1980, mrp: 2150, colour: '#518064', accent: '#14532d', rating: 4.7, sold: 860, tier: 1, origin: 'Naogaon', grade: 'Fine', cook: 'Same as the 5 kg — this is the monthly sack for a family of five.',
      blurb: 'The monthly sack. Best value per kilo in the whole aisle.' },
    { id: 'r03', section: 'rice', name: 'Nazirshail Rice', bn: 'নাজিরশাইল চাল', brand: 'Aman', unit: '5 kg bag', weight: '5 kg', shape: 'sack', price: 465, mrp: 520, colour: '#934141', accent: '#7f1d1d', rating: 4.8, sold: 1780, tier: 1, origin: 'Dinajpur', grade: 'Premium', cook: 'Long grain, needs a little more water. Holds together for pulao and tehari.',
      blurb: 'Long, slender, slightly sticky. The rice people serve when guests come.' },
    { id: 'r04', section: 'rice', name: 'Kataribhog Rice', bn: 'কাটারিভোগ চাল', brand: 'Rupsha', unit: '2 kg pack', weight: '2 kg', shape: 'pouch', price: 395, mrp: 0, colour: '#6275ad', accent: '#1e3a8a', rating: 4.7, sold: 410, tier: 2, origin: 'Dinajpur', grade: 'Aromatic', cook: 'Rinse twice, 1:1.5 water. The classic polao rice.',
      blurb: 'Fine, fragrant, fragile grain. Almost always bought for polao and biryani.' },
    { id: 'r05', section: 'rice', name: 'Chinigura Rice', bn: 'চিনিগুঁড়া চাল', brand: 'Rupsha', unit: '1 kg pack', weight: '1 kg', shape: 'pouch', price: 190, mrp: 210, colour: '#a8663e', accent: '#92400e', rating: 4.6, sold: 640, tier: 1, origin: 'Thakurgaon', grade: 'Aromatic', cook: 'For payesh and firni — cook long and slow until it breaks down.',
      blurb: 'Tiny, sweet-smelling grain used for payesh, firni and special-occasion sweets.' },
    { id: 'r06', section: 'rice', name: 'Kalijira Rice', bn: 'কালিজিরা চাল', brand: 'Aman', unit: '1 kg pack', weight: '1 kg', shape: 'pouch', price: 265, mrp: 0, colour: '#7753ae', accent: '#4c1d95', rating: 4.6, sold: 320, tier: 2, origin: 'Mymensingh', grade: 'Aromatic', cook: 'Baby basmati — light, quick, ideal for polao and kacchi.',
      blurb: 'Nicknamed baby basmati. Delicate, aromatic, and expensive for its size.' },
    { id: 'r07', section: 'rice', name: 'Basmati Rice', bn: 'বাসমতি চাল', brand: 'Aman', unit: '1 kg pack', weight: '1 kg', shape: 'pouch', price: 235, mrp: 260, colour: '#25714c', accent: '#0d6138', rating: 4.6, sold: 980, tier: 2, origin: 'Imported', grade: 'Premium', cook: 'Soak 30 min, 1:1.4 water, drain when just done.',
      blurb: 'Long, dry, separate grains. The biryani rice.' },
    { id: 'r08', section: 'rice', name: 'Pajam Rice', bn: 'পাজাম চাল', brand: 'Local mill', unit: '5 kg bag', weight: '5 kg', shape: 'sack', price: 395, mrp: 0, colour: '#518064', accent: '#14532d', rating: 4.3, sold: 540, tier: 3, origin: 'Rangpur', grade: 'Standard', cook: 'Cheap, filling, forgiving. Good for daily meals and khichuri.',
      blurb: 'Short, sturdy grain. The budget rice that still cooks well.' },
    { id: 'r09', section: 'rice', name: 'Atap (Boiled) Rice', bn: 'আতপ চাল', brand: 'Fresh', unit: '5 kg bag', weight: '5 kg', shape: 'sack', price: 380, mrp: 420, colour: '#934141', accent: '#7f1d1d', rating: 4.4, sold: 1310, tier: 2, origin: 'Bogura', grade: 'Standard', cook: 'Parboiled — absorbs more water, softer bite, higher fibre.',
      blurb: 'Parboiled rice. Stays soft for hours, which is why it is everywhere at lunchtime.' },
    { id: 'r10', section: 'rice', name: 'Guti Rice', bn: 'গুঁটি চাল', brand: 'Local mill', unit: '5 kg bag', weight: '5 kg', shape: 'sack', price: 385, mrp: 0, colour: '#6275ad', accent: '#1e3a8a', rating: 4.2, sold: 430, tier: 3, origin: 'Sylhet', grade: 'Standard', cook: 'Traditional unpolished parboiled — nuttier flavour, chewier grain.',
      blurb: 'The old-style rice your grandmother cooked. Nutty and filling.' },
    { id: 'r11', section: 'rice', name: 'Brown Rice', bn: 'ব্রাউন রাইস', brand: 'Aman', unit: '1 kg pack', weight: '1 kg', shape: 'pouch', price: 165, mrp: 0, colour: '#a8663e', accent: '#92400e', rating: 4.2, sold: 260, tier: 3, origin: 'Dinajpur', grade: 'Whole grain', cook: 'Soak 1 hour, 1:2.5 water, 35 min. Chewy by design.',
      blurb: 'Unpolished. More fibre, more time on the stove, more chew.' },
    { id: 'r12', section: 'rice', name: 'BR-28 Rice', bn: 'বিআর-২৮ চাল', brand: 'Aman', unit: '5 kg bag', weight: '5 kg', shape: 'sack', price: 350, mrp: 0, colour: '#7753ae', accent: '#4c1d95', rating: 4.1, sold: 1620, tier: 3, origin: 'Rajshahi', grade: 'Standard', cook: 'Quick-cooking, high yield. The workhorse of cheap meals.',
      blurb: 'High-yield variety. Cheap, plentiful, fills the plate.' },
    { id: 'r13', section: 'rice', name: 'BR-29 Rice', bn: 'বিআর-২৯ চাল', brand: 'Aman', unit: '5 kg bag', weight: '5 kg', shape: 'sack', price: 360, mrp: 0, colour: '#25714c', accent: '#0d6138', rating: 4.2, sold: 1180, tier: 3, origin: 'Rajshahi', grade: 'Standard', cook: 'Similar to BR-28, slightly finer grain, cooks a touch softer.',
      blurb: 'The finer sibling of BR-28. Everyday rice at a fair price.' },
    { id: 'r14', section: 'rice', name: 'Sugandhi Aromatic Rice', bn: 'সুগন্ধি চাল', brand: 'Khusboo', unit: '2 kg pack', weight: '2 kg', shape: 'pouch', price: 320, mrp: 350, colour: '#518064', accent: '#14532d', rating: 4.5, sold: 720, tier: 2, origin: 'Bogra', grade: 'Aromatic', cook: 'Rinse lightly — the aroma lives in the outer layer.',
      blurb: 'Aromatic everyday rice. Smells like a wedding kitchen when it hits the water.' },
    { id: 'r15', section: 'rice', name: 'Biroi Rice', bn: 'বিরই চাল', brand: 'Local mill', unit: '2 kg pack', weight: '2 kg', shape: 'pouch', price: 290, mrp: 0, colour: '#934141', accent: '#7f1d1d', rating: 4.2, sold: 380, tier: 3, origin: 'Kurigram', grade: 'Standard', cook: 'Small grain, absorbs a lot of water. Good for jhol with fish.',
      blurb: 'Very small short-grain rice from the north. Soaks up curry beautifully.' },
    { id: 'r16', section: 'rice', name: 'Jasmine Rice', bn: 'জেসমিন চাল', brand: 'Khusboo', unit: '1 kg pack', weight: '1 kg', shape: 'pouch', price: 210, mrp: 0, colour: '#6275ad', accent: '#1e3a8a', rating: 4.4, sold: 430, tier: 3, origin: 'Imported', grade: 'Aromatic', cook: 'Cook like basmati — separate, fluffy grains.',
      blurb: 'Soft, floral, slightly sticky. Good for Thai-style dishes and fried rice.' },
    { id: 'r17', section: 'rice', name: 'Chira (Flattened Rice)', bn: 'চিড়া', brand: 'Fresh', unit: '1 kg pack', weight: '1 kg', shape: 'pouch', price: 90, mrp: 100, colour: '#a8663e', accent: '#92400e', rating: 4.5, sold: 1900, tier: 3, origin: 'Comilla', grade: 'Standard', cook: 'No cooking — rinse for chira bhaja, soak for a morning bowl with milk and banana.',
      blurb: 'Beaten rice. Breakfast with milk and banana, or fried with onion and chili.' },
    { id: 'r18', section: 'rice', name: 'Muri (Puffed Rice)', bn: 'মুড়ি', brand: 'Fresh', unit: '500 g pack', weight: '500 g', shape: 'pouch', price: 55, mrp: 0, colour: '#7753ae', accent: '#4c1d95', rating: 4.4, sold: 2300, tier: 3, origin: 'Comilla', grade: 'Standard', cook: 'Eat as is, or toss with mustard oil, onion and green chili.',
      blurb: 'Puffed rice. The cheapest, happiest snack in the country.' },

    /* ---------------- LENTILS & PULSES ---------------- */
    { id: 'd01', section: 'dal', name: 'Masoor Dal', bn: 'মসুর ডাল', brand: 'Teer', unit: '1 kg pack', weight: '1 kg', shape: 'pouch', price: 155, mrp: 175, colour: '#bc6422', accent: '#b45309', rating: 4.7, sold: 3210, tier: 1, origin: 'Faridpur', grade: 'Red split', cook: 'Rinse, boil 15 min with turmeric. The daily dal.',
      blurb: 'Red split lentil. Cooks fast, thickens beautifully, the backbone of lunch.' },
    { id: 'd02', section: 'dal', name: 'Masoor Dal', bn: 'মসুর ডাল', brand: 'Teer', unit: '2 kg pack', weight: '2 kg', shape: 'pouch', price: 300, mrp: 340, colour: '#b46950', accent: '#9a3412', rating: 4.7, sold: 1240, tier: 2, origin: 'Faridpur', grade: 'Red split', cook: 'Same as the 1 kg — the family pack.',
      blurb: 'Two kilos of the daily dal, at a better rate per kilo.' },
    { id: 'd03', section: 'dal', name: 'Mung Dal', bn: 'মুগ ডাল', brand: 'Teer', unit: '1 kg pack', weight: '1 kg', shape: 'pouch', price: 195, mrp: 220, colour: '#934141', accent: '#7f1d1d', rating: 4.5, sold: 1120, tier: 1, origin: 'Jashore', grade: 'Yellow split', cook: 'Soak 30 min, boil 12 min. Light and easy to digest.',
      blurb: 'Small yellow mung beans. Gentlest dal on the stomach — the one given to anyone unwell.' },
    { id: 'd04', section: 'dal', name: 'Mung Dal (Whole)', bn: 'আস্ত মুগ', brand: 'Teer', unit: '500 g pack', weight: '500 g', shape: 'pouch', price: 115, mrp: 0, colour: '#bd9151', accent: '#a16207', rating: 4.4, sold: 430, tier: 3, origin: 'Jashore', grade: 'Whole', cook: 'Soak overnight, sprout for a day for mung sprouts.',
      blurb: 'Whole green mung. Sprout it for salads or boil for khichuri.' },
    { id: 'd05', section: 'dal', name: 'Motor Dal (Yellow Peas)', bn: 'মটর ডাল', brand: 'Pran', unit: '1 kg pack', weight: '1 kg', shape: 'pouch', price: 130, mrp: 145, colour: '#935d3f', accent: '#78350f', rating: 4.4, sold: 890, tier: 2, origin: 'Bogura', grade: 'Split', cook: 'Soak 2 hours — it needs it. Long, gentle boil.',
      blurb: 'Yellow split peas. Nutty, holds its shape, the classic winter dal.' },
    { id: 'd06', section: 'dal', name: 'Chola (Chickpeas)', bn: 'ছোলা', brand: 'Teer', unit: '1 kg pack', weight: '1 kg', shape: 'pouch', price: 130, mrp: 150, colour: '#4e8a65', accent: '#166534', rating: 4.4, sold: 890, tier: 2, origin: 'Chapainawabganj', grade: 'Small', cook: 'Soak overnight. Boil until soft for bhuna khichuri or iftar chola.',
      blurb: 'Whole chola. The iftar table and the khichuri pot both need it.' },
    { id: 'd07', section: 'dal', name: 'Khesari Dal', bn: 'খেসারি ডাল', brand: 'Local mill', unit: '1 kg pack', weight: '1 kg', shape: 'pouch', price: 110, mrp: 0, colour: '#bc6422', accent: '#b45309', rating: 4.1, sold: 430, tier: 3, origin: 'Pabna', grade: 'Split', cook: 'Soak well and cook thoroughly — it is cheap but tough.',
      blurb: 'The cheapest dal in the aisle. Needs patience and a long soak.' },
    { id: 'd08', section: 'dal', name: 'Mashkalai Dal (Black Gram)', bn: 'মাষকলাই ডাল', brand: 'Pran', unit: '500 g pack', weight: '500 g', shape: 'pouch', price: 95, mrp: 0, colour: '#b46950', accent: '#9a3412', rating: 4.3, sold: 310, tier: 3, origin: 'Jashore', grade: 'Split', cook: 'Soak 30 min. The dal for bora (fritters) and biye-bari cooking.',
      blurb: 'Black gram, split. Bitter-sweet, and the only correct dal for a wedding bora.' },
    { id: 'd09', section: 'dal', name: 'But (Large Chickpea)', bn: 'বুট', brand: 'Local mill', unit: '1 kg pack', weight: '1 kg', shape: 'pouch', price: 140, mrp: 0, colour: '#934141', accent: '#7f1d1d', rating: 4.2, sold: 240, tier: 3, origin: 'Chapainawabganj', grade: 'Large', cook: 'Soak overnight, boil 40 min.',
      blurb: 'The big chickpea. Used for chana chaat and cholar dal.' },
    { id: 'd10', section: 'dal', name: 'Roasted Chola', bn: 'ভাজা ছোলা', brand: 'Pran', unit: '500 g pack', weight: '500 g', shape: 'pouch', price: 85, mrp: 0, colour: '#bd9151', accent: '#a16207', rating: 4.3, sold: 520, tier: 3, origin: 'Chapainawabganj', grade: 'Roasted', cook: 'Already roasted — eat with muri and mustard oil.',
      blurb: 'Roasted and ready. Mix with muri, onion and chili for the cheapest good snack.' },
    { id: 'd11', section: 'dal', name: 'Masoor Dal (Whole)', bn: 'আস্ত মসুর', brand: 'Local mill', unit: '1 kg pack', weight: '1 kg', shape: 'pouch', price: 135, mrp: 0, colour: '#935d3f', accent: '#78350f', rating: 4.2, sold: 340, tier: 3, origin: 'Faridpur', grade: 'Whole', cook: 'Soak 2 hours, longer cook than split.',
      blurb: 'Whole red lentil, skin on. Earthier and a bit denser than the split version.' },
    { id: 'd12', section: 'dal', name: 'Besan (Gram Flour)', bn: 'বেসন', brand: 'Pran', unit: '500 g pack', weight: '500 g', shape: 'pouch', price: 120, mrp: 135, colour: '#4e8a65', accent: '#166534', rating: 4.4, sold: 760, tier: 2, origin: 'Bogura', grade: 'Fine', cook: 'Mix with water for bhaji and pakora batter.',
      blurb: 'Gram flour. Every piaju, every beguni, every evening snack starts here.' },

    /* ---------------- FLOUR ---------------- */
    { id: 'f01', section: 'flour', name: 'Fresh Atta', bn: 'আটা', brand: 'Fresh', unit: '2 kg pack', weight: '2 kg', shape: 'pouch', price: 145, mrp: 160, colour: '#3453b7', accent: '#1e40af', rating: 4.6, sold: 2560, tier: 1, origin: 'Dhaka', grade: 'Whole wheat', cook: 'Knead soft, rest 20 min, roll thin for ruti.',
      blurb: 'Whole wheat flour, stone ground. The ruti in every lunchbox.' },
    { id: 'f02', section: 'flour', name: 'Fresh Atta', bn: 'আটা', brand: 'Fresh', unit: '5 kg pack', weight: '5 kg', shape: 'sack', price: 340, mrp: 370, colour: '#4b7994', accent: '#0c4a6e', rating: 4.6, sold: 1520, tier: 2, origin: 'Dhaka', grade: 'Whole wheat', cook: 'Same as the 2 kg — the month pack.',
      blurb: 'Five kilos of atta. Cheaper per kilo, sold to the same households every month.' },
    { id: 'f03', section: 'flour', name: 'Maida', bn: 'ময়দা', brand: 'Fresh', unit: '1 kg pack', weight: '1 kg', shape: 'pouch', price: 78, mrp: 90, colour: '#a35f35', accent: '#92400e', rating: 4.4, sold: 1310, tier: 2, origin: 'Dhaka', grade: 'Refined', cook: 'The flour for porota, luchi, cake and bread.',
      blurb: 'Fine refined flour. Makes luchi puff and porota flake.' },
    { id: 'f04', section: 'flour', name: 'Suji (Semolina)', bn: 'সুজি', brand: 'Fresh', unit: '500 g pack', weight: '500 g', shape: 'pouch', price: 62, mrp: 0, colour: '#a36c59', accent: '#7c2d12', rating: 4.3, sold: 720, tier: 3, origin: 'Dhaka', grade: 'Coarse', cook: 'Roast dry, then add water for halwa. Or fry for a crispy coating.',
      blurb: 'Coarse semolina. Halwa in winter, coating on fried fish all year.' },
    { id: 'f05', section: 'flour', name: 'Rice Flour', bn: 'চালের গুঁড়া', brand: 'Fresh', unit: '1 kg pack', weight: '1 kg', shape: 'pouch', price: 95, mrp: 0, colour: '#4b61a1', accent: '#1e3a8a', rating: 4.2, sold: 480, tier: 3, origin: 'Dhaka', grade: 'Fine', cook: 'Mix with water for pitha — the winter rice-cake batter.',
      blurb: 'Ground rice. Bhapa pitha, chitoi pitha and many a winter morning.' },
    { id: 'f06', section: 'flour', name: 'Cornflour', bn: 'কর্নফ্লাওয়ার', brand: 'Pran', unit: '250 g pack', weight: '250 g', shape: 'pouch', price: 75, mrp: 0, colour: '#667c4c', accent: '#365314', rating: 4.1, sold: 260, tier: 3, origin: 'Dhaka', grade: 'Fine', cook: 'For thickening and for crispy fried chicken coating.',
      blurb: 'Fine white starch. Thickens a sauce and crisps a fry.' },
    { id: 'f07', section: 'flour', name: 'Oats', bn: 'ওটস', brand: 'Pran', unit: '500 g pack', weight: '500 g', shape: 'box', price: 260, mrp: 290, colour: '#3453b7', accent: '#1e40af', rating: 4.4, sold: 620, tier: 2, origin: 'Imported', grade: 'Rolled', cook: 'Boil 3 min in milk. Breakfast for the diet-conscious.',
      blurb: 'Rolled oats. The one box in the rice aisle bought by people watching their weight.' },
    { id: 'f08', section: 'flour', name: 'Lachcha Semai', bn: 'লাচ্ছা সেমাই', brand: 'Pran', unit: '500 g pack', weight: '500 g', shape: 'box', price: 110, mrp: 125, colour: '#4b7994', accent: '#0c4a6e', rating: 4.5, sold: 980, tier: 3, origin: 'Dhaka', grade: 'Fine', cook: 'Fry in ghee, then simmer in milk and sugar for shemai.',
      blurb: 'Vermicelli for Eid shemai and firni. Fried first, always.' },
    { id: 'f09', section: 'flour', name: 'Muri (Family Pack)', bn: 'মুড়ি', brand: 'Fresh', unit: '1 kg pack', weight: '1 kg', shape: 'sack', price: 95, mrp: 0, colour: '#a35f35', accent: '#92400e', rating: 4.3, sold: 1420, tier: 3, origin: 'Comilla', grade: 'Standard', cook: 'Keep it dry — humidity kills the crunch in a day.',
      blurb: 'A full kilo of puffed rice. Enough for a whole week of evening snacks.' },
    { id: 'f10', section: 'flour', name: 'Khai (Puffed Rice Cake)', bn: 'খই', brand: 'Local', unit: '250 g pack', weight: '250 g', shape: 'pouch', price: 70, mrp: 0, colour: '#a36c59', accent: '#7c2d12', rating: 4.1, sold: 180, tier: 3, origin: 'Comilla', grade: 'Standard', cook: 'Eat with jaggery or make mukhsho for a wedding.',
      blurb: 'Puffed rice clusters. Traditional, and still handed out at ceremonies.' },
    { id: 'f11', section: 'flour', name: 'Jau (Barley)', bn: 'যব', brand: 'Local', unit: '500 g pack', weight: '500 g', shape: 'pouch', price: 85, mrp: 0, colour: '#4b61a1', accent: '#1e3a8a', rating: 4.0, sold: 140, tier: 3, origin: 'Rajshahi', grade: 'Whole', cook: 'Soak overnight. Used in barley water and winter soups.',
      blurb: 'Pearl barley. Cooling in summer, comforting as soup in winter.' },
    { id: 'f12', section: 'flour', name: 'Besan (Family Pack)', bn: 'বেসন', brand: 'Pran', unit: '1 kg pack', weight: '1 kg', shape: 'pouch', price: 225, mrp: 0, colour: '#667c4c', accent: '#365314', rating: 4.4, sold: 410, tier: 3, origin: 'Bogura', grade: 'Fine', cook: 'Mix with water to a pouring batter for pakora.',
      blurb: 'The kilo pack of gram flour — the iftar-month size.' },
  ],

  /* -----------------------------------------------------------------
     BULK DISPLAY — the 25 kg sacks stacked at the aisle mouth.
     Products referenced here must exist above.
     ----------------------------------------------------------------- */
  bulk: [
    { productId: 'r02', note: 'Best value · monthly sack' },
    { productId: 'r09', note: 'Parboiled · family favourite' },
    { productId: 'f02', note: 'Atta by the sack' },
  ],

  /* Shelf talkers shown above price rails (offers of the day). */
  talkers: [
    { productId: 'r01', text: 'SAVE ৳60' },
    { productId: 'd01', text: 'BEST SELLER' },
    { productId: 'f01', text: "TODAY'S PICK" },
  ],
};
