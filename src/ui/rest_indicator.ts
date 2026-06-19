// Pure derivation of the player unit-frame "resting" indicator state. Kept
// UI-framework-free (no DOM) so the label precedence can be snapshot tested
// directly, mirroring xp_bar.ts. Reads only the three booleans the sim already
// exposes on the player Entity (and which ride along in online snapshots), so
// the indicator works identically offline and online with zero sim/net change.

export interface RestStateInput {
  sitting: boolean;
  eating: boolean;
  drinking: boolean;
}

export interface RestView {
  resting: boolean; // any seated state → show the indicator
  label: string; // tooltip / aria text ('' when not resting)
  glyph: string; // single-char marker shown on the portrait
}

// Label precedence: recovering (eating/drinking) is the more informative state,
// so it wins over a plain seat. Eating and drinking can run at once (separate
// slots); we surface the combined "Recovering" rather than picking one. A bare
// sit (no consumable) reads as classic "Resting".
export function restView(input: RestStateInput): RestView {
  const { sitting, eating, drinking } = input;
  if (eating && drinking) return { resting: true, label: 'Eating & drinking', glyph: 'z' };
  if (eating) return { resting: true, label: 'Eating', glyph: 'z' };
  if (drinking) return { resting: true, label: 'Drinking', glyph: 'z' };
  if (sitting) return { resting: true, label: 'Resting', glyph: 'z' };
  return { resting: false, label: '', glyph: 'z' };
}
