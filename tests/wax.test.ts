import { describe, expect, it } from 'vitest';
import { feeCovers, mintAttributes, getWaxConfig, waxEnabled } from '../server/wax';

describe('feeCovers', () => {
  it('accepts an exact or larger payment in the same token', () => {
    expect(feeCovers('5.00000000 WAX', '5.00000000 WAX')).toBe(true);
    expect(feeCovers('10.00000000 WAX', '5.00000000 WAX')).toBe(true);
  });

  it('rejects an underpayment', () => {
    expect(feeCovers('4.99999999 WAX', '5.00000000 WAX')).toBe(false);
  });

  it('rejects a payment in a different token', () => {
    expect(feeCovers('5.0000 TLM', '5.00000000 WAX')).toBe(false);
  });

  it('rejects malformed amounts', () => {
    expect(feeCovers('not an asset', '5.00000000 WAX')).toBe(false);
  });
});

describe('mintAttributes', () => {
  it('serializes the character snapshot as antelope variant tuples', () => {
    const attrs = mintAttributes({
      name: 'Frosty', charClass: 'mage', level: 20, prestigeRank: 2,
      netWorth: 123456, netWorthText: '12g 34s 56c', characterId: 42,
    });
    const byKey = Object.fromEntries(attrs.map((a) => [a.key, a.value]));
    expect(byKey.name).toEqual(['string', 'Frosty']);
    expect(byKey.class).toEqual(['string', 'mage']);
    expect(byKey.level).toEqual(['uint16', 20]);
    expect(byKey.prestige).toEqual(['uint16', 2]);
    expect(byKey.networth).toEqual(['uint64', 123456]);
    expect(byKey.character_id).toEqual(['uint64', 42]);
  });

  it('floors and clamps net worth to a non-negative integer', () => {
    const attrs = mintAttributes({
      name: 'X', charClass: 'rogue', level: 20, prestigeRank: 1,
      netWorth: -5.9, netWorthText: '0c', characterId: 1,
    });
    expect(Object.fromEntries(attrs.map((a) => [a.key, a.value])).networth).toEqual(['uint64', 0]);
  });
});

describe('config gating', () => {
  it('is disabled with no env and exposes config without the private key', () => {
    // No WAX_* env set in the test runner → feature is opt-out by default.
    expect(waxEnabled()).toBe(false);
    const cfg = getWaxConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg).not.toHaveProperty('privateKey');
    expect(typeof cfg.mintFee).toBe('string');
  });
});
