// Pure formatting for the minimap clock (no DOM) so it can be snapshot-tested
// like xp_bar.ts. The HUD owns the DOM element and the per-frame update; this
// module just turns a Date + a format flag into the displayed string.

// Format the hours/minutes of `date` as a classic minimap clock readout.
// `use24` → "08:05" / "17:42"; otherwise 12-hour "8:05 AM" / "5:42 PM".
// Minutes are always zero-padded; 24-hour hours are zero-padded too, while the
// 12-hour reading is unpadded (1–12) as classic clients show it.
export function formatClockTime(date: Date, use24: boolean): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const mm = m < 10 ? `0${m}` : `${m}`;
  if (use24) {
    const hh = h < 10 ? `0${h}` : `${h}`;
    return `${hh}:${mm}`;
  }
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${suffix}`;
}
