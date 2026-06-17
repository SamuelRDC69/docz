import { describe, it, expect } from 'vitest';
import { characterNetWorth, isMintEligible, type CharacterState } from '../src/sim/sim';
import { ITEMS } from '../src/sim/data';

// Real content item ids used as fixtures (see src/sim/content/items.ts).
const SWORD = 'worn_sword'; // sellValue 10
const TUNIC = 'recruit_tunic'; // sellValue 5

function baseState(over: Partial<CharacterState> = {}): CharacterState {
  return {
    level: 20,
    xp: 0,
    copper: 0,
    hp: 100,
    resource: 0,
    pos: { x: 0, z: 0 },
    facing: 0,
    equipment: {},
    inventory: [],
    questLog: [],
    questsDone: [],
    ...over,
  };
}

describe('characterNetWorth', () => {
  it('is just the copper when nothing is owned', () => {
    expect(characterNetWorth(baseState({ copper: 1234 }))).toBe(1234);
  });

  it('sums equipped item vendor values', () => {
    const state = baseState({ copper: 100, equipment: { mainhand: SWORD, chest: TUNIC } });
    // 100 copper + worn_sword(10) + recruit_tunic(5)
    expect(characterNetWorth(state)).toBe(100 + ITEMS[SWORD].sellValue + ITEMS[TUNIC].sellValue);
    expect(characterNetWorth(state)).toBe(115);
  });

  it('sums bag stacks by count and adds equipped + copper', () => {
    const state = baseState({
      copper: 1000,
      equipment: { mainhand: SWORD },
      inventory: [{ itemId: SWORD, count: 3 }, { itemId: TUNIC, count: 2 }],
    });
    // 1000 + sword(10) equipped + 3*sword(30) + 2*tunic(10) = 1050
    expect(characterNetWorth(state)).toBe(1000 + 10 + 30 + 10);
  });

  it('prices unknown item ids at zero and ignores junk counts', () => {
    const state = baseState({
      copper: 50,
      inventory: [{ itemId: 'does_not_exist', count: 99 }, { itemId: SWORD, count: 0 }],
    });
    expect(characterNetWorth(state)).toBe(50);
  });

  it('treats negative copper as zero', () => {
    expect(characterNetWorth(baseState({ copper: -500 }))).toBe(0);
  });
});

describe('isMintEligible', () => {
  it('is false for a character that has never prestiged', () => {
    expect(isMintEligible(baseState())).toBe(false);
    expect(isMintEligible(baseState({ prestigeRank: 0 }))).toBe(false);
  });

  it('is true once the character has prestiged at least once', () => {
    expect(isMintEligible(baseState({ prestigeRank: 1 }))).toBe(true);
    expect(isMintEligible(baseState({ prestigeRank: 5 }))).toBe(true);
  });
});
