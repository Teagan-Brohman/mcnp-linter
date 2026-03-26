import { describe, it, expect } from 'vitest';
import { getAbundances } from '../../server/src/data/abundances';

describe('getAbundances', () => {
  it('returns isotopes for Carbon (Z=6)', () => {
    const result = getAbundances(6);
    expect(result).toBeDefined();
    expect(result!.length).toBe(2);
    expect(result![0].a).toBe(12);
    expect(result![1].a).toBe(13);
  });

  it('atom fractions sum to ~1.0 for Carbon', () => {
    const result = getAbundances(6)!;
    const sum = result.reduce((s, i) => s + i.atomFraction, 0);
    expect(sum).toBeCloseTo(1.0, 4);
  });

  it('weight fractions sum to ~1.0 for Carbon', () => {
    const result = getAbundances(6)!;
    const sum = result.reduce((s, i) => s + i.weightFraction, 0);
    expect(sum).toBeCloseTo(1.0, 4);
  });

  it('returns single isotope for monoisotopic Al (Z=13)', () => {
    const result = getAbundances(13);
    expect(result).toBeDefined();
    expect(result!.length).toBe(1);
    expect(result![0].a).toBe(27);
    expect(result![0].atomFraction).toBe(1.0);
    expect(result![0].weightFraction).toBe(1.0);
  });

  it('returns isotopes for Oxygen (Z=8)', () => {
    const result = getAbundances(8);
    expect(result).toBeDefined();
    expect(result!.length).toBe(3);
  });

  it('returns isotopes for Uranium (Z=92)', () => {
    const result = getAbundances(92);
    expect(result).toBeDefined();
    expect(result!.length).toBe(3);
    const sum = result!.reduce((s, i) => s + i.atomFraction, 0);
    expect(sum).toBeCloseTo(1.0, 4);
  });

  it('returns undefined for synthetic Technetium (Z=43)', () => {
    expect(getAbundances(43)).toBeUndefined();
  });

  it('returns undefined for synthetic Promethium (Z=61)', () => {
    expect(getAbundances(61)).toBeUndefined();
  });

  it('returns undefined for Z=0 or Z>92', () => {
    expect(getAbundances(0)).toBeUndefined();
    expect(getAbundances(93)).toBeUndefined();
  });

  it('atom fractions sum to ~1.0 for all elements with data', () => {
    for (let z = 1; z <= 92; z++) {
      const result = getAbundances(z);
      if (!result) continue;
      const sum = result.reduce((s, i) => s + i.atomFraction, 0);
      expect(sum, `Z=${z} atom fractions`).toBeCloseTo(1.0, 3);
    }
  });

  it('weight fractions sum to ~1.0 for all elements with data', () => {
    for (let z = 1; z <= 92; z++) {
      const result = getAbundances(z);
      if (!result) continue;
      const sum = result.reduce((s, i) => s + i.weightFraction, 0);
      expect(sum, `Z=${z} weight fractions`).toBeCloseTo(1.0, 3);
    }
  });
});
