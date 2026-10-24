# Shohoj Bazar — virtual super shop

**Section 1: the walkable shop.** Walk in through the doors, down the aisle, pick a pack off the shelf and turn it in your hand, drop it in your trolley.

This is a **static site with zero dependencies**. There is no build step and no server code — GitHub Pages serves it directly.

---

## Run it locally

```bash
cd shohoj-bazar
node server.js            # → http://localhost:3100
```

or simulate the GitHub Pages subpath exactly:

```bash
npm run pages             # → http://localhost:3100/shohoj-bazar/
```

Any static file server works too — `python3 -m http.server 8000`.

---

## Publish to GitHub Pages

Everything is prepared. From this machine, after pasting a GitHub token:

```bash
export GH_TOKEN=ghp_xxx                       # fine-grained, "Contents: read and write"
export GH_OWNER=your-username
export GH_REPO=shohoj-bazar
export GH_EMAIL=you@email.com

./deploy.sh
```

`deploy.sh` will:

1. create the repo under your account **if it does not exist**
2. commit and push this folder to `main`
3. turn on GitHub Pages for the `main` branch root
4. print your live URL — normally `https://<owner>.github.io/<repo>/`

Re-running it later just pushes an update.

### Or do it by hand

1. Create an empty repo on github.com (public).
2. `git init && git add -A && git commit -m "Section 1" && git push`
3. **Settings → Pages → Source: Deploy from a branch → Branch: `main` → `/ (root)` → Save**
4. Wait ~1 minute. Your shop is live.

---

## What is in Section 1

| Feature | Status |
| --- | --- |
| Street façade — signboard, awning, sliding glass doors, lit interior | ✅ |
| Entrance hall — service desk, welcome arch, gondolas | ✅ |
| Aisle 1 walkable — Rice & Grains, 4 shelf levels × 11 facings per side | ✅ |
| Real pack sizes and real-world dimensions per product | ✅ |
| **Pick it up** — tap a pack, it lifts off the shelf, drag to turn, zoom in | ✅ |
| Shelf-edge price tags, back-panel product information | ✅ |
| Trolley — quantities, running total, free-delivery progress | ✅ |
| Departments map — 12 departments, 1 open | ✅ |
| Customer service — named staff, shifts, scripted chat | ✅ |
| Search that walks the camera to the shelf slot | ✅ |
| Bangla / English toggle | ✅ |
| 2D "fast shop" fallback when WebGL is unavailable | ✅ |
| Mobile portrait — dedicated walking camera | ✅ |

### Deliberately fake in this section

Packaging artwork is **drawn in code** (real pack photography arrives in Section 4). Prices are indicative. Chat replies are scripted until Section 5 wires the real support inbox. The checkout button is a stub until Section 3. Only aisle 1 is open — the other eleven departments show as SOON.

---

## Editing the shop

- **Products on aisle 1** → `js/shop/data.js`, the `PRODUCTS` array. Shapes available: `sack`, `pouch`, `box`, `bottle`, `jar`.
- **Pack sizes** → the `PACKS` table in the same file; `SHELF_PRODUCTS` generates the variants that stock the shelf.
- **Departments & staff** → `DEPARTMENTS` and `STAFF` in `js/shop/data.js`.
- **Scene, lighting, camera, shelf geometry** → `js/shop/scene.js`.
- **Packaging artwork generator** → `js/shop/assets.js`.
- **Design system** → `css/shop.css`.

Three.js (r186) is vendored in `vendor/`, so the shop runs offline with no CDN.

---

## What comes next

See `../SECTIONS.md` for the full build order — Section 2 opens the other eleven departments, Section 3 is the checkout counter, Section 4 replaces procedural labels with real product photography.

---

© Shohoj Bazar · Built as a staged prototype. Not yet a live store — no payments are taken in this section.
