import { describe, it, expect } from 'vitest';
import { orderTabTargets, TabCandidate } from '../src/sim/tab_target';

// Player faces +Z (facing 0): forward is (sin 0, cos 0) = (0, 1).
const FACING_NORTH = 0;

describe('orderTabTargets', () => {
  it('cycles an on-screen enemy before a closer one behind the player', () => {
    // Behind the player (-Z) but very close; in front (+Z) but farther.
    const behind: TabCandidate = { id: 1, dx: 0, dz: -5, d: 5, engaged: false };
    const front: TabCandidate = { id: 2, dx: 0, dz: 30, d: 30, engaged: false };
    const order = orderTabTargets([behind, front], FACING_NORTH);
    // The on-screen enemy leads even though it is farther away.
    expect(order[0]).toBe(2);
    // The off-screen one is still reachable, just last.
    expect(order).toEqual([2, 1]);
  });

  it('prioritizes an enemy in combat with the player over an idle on-screen one', () => {
    const engagedFar: TabCandidate = { id: 1, dx: 2, dz: 30, d: 30, engaged: true };
    const idleNear: TabCandidate = { id: 2, dx: 0, dz: 5, d: 5, engaged: false };
    const order = orderTabTargets([engagedFar, idleNear], FACING_NORTH);
    // Both are on screen, so the engaged one wins (tier 0 vs 1).
    expect(order).toEqual([1, 2]);
  });

  it('orders on-screen enemies nearest first', () => {
    const far: TabCandidate = { id: 1, dx: 0, dz: 30, d: 30, engaged: false };
    const near: TabCandidate = { id: 2, dx: 0, dz: 8, d: 8, engaged: false };
    const mid: TabCandidate = { id: 3, dx: 0, dz: 15, d: 15, engaged: false };
    expect(orderTabTargets([far, near, mid], FACING_NORTH)).toEqual([2, 3, 1]);
  });

  it('keeps an engaged enemy behind the player reachable but after visible ones', () => {
    const engagedBehind: TabCandidate = { id: 1, dx: 0, dz: -10, d: 10, engaged: true };
    const idleFront: TabCandidate = { id: 2, dx: 0, dz: 20, d: 20, engaged: false };
    const order = orderTabTargets([engagedBehind, idleFront], FACING_NORTH);
    // On-screen idle (tier 1) leads engaged-but-off-screen (tier 2).
    expect(order).toEqual([2, 1]);
  });

  it('is deterministic and stable for ties', () => {
    const a: TabCandidate = { id: 7, dx: 0, dz: 10, d: 10, engaged: false };
    const b: TabCandidate = { id: 3, dx: 1, dz: 10, d: 10, engaged: false };
    const run = () => orderTabTargets([a, b], FACING_NORTH);
    // Same tier and distance: lower id breaks the tie, and repeat runs match.
    expect(run()).toEqual([3, 7]);
    expect(run()).toEqual(run());
  });
});
