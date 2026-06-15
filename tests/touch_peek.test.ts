import { describe, it, expect } from 'vitest';
import { TouchPeekGuard, TOOLTIP_PEEK_MS } from '../src/ui/touch_peek';

describe('TouchPeekGuard', () => {
  it('a quick tap (no peek) activates the control', () => {
    const g = new TouchPeekGuard();
    g.press();
    // no peek() — the long-press timer never fired
    expect(g.consume()).toBe(false);
  });

  it('a long-press peek suppresses the release click', () => {
    const g = new TouchPeekGuard();
    g.press();
    g.peek(); // tooltip shown after the hold threshold
    expect(g.consume()).toBe(true);
  });

  it('consume resets, so the next tap activates again', () => {
    const g = new TouchPeekGuard();
    g.press();
    g.peek();
    expect(g.consume()).toBe(true);
    g.press();
    expect(g.consume()).toBe(false);
  });

  it('a fresh press clears a stale peek from a previous control', () => {
    const g = new TouchPeekGuard();
    g.press();
    g.peek(); // peeked an element whose click was never consumed
    g.press(); // a different control is now pressed
    expect(g.consume()).toBe(false);
  });

  it('exposes a sane default hold threshold', () => {
    expect(TOOLTIP_PEEK_MS).toBeGreaterThan(300);
    expect(TOOLTIP_PEEK_MS).toBeLessThan(2000);
  });
});
