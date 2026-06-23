// Quantifies how spread-out the Brightwood Glade wildlife is, plus how much
// breathing room Ranger Elwyn has from the nearest mob. Bundles src/sim with
// esbuild (no browser/server needed) and reads real spawned positions from a
// fixed-seed Sim. Run on two git states to get a before/after comparison:
//
//   node scripts/brightwood_density_metric.mjs
//
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(mkdtempSync(join(tmpdir(), 'bw-')), 'sim.mjs');
await build({
  stdin: {
    contents: `export { Sim } from './src/sim/sim.ts';\nexport { NPCS } from './src/sim/data.ts';`,
    resolveDir: process.cwd(), sourcefile: 'entry.ts', loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out,
});

const { Sim, NPCS } = await import(out);

// The 11 Brightwood Glade species (the "huge area of mobs north of spawn").
const GLADE = new Set([
  'brightwood_hare', 'glade_fox', 'spotted_fawn', 'meadow_crane',
  'thornpelt_badger', 'dawnmane_doe', 'bramble_lynx', 'brightwood_stag',
  'grovetusk_boar', 'sunhide_bear', 'brightwood_monarch',
]);

const sim = new Sim({ seed: 1337, playerClass: 'warrior' });
const mobs = [...sim.entities.values()].filter(
  (e) => e.kind === 'mob' && GLADE.has(e.templateId),
);

const dist = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);

// Nearest-neighbour distance for every glade mob.
const nn = mobs.map((m) => {
  let best = Infinity;
  for (const o of mobs) if (o !== m) best = Math.min(best, dist(m, o));
  return best;
});
nn.sort((a, b) => a - b);
const mean = nn.reduce((s, v) => s + v, 0) / nn.length;
const median = nn[Math.floor(nn.length / 2)];

// Bounding box / footprint of the cluster.
const xs = mobs.map((m) => m.pos.x), zs = mobs.map((m) => m.pos.z);
const span = (arr) => Math.max(...arr) - Math.min(...arr);

// Ranger Elwyn's clearance: distance from his post to the nearest glade mob.
const elwyn = NPCS.ranger_elwyn.pos;
const elwynClear = Math.min(
  ...mobs.map((m) => Math.hypot(m.pos.x - elwyn.x, m.pos.z - elwyn.z)),
);

console.log(`Brightwood Glade: ${mobs.length} mobs (seed 1337)`);
console.log(`  footprint        : ${span(xs).toFixed(0)} x  by  ${span(zs).toFixed(0)} z`);
console.log(`  nearest-neighbour: mean ${mean.toFixed(2)}y, median ${median.toFixed(2)}y, min ${nn[0].toFixed(2)}y`);
console.log(`  mobs within 6y of another: ${nn.filter((d) => d < 6).length} / ${nn.length}`);
console.log(`Ranger Elwyn @ (${elwyn.x}, ${elwyn.z})`);
console.log(`  clearance to nearest glade mob: ${elwynClear.toFixed(2)}y`);
