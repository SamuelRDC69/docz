// Dumps the current map layout from the real source modules into
// tools/map_default.json — the "factory default" the editor reverts to.
// Run:  npx vite-node tools/dump_map_default.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ZONE1_ZONE, ZONE1_CAMPS, ZONE1_PROPS, ZONE1_ROADS } from '../src/sim/content/zone1';
import { ZONE2_ZONE, ZONE2_CAMPS, ZONE2_PROPS, ZONE2_ROADS } from '../src/sim/content/zone2';
import { ZONE3_ZONE, ZONE3_CAMPS, ZONE3_PROPS, ZONE3_ROADS } from '../src/sim/content/zone3';
import { PLAYER_START, TERRAIN_EDITS } from '../src/sim/data';

const zones = [ZONE1_ZONE, ZONE2_ZONE, ZONE3_ZONE];
const campSets = [ZONE1_CAMPS, ZONE2_CAMPS, ZONE3_CAMPS];
const propSets = [ZONE1_PROPS, ZONE2_PROPS, ZONE3_PROPS];
const roadSets = [ZONE1_ROADS, ZONE2_ROADS, ZONE3_ROADS];

const camps: any[] = [], buildings: any[] = [], roads: any[] = [];
campSets.forEach((set, i) => set.forEach(c => camps.push({ ...c, zid: i })));
propSets.forEach((set, i) => set.buildings.forEach(b => buildings.push({ ...b, zid: i })));
roadSets.forEach(set => set.forEach(r => roads.push(r)));

const out = { seed: 20061, zones, camps, buildings, roads, playerStart: PLAYER_START, terrainEdits: TERRAIN_EDITS };
const dest = fileURLToPath(new URL('./map_default.json', import.meta.url));
writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
console.log('wrote', dest, '—', zones.length, 'zones,', camps.length, 'camps,', buildings.length, 'buildings');
