// Tab target cycling order.
//
// Classic-style Tab targeting should cycle the enemies a player can actually
// see and fight, not the nearest blip anywhere in radius. The sim has no
// camera (the same code runs on the authoritative server and headless), so
// "on screen" is modelled deterministically from the player's facing: the
// forward vector is (sin(facing), cos(facing)) (see player movement in
// sim.ts), and a target counts as on screen when it falls inside a front cone
// around that vector. "In combat with you" is supplied by the caller from sim
// aggro state. Candidates are ranked into priority tiers so engaged, on-screen
// enemies cycle first, while off-screen ones stay reachable as a last resort
// instead of stealing the selection. Ties break by distance then id, so the
// order is stable and replay-deterministic.

export interface TabCandidate {
  id: number;
  // Target position relative to the player (target.pos - player.pos), in yards.
  dx: number;
  dz: number;
  // Planar distance to the player, in yards.
  d: number;
  // True when this enemy is in combat with the player (aggroed onto / targeting them).
  engaged: boolean;
}

// Half-angle of the front cone treated as "on screen", in radians. ~70 degrees
// each side (a ~140 degree field) generously covers the third-person camera's
// view without picking enemies directly behind the player.
export const TAB_FRONT_CONE_HALF = (70 * Math.PI) / 180;

function onScreen(c: TabCandidate, facing: number, coneHalf: number): boolean {
  // A target on top of the player has no meaningful direction; treat as visible.
  if (c.d <= 1e-6) return true;
  const fx = Math.sin(facing);
  const fz = Math.cos(facing);
  // Cosine of the angle between facing and the direction to the target.
  const cos = (fx * c.dx + fz * c.dz) / c.d;
  return cos >= Math.cos(coneHalf);
}

// Lower tier = cycles first. 0: engaged and on screen, 1: on screen,
// 2: engaged but off screen, 3: neither.
function tier(c: TabCandidate, facing: number, coneHalf: number): number {
  const vis = onScreen(c, facing, coneHalf);
  if (c.engaged && vis) return 0;
  if (vis) return 1;
  if (c.engaged) return 2;
  return 3;
}

// Return candidate ids in the order Tab should cycle them.
export function orderTabTargets(
  candidates: TabCandidate[],
  facing: number,
  coneHalf: number = TAB_FRONT_CONE_HALF,
): number[] {
  return candidates
    .map((c) => ({ id: c.id, t: tier(c, facing, coneHalf), d: c.d }))
    .sort((a, b) => a.t - b.t || a.d - b.d || a.id - b.id)
    .map((c) => c.id);
}
