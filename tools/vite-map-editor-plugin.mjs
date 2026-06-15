// Dev-only Vite middleware powering the in-app map editor (tools/map_editor.html
// served at /tools/map_editor.html, or the game with ?editor=1).
//
// It runs ONLY in `npm run dev` (configureServer) and is never part of a
// production build, so there is no way to mutate source on a deployed server.
//
//   GET  /__editor/data   -> live layout JSON (read via ssrLoadModule, so it's
//                            always the real data in src/sim/content/*)
//   POST /__editor/save   -> writes edits back into the source files in place
//                            (regex replacement; only writes on a confirmed
//                            match, leaving the file untouched otherwise).
//
// Writes are confined to a fixed allowlist of files under src/sim/.

import fs from 'node:fs';
import path from 'node:path';

const WORLD_SEED = 20061; // mirrors src/main.ts

export function mapEditorPlugin() {
  return {
    name: 'map-editor',
    apply: 'serve', // dev only — excluded from `vite build`
    configureServer(server) {
      const root = server.config.root;
      const file = (rel) => path.join(root, rel);

      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/__editor/')) return next();
        try {
          if (req.method === 'GET' && req.url.startsWith('/__editor/data')) {
            const [z1, z2, z3, data] = await Promise.all([
              server.ssrLoadModule('/src/sim/content/zone1.ts'),
              server.ssrLoadModule('/src/sim/content/zone2.ts'),
              server.ssrLoadModule('/src/sim/content/zone3.ts'),
              server.ssrLoadModule('/src/sim/data.ts'),
            ]);
            const zoneMods = [z1, z2, z3];
            const zones = [z1.ZONE1_ZONE, z2.ZONE2_ZONE, z3.ZONE3_ZONE];
            const camps = [], buildings = [], roads = [];
            zoneMods.forEach((m, i) => {
              for (const c of m[`ZONE${i + 1}_CAMPS`]) camps.push({ ...c, zid: i });
              for (const b of m[`ZONE${i + 1}_PROPS`].buildings) buildings.push({ ...b, zid: i });
              for (const r of m[`ZONE${i + 1}_ROADS`]) roads.push(r);
            });
            sendJson(res, 200, {
              seed: WORLD_SEED,
              zones, camps, buildings, roads,
              playerStart: data.PLAYER_START,
              terrainEdits: data.TERRAIN_EDITS,
            });
            return;
          }

          if (req.method === 'GET' && req.url.startsWith('/__editor/default')) {
            const p = file('tools/map_default.json');
            if (!fs.existsSync(p)) { sendJson(res, 404, { error: 'tools/map_default.json missing — run: npx vite-node tools/dump_map_default.ts' }); return; }
            res.statusCode = 200; res.setHeader('content-type', 'application/json'); res.end(fs.readFileSync(p, 'utf8'));
            return;
          }

          if (req.method === 'POST' && req.url.startsWith('/__editor/save')) {
            const body = JSON.parse(await readBody(req));
            const report = saveAll(file, body);
            sendJson(res, report.errors.length ? 207 : 200, report);
            // touch nothing else — Vite HMR will reload the modules on file change
            return;
          }
          next();
        } catch (e) {
          sendJson(res, 500, { error: String(e && e.stack || e) });
        }
      });
    },
  };
}

// --- write-back ------------------------------------------------------------

function saveAll(file, body) {
  const written = [], skipped = [], errors = [];
  const edit = (rel, transform) => {
    const p = file(rel);
    try {
      const src = fs.readFileSync(p, 'utf8');
      const { out, matched, note } = transform(src);
      if (!matched) { skipped.push(`${rel}: ${note || 'no matching block'}`); return; }
      if (out !== src) { fs.writeFileSync(p, out); written.push(rel); }
      else skipped.push(`${rel}: unchanged`);
    } catch (e) { errors.push(`${rel}: ${e.message}`); }
  };

  // 1) terrain edits — replace the array literal, keep the file's comments/import
  if (Array.isArray(body.terrainEdits)) {
    edit('src/sim/content/terrain_edits.ts', (src) => {
      const arr = body.terrainEdits.length
        ? '[\n' + body.terrainEdits.map(e =>
            `  { x: ${num(e.x)}, z: ${num(e.z)}, radius: ${num(e.radius)}, delta: ${num(e.delta)}` +
            (e.hardness ? `, hardness: ${num(e.hardness)}` : '') + ' },').join('\n') + '\n]'
        : '[]';
      return replace(src, /export const TERRAIN_EDITS: TerrainEditDef\[\] = \[[\s\S]*?\];/,
        `export const TERRAIN_EDITS: TerrainEditDef[] = ${arr};`);
    });
  }

  // 2) player start
  if (body.playerStart) {
    edit('src/sim/data.ts', (src) => replace(src, /export const PLAYER_START = \{[^}]*\};/,
      `export const PLAYER_START = { x: ${num(body.playerStart.x)}, z: ${num(body.playerStart.z)} };`));
  }

  // 3) per-zone hub / graveyard / lakes / camps / buildings
  const byZone = (arr) => [0, 1, 2].map(i => (arr || []).filter(o => o.zid === i));
  const campsZ = byZone(body.camps), buildingsZ = byZone(body.buildings);
  (body.zones || []).forEach((zn, i) => {
    const N = i + 1, rel = `src/sim/content/zone${N}.ts`;
    edit(rel, (src) => {
      let s = src, any = false;
      const r = (re, val) => { const out = replace(s, re, val); if (out.matched) { s = out.out; any = true; } };
      r(/hub: \{[^}]*\},/, `hub: { x: ${num(zn.hub.x)}, z: ${num(zn.hub.z)}, radius: ${num(zn.hub.radius)}, name: ${q(zn.hub.name)} },`);
      r(/graveyard: \{[^}]*\},/, `graveyard: { x: ${num(zn.graveyard.x)}, z: ${num(zn.graveyard.z)} },`);
      r(/lakes: \[[\s\S]*?\],/, `lakes: [${zn.lakes.map(l => `{ x: ${num(l.x)}, z: ${num(l.z)}, radius: ${num(l.radius)} }`).join(', ')}],`);
      r(new RegExp(`export const ZONE${N}_CAMPS: CampDef\\[\\] = \\[[\\s\\S]*?\\n\\];`),
        `export const ZONE${N}_CAMPS: CampDef[] = [\n` +
        campsZ[i].map(c => `  { mobId: ${q(c.mobId)}, center: { x: ${num(c.x)}, z: ${num(c.z)} }, radius: ${num(c.radius)}, count: ${num(c.count)} },`).join('\n') + '\n];');
      r(/buildings: \[[\s\S]*?\n\s*\],/, `buildings: [\n` +
        buildingsZ[i].map(b => `    { kind: ${q(b.kind)}, x: ${num(b.x)}, z: ${num(b.z)}, w: ${num(b.w)}, d: ${num(b.d)}, rot: ${num(b.rot)} },`).join('\n') + '\n  ],');
      return { out: s, matched: any, note: 'no zone blocks matched' };
    });
  });

  return { written, skipped, errors };
}

function replace(src, re, val) {
  return re.test(src) ? { out: src.replace(re, () => val), matched: true } : { out: src, matched: false };
}
const num = (n) => (Number.isFinite(+n) ? +n : 0);
const q = (s) => `'${String(s).replace(/'/g, "\\'")}'`;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = ''; req.on('data', c => { b += c; if (b.length > 2e6) reject(new Error('body too large')); });
    req.on('end', () => resolve(b)); req.on('error', reject);
  });
}
function sendJson(res, code, obj) {
  res.statusCode = code; res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(obj));
}
