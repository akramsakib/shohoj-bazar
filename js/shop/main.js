/* Shohoj Bazar — Section 1 glue: entries, HUD, pick-up flow, trolley, staff. */

import { DEPARTMENT_INDEX, STAFF, money, ORDER_CONFIG } from './data.js';
import { DEPARTMENTS, openDepartment, ALL_PRODUCTS, findProduct, sectionOf } from './departments/index.js';
import { ShopScene } from './scene.js';

const DEPT = openDepartment();          // the built, walkable department
const PRODUCTS = ALL_PRODUCTS;          // every product in the shop (search/trolley)

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  lang: localStorage.getItem('sb_lang') || 'en',
  trolley: JSON.parse(localStorage.getItem('sb_trolley') || '[]'),
  inspecting: null,
  open: null,
  unsupported: false,
};

/* ------------------------------------------------------------------ i18n */
const I18N = {
  en: { departments: 'Departments', support: 'Customer service', trolley: 'Trolley', aisle1: 'Rice & Grains' },
  bn: { departments: 'বিভাগ', support: 'কাস্টমার সার্ভিস', trolley: 'ট্রলি', aisle1: 'চাল ও দানা' },
};
function applyLang() {
  $$('[data-i18n]').forEach((el) => {
    el.textContent = I18N[state.lang][el.dataset.i18n] || el.textContent;
  });
  const btn = $('#langBtn');
  if (btn) btn.textContent = state.lang === 'en' ? 'বাংলা' : 'English';
  localStorage.setItem('sb_lang', state.lang);
}

/* ------------------------------------------------------------------ toast */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

/* --------------------------------------------------------------- trolley */
function saveTrolley() {
  localStorage.setItem('sb_trolley', JSON.stringify(state.trolley));
  renderTrolleyBadge();
}
function addToTrolley(product, qty = 1) {
  const line = state.trolley.find((l) => l.id === product.id);
  if (line) line.qty = Math.min(line.qty + qty, 30);
  else state.trolley.push({ id: product.id, qty });
  saveTrolley();
  if (scene && scene.putInTrolley) scene.putInTrolley(product);   // lands in the basket you are pushing
  toast(`${product.name} added to your trolley`);
}
function setQty(id, qty) {
  const line = state.trolley.find((l) => l.id === id);
  if (!line) return;
  if (qty <= 0) state.trolley = state.trolley.filter((l) => l.id !== id);
  else line.qty = Math.min(qty, 30);
  saveTrolley();
  renderTrolley();
}
function trolleyLines() {
  return state.trolley.map((l) => ({ ...l, product: PRODUCTS.find((p) => p.id === l.id) })).filter((l) => l.product);
}
function trolleyTotals() {
  const subtotal = trolleyLines().reduce((s, l) => s + l.product.price * l.qty, 0);
  const items = trolleyLines().reduce((s, l) => s + l.qty, 0);
  return { subtotal, items, deliveryFree: subtotal >= ORDER_CONFIG.freeDeliveryOver };
}
function renderTrolleyBadge() {
  const { subtotal, items } = trolleyTotals();
  const count = $('#trolleyCount');
  if (!count) return;
  count.textContent = items;
  count.classList.toggle('zero', items === 0);
  $('#trolleyTotal').textContent = money(subtotal);
}

function productMeta(p) {
  const dept = DEPARTMENTS.find((d) => d.id === p.departmentId);
  const sec = dept ? (dept.sections || []).find((x) => x.id === p.section) : null;
  return { dept, sec };
}

function renderTrolley() {
  const body = $('#trolleyBody');
  const foot = $('#trolleyFoot');
  const lines = trolleyLines();
  $('#tCount').textContent = lines.length ? `· ${lines.length} item${lines.length > 1 ? 's' : ''}` : '';

  if (!lines.length) {
    body.innerHTML = `<div class="empty"><span class="big">🛍</span>Your trolley is empty.<br>Walk the aisle and pick something up.</div>`;
    foot.innerHTML = '';
    return;
  }
  body.innerHTML = lines.map((l) => `
    <div class="t-line">
      <div class="em">${emojiFor(l.product)}</div>
      <div style="flex:1">
        <div class="nm">${state.lang === 'bn' ? l.product.bn : l.product.name}</div>
        <div class="meta">${l.product.unit} · ${money(l.product.price)}</div>
        <div class="qty">
          <button data-dec="${l.id}">−</button><span>${l.qty}</span><button data-inc="${l.id}">+</button>
        </div>
      </div>
      <div style="text-align:right">
        <div class="pr">${money(l.product.price * l.qty)}</div>
        <button data-rm="${l.id}" style="color:#9aa79f;font-size:.8rem;margin-top:4px">remove</button>
      </div>
    </div>`).join('');

  body.querySelectorAll('[data-inc]').forEach((b) => (b.onclick = () => setQty(b.dataset.inc, findQty(b.dataset.inc) + 1)));
  body.querySelectorAll('[data-dec]').forEach((b) => (b.onclick = () => setQty(b.dataset.dec, findQty(b.dataset.dec) - 1)));
  body.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => setQty(b.dataset.rm, 0)));

  const { subtotal, deliveryFree } = trolleyTotals();
  const gap = ORDER_CONFIG.freeDeliveryOver - subtotal;
  foot.innerHTML = `
    ${deliveryFree
      ? `<div style="background:#e8f7ee;color:#0a4a2c;border-radius:9px;padding:8px 11px;font-size:.8rem;margin-bottom:10px">🎉 Free delivery unlocked</div>`
      : `<div style="font-size:.78rem;color:var(--muted)">Add <b>${money(gap)}</b> more for free delivery</div>
         <div class="free-bar"><i style="width:${Math.min(100, (subtotal / ORDER_CONFIG.freeDeliveryOver) * 100)}%"></i></div>`}
    <div class="line"><span>Subtotal</span><span>${money(subtotal)}</span></div>
    <div class="line"><span>Delivery</span><span>${deliveryFree ? 'Free' : 'from ৳60'}</span></div>
    <div class="line total"><span>Total</span><span>${money(subtotal)}</span></div>
    <button class="btn big" id="checkoutBtn" style="width:100%;margin-top:12px">Go to checkout →</button>
    <div style="font-size:.72rem;color:var(--muted);text-align:center;margin-top:9px">Pay online — bKash, Nagad, Rocket or card. No cash on delivery.</div>`;

  $('#checkoutBtn').onclick = () => { closeAll(); startTill(); };
}
function findQty(id) {
  const line = state.trolley.find((l) => l.id === String(id));
  return line ? line.qty : 0;
}
function emojiFor(p) {
  const map = { rice: '🍚', oil: '🫗', spices: '🌶️', pulses: '🫘', veg: '🥬', fruit: '🍎', protein: '🐟', dairy: '🥛', bakery: '🍞', snacks: '🍪', care: '🧼', home: '🧹' };
  return map[p.dept] || '🛒';
}

/* --------------------------------------------------------------- checkout */
const TILL = {
  method: 'bkash',
  lines: [],
  scanned: 0,
  total: 0,
  orderId: null,
  running: false,
};
const PAY_LABEL = {
  bkash: { label: 'bKash number', ph: '01XXXXXXXXX', len: 11 },
  nagad: { label: 'Nagad number', ph: '01XXXXXXXXX', len: 11 },
  rocket: { label: 'Rocket account', ph: '01XXXXXXXXX-1', len: 12 },
  card: { label: 'Card number', ph: '4242 4242 4242 4242', len: 19 },
};

function tillAmount() {
  const { subtotal } = trolleyTotals();
  const delivery = subtotal >= ORDER_CONFIG.freeDeliveryOver ? 0 : ORDER_CONFIG.delivery.Dhaka;
  return { subtotal, delivery, total: subtotal + delivery };
}

function startTill() {
  if (!scene) return;
  const lines = trolleyLines();
  if (!lines.length) { toast('Your trolley is empty.'); return; }
  if (TILL.running) return;

  TILL.lines = lines;
  TILL.scanned = 0;
  TILL.total = 0;
  TILL.orderId = null;
  TILL.running = true;
  TILL.ready = false;

  $('#till').classList.remove('hidden');
  $('#hud').classList.add('till-open');
  $('#payBox').classList.add('hidden');
  $('#doneBox').classList.add('hidden');
  $('#tillHint').textContent = 'Put your things on the belt…';
  $('#tillBar').style.width = '0%';
  $('#tillCount').textContent = '0 items';
  $('#tillScanned').textContent = money(0);
  $('#tillList').innerHTML = lines.map((l) => `
    <div class="till-line" data-id="${l.id}">
      <div class="em">${emojiFor(l.product)}</div>
      <div class="nm">${state.lang === 'bn' ? l.product.bn : l.product.name}
        <div style="font-size:.72rem;opacity:.6">${l.product.unit} × ${l.qty}</div></div>
      <div class="pr">${money(l.product.price * l.qty)}</div>
    </div>`).join('');

  scene.goToCheckout();

  // the belt is the source of truth: the panel follows the machine, not the other way round
  const totalQty = lines.reduce((a, l) => a + l.qty, 0);
  const syncTill = () => {
    const n = scene.checkout ? scene.checkout.scannedCount() : TILL.scanned;
    if (n === TILL.scanned) return;
    TILL.scanned = n;
    TILL.total = scene.checkout.scannedTotal();
    $('#tillCount').textContent = `${n} of ${totalQty} items`;
    $('#tillScanned').textContent = money(TILL.total);
    $('#tillBar').style.width = Math.round((n / totalQty) * 100) + '%';
    $$('#tillList .till-line').forEach((row, i) => row.classList.toggle('scanned', i < n));
    if (n >= totalQty) $('#tillHint').textContent = 'All scanned. Sadia is bagging it for you.';
  };
  if (TILL.poller) clearInterval(TILL.poller);
  TILL.poller = setInterval(syncTill, 180);

  scene.startCheckout(lines, () => {
      // the belt state drives the panel (see syncTill); nothing to do here
    }, null, () => {
      // everything has been read — now the money
      TILL.running = false;
      if (TILL.poller) { clearInterval(TILL.poller); TILL.poller = null; }
      // settle the panel on the real figures regardless of any missed frame
      TILL.scanned = totalQty;
      TILL.total = lines.reduce((a, l) => a + l.product.price * l.qty, 0);
      $('#tillCount').textContent = `${totalQty} of ${totalQty} items`;
      $('#tillScanned').textContent = money(TILL.total);
      $('#tillBar').style.width = '100%';
      $$('#tillList .till-line').forEach((row) => row.classList.add('scanned'));
      $('#tillHint').textContent = 'All scanned. Sadia has bagged it for you.';
      const { subtotal, delivery, total } = tillAmount();
      $('#payAmount').textContent = money(total);
      $('#payBreak').textContent = delivery
        ? `Items ${money(subtotal)} + Dhaka delivery ${money(delivery)}`
        : `Items ${money(subtotal)} · delivery free`;
      $('#payBox').classList.remove('hidden');
      TILL.ready = true;
      refreshPayState();
    });
}

function refreshPayState() {
  if (!TILL.ready) { $('#payBtn').disabled = true; return; }
  const v = ($('#payField').value || '').replace(/\s/g, '');
  const spec = PAY_LABEL[TILL.method];
  const ok = TILL.method === 'card' ? v.replace(/\D/g, '').length >= 15 : v.length >= spec.len;
  $('#payBtn').disabled = !ok;
}

function setPayMethod(m) {
  TILL.method = m;
  $$('#payMethods .pay-m').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pay === m)));
  const spec = PAY_LABEL[m];
  $('#payFieldLabel').textContent = spec.label;
  $('#payField').placeholder = spec.ph;
  $('#payField').value = '';
  refreshPayState();
}

function payNow() {
  if (!TILL.ready || TILL.running) return;
  TILL.ready = false;
  const btn = $('#payBtn');
  btn.disabled = true;
  btn.textContent = 'Talking to ' + (TILL.method === 'card' ? 'the bank' : TILL.method.charAt(0).toUpperCase() + TILL.method.slice(1)) + '…';
  $('#payBox').classList.add('processing');
  setTimeout(() => {
    const { subtotal, delivery, total } = tillAmount();
    const id = 'SB' + Date.now().toString(36).toUpperCase().slice(-6);
    TILL.orderId = id;
    const stamp = new Date().toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' });
    const itemLines = TILL.lines.map((l) => {
      const nm = l.product.name.padEnd(22, ' ');
      return `${nm}${String(l.qty).padStart(2)} × ${String(l.product.price).padStart(4)} = ${String(l.product.price * l.qty).padStart(5)}`;
    }).join('\n');
    $('#receipt').textContent =
`SHOHOJ BAZAR
Mirpur 10, Dhaka · 09612-334455
==================================
Order   ${id}
Till    1 · Sadia
Date    ${stamp}
==================================
${itemLines}
----------------------------------
Subtotal            ${money(subtotal)}
Delivery            ${delivery ? money(delivery) : 'Free'}
VAT (included)      ${money(Math.round(subtotal * 0.05))}
----------------------------------
PAID                ${money(total)}
via ${TILL.method.toUpperCase()} · ${$('#payField').value}
==================================
Thank you — come again.
Return within 7 days with this slip.`;

    $('#doneSub').textContent = `${money(total)} paid by ${TILL.method.toUpperCase()}. Order ${id} is with the packing team.`;
    $('#payBox').classList.add('hidden');
    $('#doneBox').classList.remove('hidden');

    // the trolley is empty again
    state.trolley = [];
    saveTrolley();
    renderTrolley();
    renderTrolleyBadge();
    toast('Payment received — order ' + id + ' confirmed.');
  }, 1900);
}

function closeTill() {
  $('#till').classList.add('hidden');
  $('#hud').classList.remove('till-open');
  TILL.running = false;
  if (scene) scene.setCameraVantage('aisle');
}

/* ----------------------------------------------------------------- panels */
function closeAll() {
  ['map', 'trolley', 'staff', 'quick'].forEach((id) => $('#' + id).classList.add('hidden'));
  $('#scrim').classList.add('hidden');
  state.open = null;
}
function openPanel(id) {
  closeAll();
  $('#' + id).classList.remove('hidden');
  $('#scrim').classList.remove('hidden');
  state.open = id;
  if (id === 'trolley') renderTrolley();
}

/* -------------------------------------------------------------------- map */
function renderMap() {
  $('#mapGrid').innerHTML = DEPARTMENT_INDEX.map((d) => {
    const built = d.built;
    const sections = built && DEPT.sections ? DEPT.sections.map((s) => s.name).join(' · ') : '';
    return `
    <button class="dept ${built ? 'live' : 'locked'}" data-dept="${d.id}" ${built ? '' : 'disabled'}>
      <span class="tag ${built ? '' : 'soon'}">${built ? 'OPEN' : 'SOON'}</span>
      <span class="ic">${d.icon}</span>
      <span class="nm">${d.en}</span>
      <span class="bn">${d.bn}</span>
      ${built ? `<span class="sec">${DEPT.products.length} products</span>` : ''}
    </button>`;
  }).join('');

  const liveTile = $('#mapGrid').querySelector('.dept.live');
  if (liveTile) liveTile.onclick = () => { closeAll(); scene.walkToAisle(); toast('Aisle 1 · ' + DEPT.name); };

  $('#mapStaff').innerHTML = STAFF.filter((s) => s.online).map((s) => `
    <button class="staff-chip" data-staff="${s.id}">
      <span class="staff-avatar" style="background:${s.colour}">${s.initials}</span>
      <span><span style="font-weight:700">${s.name}</span><span class="role">${s.role}</span></span>
    </button>`).join('');
  $('#mapStaff').querySelectorAll('[data-staff]').forEach((b) => {
    b.onclick = () => { openStaff(b.dataset.staff); };
  });
}

/* ------------------------------------------------------------------ staff */
function renderStaff() {
  $('#staffBody').innerHTML = STAFF.map((s) => `
    <button class="staff-card" data-staff="${s.id}">
      <span class="staff-avatar" style="background:${s.colour}">${s.initials}</span>
      <span style="flex:1">
        <span class="nm">${s.name}</span>
        <span class="role">${s.role}</span>
        <span class="shift ${s.online ? '' : 'off'}">${s.online ? '● ' : '○ '}${s.shift}</span>
      </span>
      <span class="go">›</span>
    </button>`).join('');
  $('#staffBody').querySelectorAll('[data-staff]').forEach((b) => {
    b.onclick = () => openStaff(b.dataset.staff);
  });
  noteChatStub();
}

function noteChatStub() {
  if ($('#staffBody').querySelector('.stub-note')) return;
  const note = document.createElement('div');
  note.className = 'stub-note';
  note.style.cssText = 'margin-top:14px;font-size:.74rem;color:var(--muted);background:#f7f9f7;border:1px dashed rgba(18,36,26,.16);border-radius:10px;padding:10px 12px;line-height:1.45';
  note.innerHTML = '<b>Preview note:</b> in Section 5 these become real conversations — the assistant sees your aisle and trolley live, answers by chat, or calls you. For now the replies below are scripted.';
  $('#staffBody').appendChild(note);
}

let activeStaff = null;
function openStaff(id) {
  const staff = STAFF.find((s) => s.id === id);
  if (!staff) return;
  activeStaff = staff;
  if (!state.open || state.open !== 'staff') openPanel('staff');
  $('#chat').classList.remove('hidden');
  $('#chatName').textContent = staff.name;
  $('#chatRole').textContent = staff.online ? `${staff.role} · online now` : `${staff.role} · ${staff.shift}`;
  $('#chatLog').innerHTML = `<div class="msg bot">${staff.greeting}</div>`;
  if (!staff.online) {
    appendMsg('note', `${staff.name} is not on shift right now. Leave a message and your note reaches the shop's support inbox.`);
  }
  $('#chatInput').focus();
}
function appendMsg(kind, text) {
  const log = $('#chatLog');
  const el = document.createElement('div');
  el.className = 'msg ' + kind;
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

const SCRIPTED = [
  'Let me check that on the shelf for you.',
  'Yes, that one is in stock — I can see it in aisle 1.',
  'Anything else? I can add it to your trolley if you tell me the quantity.',
  'Delivery inside Dhaka is usually next day if you order before 6 PM.',
];
let replyIndex = 0;
function scriptedReply() {
  const text = SCRIPTED[replyIndex % SCRIPTED.length];
  replyIndex++;
  setTimeout(() => appendMsg('bot', text), 700);
}

/* ---------------------------------------------------------------- inspect */
function openInspect(product) {
  if (!product) { closeInspect(); return; }
  // putting one pack back before grabbing the next one
  if (state.inspecting && state.inspecting.id !== product.id) scene.release();
  state.inspecting = product;
  const el = $('#inspect');
  el.classList.remove('hidden');
  $('#vignette').classList.add('on');
  $('#aisleStrip').classList.add('hidden');
  $('#walkHint').classList.add('hidden');
  $('#iName').textContent = state.lang === 'bn' ? product.bn : product.name;
  $('#iBn').textContent = state.lang === 'bn' ? product.name : product.bn;
  $('#iPrice').textContent = money(product.price);
  $('#iMrp').textContent = product.mrp && product.mrp > product.price ? money(product.mrp) : '';
  $('#iBlurb').textContent = product.blurb;
  $('#iUnit').textContent = product.unit;
  $('#iRating').textContent = `${product.rating} / 5`;
  const { dept, sec } = productMeta(product);
  $('#iShelf').textContent = `${dept ? dept.name : ''}${sec ? ' · ' + sec.name : ''}`;
  $('#iSold').textContent = (product.sold || 0).toLocaleString() + ' sold';
  const extra = $('#iExtra');
  if (extra) {
    const rows = [];
    if (product.brand) rows.push(['Brand', product.brand]);
    if (product.origin) rows.push(['From', product.origin]);
    if (product.grade) rows.push(['Type', product.grade]);
    extra.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  }
  const cook = $('#iCook');
  if (cook) {
    cook.innerHTML = product.cook ? `<b>How it's used:</b> ${product.cook}` : '';
    cook.classList.toggle('hidden', !product.cook);
  }
  $('#iAddPrice').textContent = '· ' + money(product.price);
  $('#iBadge').textContent = product.tier === 1 ? 'In your hand · full 3D' : 'In your hand';
  $('#iHint').textContent = product.tier === 1
    ? 'Drag to turn it · pinch or scroll to look closer'
    : 'Drag to turn it — the front and back panels both read up close';

  const found = PRODUCTS.find((p) => p.id === product.id);
  const mesh = scene.products.find((m) => m.userData.product.id === product.id);
  if (mesh) scene.inspect(mesh);
}
function closeInspect() {
  state.inspecting = null;
  $('#inspect').classList.add('hidden');
  $('#vignette').classList.remove('on');
  $('#aisleStrip').classList.remove('hidden');
  scene.release();
}
function stepInspect(dir) {
  if (!state.inspecting) return;
  const i = PRODUCTS.findIndex((p) => p.id === state.inspecting.id);
  const next = PRODUCTS[(i + dir + PRODUCTS.length) % PRODUCTS.length];
  closeInspect();
  const mesh = scene.products.find((m) => m.userData.product.id === next.id);
  if (mesh) {
    scene.aisleZ = Math.min(-5.2, Math.max(-22.5, mesh.position.z + 1.9));
    scene.walkTarget = scene.aisleZ;
    setTimeout(() => openInspect(next), 260);
  }
}

/* ----------------------------------------------------------------- search */
function runSearch(q) {
  const box = $('#searchResults');
  const term = q.trim().toLowerCase();
  if (!term) { box.classList.add('hidden'); return; }
  const hits = PRODUCTS.filter((p) =>
    (p.name || '').toLowerCase().includes(term) ||
    (p.bn || '').includes(term) ||
    (p.brand || '').toLowerCase().includes(term) ||
    (p.origin || '').toLowerCase().includes(term) ||
    (p.grade || '').toLowerCase().includes(term));
  box.classList.remove('hidden');
  box.innerHTML = hits.length
    ? hits.slice(0, 6).map((p) => `
        <button data-goto="${p.id}">
          <span class="sr-emoji">${emojiFor(p)}</span>
          <span><b>${p.name}</b><br><span style="font-size:.72rem;color:#6d8">${p.bn} · ${p.unit}</span></span>
          <span class="sr-price">${money(p.price)}</span>
        </button>`).join('')
    : `<div class="none">Nothing on the shelf for “${q}”. Ask an assistant and we'll source it for you.</div>`;

  box.querySelectorAll('[data-goto]').forEach((b) => {
    b.onclick = () => {
      box.classList.add('hidden');
      $('#search').value = '';
      scene.focusProduct(b.dataset.goto);
      const p = PRODUCTS.find((x) => x.id === b.dataset.goto);
      setTimeout(() => openInspect(p), 1500);
    };
  });
}

/* ------------------------------------------------------------- quick shop */
function renderQuick() {
  $('#quickGrid').innerHTML = PRODUCTS.map((p) => `
    <div class="quick-card">
      <div class="thumb">${emojiFor(p)}</div>
      <div class="body">
        <div class="nm">${p.name}</div>
        <div class="bn">${p.bn} · ${p.unit}</div>
        <div class="pr">${money(p.price)}</div>
        <button class="btn small" style="margin-top:7px;width:100%" data-quick="${p.id}">Add to trolley</button>
      </div>
    </div>`).join('');
  $('#quickGrid').querySelectorAll('[data-quick]').forEach((b) => {
    b.onclick = () => addToTrolley(PRODUCTS.find((p) => p.id === b.dataset.quick));
  });
}

/* ------------------------------------------------------------------- boot */
let scene = null;

function wireTill() {
  $$('#payMethods .pay-m').forEach((b) => { b.onclick = () => setPayMethod(b.dataset.pay); });
  $('#payField').addEventListener('input', refreshPayState);
  $('#payBtn').onclick = payNow;
  $('#tillClose').onclick = closeTill;
  $('#tillFinished').onclick = () => { closeTill(); toast('Thanks — Sadia is back at the till whenever you are.'); };
  $('#receiptBtn').onclick = () => {
    const w = window.open('', '_blank', 'width=420,height=640');
    if (!w) { toast('Allow pop-ups to print the receipt.'); return; }
    w.document.write(`<pre style="font:12px/1.5 ui-monospace,monospace;padding:18px">${$('#receipt').textContent.replace(/</g, '&lt;')}</pre>`);
    w.document.close();
    w.focus();
    w.print();
  };
  setPayMethod('bkash');
}

function boot() {
  applyLang();
  wireTill();
  renderMap();
  renderStaff();
  renderQuick();
  renderTrolleyBadge();
  $('#entryStaff').textContent = STAFF.filter((s) => s.online).map((s) => s.name).join(', ');
  const ed = $('#entryDept');
  if (ed) ed.textContent = `Now open: Aisle 1 — ${DEPT.name} (${DEPT.nameBn}) · ${DEPT.products.length} products`;

  try {
    scene = new ShopScene($('#shop'), DEPT);
  } catch (err) {
    console.warn('WebGL unavailable, falling back to the fast shop', err);
    state.unsupported = true;
    $('#entry').classList.add('hidden');
    $('#loader').classList.add('done');
    openPanel('quick');
    toast('Your device could not open the 3D shop — here is the fast shop instead.');
    return;
  }

  scene.takeTrolley();   // you walk in pushing a trolley, like a real shop
  $('#stick').classList.remove('hidden');
  $('#lookHint').classList.remove('hidden');
  setTimeout(() => toast('Your trolley is ready. Push the stick to walk, drag anywhere to look around.'), 2200);

  scene.on('pick', (product) => {
    if (product) openInspect(product);
    else if (state.inspecting) closeInspect();
  });

  scene.on('walk', (z) => {
    const b = scene.aisleBounds || { start: -9.5, end: -25 };
    const pct = Math.min(100, Math.max(3, ((b.start - z) / (b.start - b.end)) * 100));
    $('#depthBar').style.width = pct + '%';
    const sec = scene.sectionAt(z);
    if (sec) {
      const el = $('#aisleSection');
      if (el && el.dataset.id !== sec.id) {
        el.dataset.id = sec.id;
        el.textContent = sec.name;
        $('#aisleSectionBn').textContent = sec.nameBn || '';
      }
    }
  });

  window.__scene = scene; // handy for debugging the walk/pick flow in the console
  window.__openInspect = (id) => openInspect(PRODUCTS.find((p) => p.id === id));
  setTimeout(() => $('#loader').classList.add('done'), 900);

  /* entry */
  /* walk stick: push it and you walk, let go and you stop */
  const stickBase = $('#stickBase'), knob = $('#stickKnob');
  if (stickBase && knob) {
    let active = false;
    const RADIUS = 34;
    const move = (e) => {
      if (!active) return;
      const r = stickBase.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy) || 1;
      if (len > RADIUS) { dx = (dx / len) * RADIUS; dy = (dy / len) * RADIUS; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const f = -dy / RADIUS;       // push up = walk forward
      const s = dx / RADIUS;        // push sideways = step across the aisle
      scene.setMove(Math.abs(f) < 0.16 ? 0 : f, Math.abs(s) < 0.22 ? 0 : s);
      e.preventDefault();
    };
    const release = () => {
      active = false;
      knob.style.transform = 'translate(0,0)';
      scene.setMove(0, 0);
    };
    stickBase.addEventListener('pointerdown', (e) => {
      active = true; stickBase.setPointerCapture(e.pointerId); move(e);
    });
    stickBase.addEventListener('pointermove', move);
    stickBase.addEventListener('pointerup', release);
    stickBase.addEventListener('pointercancel', release);
    stickBase.addEventListener('lostpointercapture', release);
  }

  $('#enterBtn').onclick = () => {
    $('#entry').classList.add('leaving');
    setTimeout(() => {
      $('#entry').classList.add('hidden');
      $('#hud').classList.remove('hidden');
      $('#aisleStrip').classList.remove('hidden');
      $('#walkHint').classList.remove('hidden');
      setTimeout(() => $('#walkHint').classList.add('fade'), 7000);
    }, 700);
    scene.enterShop();
  };
  $('#quickLink').onclick = (e) => { e.preventDefault(); openPanel('quick'); };
  $('#brandHome').onclick = () => { closeAll(); closeInspect(); scene.setCameraVantage('street'); $('#hud').classList.add('hidden'); $('#entry').classList.remove('hidden', 'leaving'); };

  /* hud */
  $('#mapBtn').onclick = () => openPanel('map');
  $('#staffBtn').onclick = () => { openPanel('staff'); $('#chat').classList.add('hidden'); };
  $('#trolleyBtn').onclick = () => openPanel('trolley');
  $('#langBtn').onclick = () => {
    state.lang = state.lang === 'en' ? 'bn' : 'en';
    applyLang();
    if (state.inspecting) openInspect(state.inspecting);
    renderTrolley();
  };
  $('#search').oninput = (e) => runSearch(e.target.value);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.hud-search')) $('#searchResults').classList.add('hidden');
  });

  /* panels */
  $$('[data-close]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.close;
      if (id === 'inspect') closeInspect();
      else if (id === 'staff') { openPanel('staff'); $('#chat').classList.add('hidden'); }
      else closeAll();
    };
  });
  $('#scrim').onclick = closeAll;
  $('#chatBack').onclick = () => { $('#chat').classList.add('hidden'); renderStaff(); };
  $('#chatForm').onsubmit = (e) => {
    e.preventDefault();
    const v = $('#chatInput').value.trim();
    if (!v) return;
    appendMsg('me', v);
    $('#chatInput').value = '';
    scriptedReply();
  };
  $('#callBtn').onclick = () => {
    if (!activeStaff) return;
    if (activeStaff.online) toast(`Calling ${activeStaff.name}… (voice calls arrive in Section 5)`);
    else toast(`${activeStaff.name} is off shift — your callback request is noted.`);
  };
  $('#askBtn').onclick = () => {
    const p = state.inspecting;
    closeInspect();
    openPanel('staff');
    setTimeout(() => openStaff('s1'), 120);
    if (p) setTimeout(() => appendMsg('note', `You asked about: ${p.name} (${p.unit})`), 260);
  };

  /* inspect */
  $('#addBtn').onclick = () => { if (state.inspecting) addToTrolley(state.inspecting); };
  $('#prevBtn').onclick = () => stepInspect(-1);
  $('#nextBtn').onclick = () => stepInspect(1);

  /* keyboard */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.inspecting) closeInspect();
      else if (state.open) closeAll();
    }
  });

  /* deep link from the address bar */
  if (location.hash === '#quick') openPanel('quick');
}

boot();
