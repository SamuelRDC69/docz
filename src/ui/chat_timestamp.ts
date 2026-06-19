// Chat timestamps — a classic-WoW "Show Timestamps" interface option.
//
// Pure, DOM-free formatting helpers (snapshot-tested in tests/). The HUD owns
// the on/off + clock-format state and persists it to localStorage; this module
// just turns a wall-clock `Date` into the bracketed prefix shown on chat lines.
// Wall-clock time is fine here — the determinism ban is sim-only.

export type ChatClock = '12h' | '24h';

export const CHAT_CLOCKS: readonly ChatClock[] = ['12h', '24h'];

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

// Coerce arbitrary localStorage junk back to a valid clock (default 24h).
export function clampChatClock(v: string | null): ChatClock {
  return v === '12h' ? '12h' : '24h';
}

// Format `d` as the bracketed prefix, e.g. "[14:32]" (24h) or "[2:32 PM]" (12h).
export function formatChatTimestamp(d: Date, clock: ChatClock): string {
  const m = pad2(d.getMinutes());
  if (clock === '12h') {
    const h24 = d.getHours();
    const period = h24 < 12 ? 'AM' : 'PM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `[${h12}:${m} ${period}]`;
  }
  return `[${pad2(d.getHours())}:${m}]`;
}
