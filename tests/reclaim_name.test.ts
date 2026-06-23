import { describe, expect, it } from 'vitest';
import { archiveFallbackName, base26Suffix, freedArchiveCandidate, MAX_NAME_LEN } from '../server/reclaim_name';

// When a character name is released from a deactivated ("invalid") account, the
// orphaned character keeps a placeholder name so its row stays valid (and the
// original owner is force-renamed if they ever reactivate). The suffixing must
// match the per-realm dedupe in SOCIAL_SCHEMA: bijective base-26 (a, b, ..., z,
// aa, ...) appended to the truncated original, capped at MAX_NAME_LEN.
describe('base26Suffix', () => {
  it('produces bijective base-26 suffixes matching the SQL dedupe migration', () => {
    expect(base26Suffix(1)).toBe('a');
    expect(base26Suffix(26)).toBe('z');
    expect(base26Suffix(27)).toBe('aa');
    expect(base26Suffix(52)).toBe('az');
    expect(base26Suffix(53)).toBe('ba');
    expect(base26Suffix(702)).toBe('zz');
    expect(base26Suffix(703)).toBe('aaa');
  });
});

describe('freedArchiveCandidate', () => {
  it('appends the suffix without exceeding the 16-char name cap', () => {
    expect(freedArchiveCandidate('SturdyStubs', 1)).toBe('SturdyStubsa');
    const long = 'Abcdefghijklmnop'; // exactly 16 chars
    expect(freedArchiveCandidate(long, 1).length).toBeLessThanOrEqual(MAX_NAME_LEN);
    expect(freedArchiveCandidate(long, 1).endsWith('a')).toBe(true);
    // a two-char suffix shaves two chars off the truncated original
    expect(freedArchiveCandidate(long, 27)).toBe('Abcdefghijklmnaa'.slice(0, 14) + 'aa');
  });

  it('always keeps at least one character of the original even with a long suffix', () => {
    expect(freedArchiveCandidate('X', 703).startsWith('X')).toBe(true);
    expect(freedArchiveCandidate('X', 703).length).toBeLessThanOrEqual(MAX_NAME_LEN);
  });
});

describe('archiveFallbackName', () => {
  it('embeds the unique character id and stays within the name cap', () => {
    expect(archiveFallbackName('SturdyStubs', 42)).toBe('SturdyStubs~42');
    const long = 'Abcdefghijklmnop'; // 16 chars
    const out = archiveFallbackName(long, 1234567);
    expect(out.length).toBeLessThanOrEqual(MAX_NAME_LEN);
    expect(out.endsWith('~1234567')).toBe(true);
  });
});
