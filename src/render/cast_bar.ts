// Pure presentation logic for the overhead spell cast/channel bar. Kept DOM-free
// (like nameplate_projection.ts / locomotion.ts) so the fill + label rules are
// unit-testable without a WebGL context. The renderer turns this into DOM.
import { Entity, FISHING_CAST_ID } from '../sim/types';
import { ABILITIES } from '../sim/data';

export interface CastBarState {
  /** whether the bar should be shown at all this frame */
  visible: boolean;
  /** channels drain (true); hardcasts fill toward completion (false) */
  channel: boolean;
  /** 0..1 width fraction — casts grow toward 1, channels shrink toward 0 */
  fill: number;
  /** ability display name (fishing and unknown ids handled) */
  label: string;
}

const HIDDEN: CastBarState = { visible: false, channel: false, fill: 0, label: '' };

export function castBarState(e: Entity): CastBarState {
  // corpses, doors/crates, and idle entities show nothing; guard the divide too
  if (e.dead || e.kind === 'object' || !e.castingAbility || e.castTotal <= 0) return HIDDEN;
  const remaining = Math.max(0, Math.min(1, e.castRemaining / e.castTotal));
  const fill = e.channeling ? remaining : 1 - remaining;
  const label = e.castingAbility === FISHING_CAST_ID
    ? 'Fishing'
    : ABILITIES[e.castingAbility]?.name ?? e.castingAbility;
  return { visible: true, channel: e.channeling, fill, label };
}
