/* Prepare the CC0 Quaternius characters for the web.

   Quaternius ships each figure with all 17 clips of the Universal Animated
   Character set (death, sword fights, rolls...) at the full animation sample rate.
   The shop needs three of them, so this trims the rest, welds and quantises the
   geometry and re-packs the buffer: 1.24 MB -> ~270 KB per character.

   Usage (needs @gltf-transform/*):
     npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions
     node tools/prep_characters.mjs <source-dir>

   Source: "Ultimate Animated Character Pack" by Quaternius, CC0 1.0.
*/
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, resample, quantize } from '@gltf-transform/functions';
import fs from 'node:fs';
import path from 'node:path';

const KEEP = /^(Idle|Walk|Walk_Carry)$/;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const src = process.argv[2] || './characters-src';
const dst = new URL('../models', import.meta.url).pathname;
const tmp = '/tmp/character-stage';
fs.mkdirSync(tmp, { recursive: true });

for (const f of fs.readdirSync(src).filter((n) => n.endsWith('.glb'))) {
  const doc = await io.read(path.join(src, f));
  for (const anim of doc.getRoot().listAnimations()) {
    if (!KEEP.test(anim.getName())) anim.dispose();
  }
  await doc.transform(
    dedup(),
    prune(),
    resample({ tolerance: 0.004 }),
    weld({ tolerance: 0.0001 }),
    quantize({ quantizePosition: 16, quantizeNormal: 8, quantizeWeight: 8, quantizeTexcoord: 12 }),
  );
  const stage = path.join(tmp, f);
  await io.write(stage, doc);
  // read back so only still-referenced data is written: this is what takes the
  // file from ~720 KB (mostly abandoned accessors) down to ~270 KB
  const clean = await io.read(stage);
  await clean.transform(prune());
  const name = f.toLowerCase().replace('casual2_female', 'casual2_female');
  await io.write(path.join(dst, name), clean);
  console.log(name, Math.round(fs.statSync(path.join(dst, name)).size / 1024) + 'KB',
    '| clips:', clean.getRoot().listAnimations().map((a) => a.getName()).join(','));
}
