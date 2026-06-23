// Tab targeting should cycle the enemies a player can see / is fighting, not
// the nearest blip regardless of where the player is looking. Reproduces the
// bug where Tab selected an off-screen mob behind the player over a visible one.
import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';

const SEED = 31337;

function spawnMob(sim: Sim, id: number, dx: number, dz: number) {
  const p = sim.entities.get(sim.playerId)!;
  const mob = createMob(id, MOBS.ridge_stalker, 13, { x: p.pos.x + dx, y: p.pos.y, z: p.pos.z + dz });
  sim.entities.set(mob.id, mob);
  (sim as any).rebucket(mob);
  return mob;
}

describe('Sim.tabTarget on-screen / in-combat cycling', () => {
  it('targets the on-screen enemy before a closer one behind the player', () => {
    const sim = new Sim({ seed: SEED, playerClass: 'warrior' });
    const p = sim.entities.get(sim.playerId)!;
    p.facing = 0; // facing +Z
    (sim as any).rebucket(p);
    const behindClose = spawnMob(sim, 900001, 0, -6); // behind, near
    const frontFar = spawnMob(sim, 900002, 0, 25); // in front, far

    sim.tabTarget();
    expect(p.targetId).toBe(frontFar.id);

    // Cycling reaches the off-screen one rather than dropping it.
    sim.tabTarget();
    expect(p.targetId).toBe(behindClose.id);
  });

  it('prefers an enemy engaged with the player', () => {
    const sim = new Sim({ seed: SEED, playerClass: 'warrior' });
    const p = sim.entities.get(sim.playerId)!;
    p.facing = 0;
    (sim as any).rebucket(p);
    const idleNear = spawnMob(sim, 900011, 0, 6); // on screen, idle, near
    const engagedFar = spawnMob(sim, 900012, 0, 28); // on screen, far, aggroed
    engagedFar.aggroTargetId = p.id;

    sim.tabTarget();
    expect(p.targetId).toBe(engagedFar.id);
  });
});
