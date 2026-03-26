import { describe, it, expect } from 'vitest';
import { suggestMatch } from '../../server/src/utils/fuzzyMatch';

describe('suggestMatch', () => {
  const candidates = ['SDEF', 'KCODE', 'NPS', 'PHYS', 'MODE', 'IMP', 'FILL', 'TRCL'];

  it('returns exact match (distance 0)', () => {
    expect(suggestMatch('SDEF', candidates)).toBe('SDEF');
  });

  it('matches single-char typo (distance 1)', () => {
    expect(suggestMatch('NP', candidates)).toBe('NPS');      // missing char
    expect(suggestMatch('NPSS', candidates)).toBe('NPS');    // extra char
    expect(suggestMatch('SEDF', candidates)).toBe('SDEF');   // transposition
  });

  it('matches two-char typo (distance 2)', () => {
    expect(suggestMatch('SRDEF', candidates)).toBe('SDEF');  // extra + wrong char
    expect(suggestMatch('KODE', candidates)).toBe('KCODE');  // missing char
  });

  it('returns undefined when no match within max distance', () => {
    expect(suggestMatch('FOOBAR', candidates)).toBeUndefined();
    expect(suggestMatch('XYZZY', candidates)).toBeUndefined();
  });

  it('is case-insensitive', () => {
    expect(suggestMatch('sdef', candidates)).toBe('SDEF');
    expect(suggestMatch('kcode', candidates)).toBe('KCODE');
  });

  it('respects custom maxDistance', () => {
    // SDFE vs SDEF: two substitutions (F↔E swap) = distance 2
    expect(suggestMatch('SDFE', candidates, 1)).toBeUndefined();
    expect(suggestMatch('SDFE', candidates, 2)).toBe('SDEF');
  });

  it('breaks ties alphabetically', () => {
    // 'NP' is distance 1 from 'NPS' and distance 2 from 'IMP'
    expect(suggestMatch('NP', candidates)).toBe('NPS');
  });

  it('returns undefined for empty candidates', () => {
    expect(suggestMatch('SDEF', [])).toBeUndefined();
  });
});
