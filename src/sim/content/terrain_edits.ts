// Hand-authored terrain raise/sink brushes, layered on top of the analytic
// heightfield in sim/world.ts. Each entry is a radial bump (delta > 0) or pit
// (delta < 0). Both the sim collider and the rendered terrain mesh sample
// terrainHeight(), so anything added here shows up in-world AND blocks/clamps
// movement consistently — no separate render step.
//
// Author these visually with tools/map_editor.html (Brush tool), then paste the
// exported array below. Coordinates are world units: x in [-180, 180], z runs
// north across the zone strip (Eastbrook ~0, Fenbridge ~300, Highwatch ~660).

import type { TerrainEditDef } from '../types';

export const TERRAIN_EDITS: TerrainEditDef[] = [
  // Example (delete or edit): a small hill just east of Eastbrook.
  // { x: 40, z: 10, radius: 18, delta: 8, hardness: 0.2 },
];
