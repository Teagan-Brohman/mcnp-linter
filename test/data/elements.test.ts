import { describe, it, expect } from 'vitest';
import { getElement, isValidZ, isPlausibleIsotope } from '../../server/src/data/elements';

describe('elements', () => {
  it('returns hydrogen for Z=1', () => {
    const el = getElement(1);
    expect(el?.symbol).toBe('H');
    expect(el?.name).toBe('Hydrogen');
  });
  it('returns uranium for Z=92', () => {
    const el = getElement(92);
    expect(el?.symbol).toBe('U');
    expect(el?.name).toBe('Uranium');
  });
  it('returns undefined for Z=0', () => { expect(getElement(0)).toBeUndefined(); });
  it('returns undefined for Z=119', () => { expect(getElement(119)).toBeUndefined(); });
  it('validates Z range', () => {
    expect(isValidZ(1)).toBe(true);
    expect(isValidZ(118)).toBe(true);
    expect(isValidZ(0)).toBe(false);
    expect(isValidZ(119)).toBe(false);
  });
  it('validates plausible isotopes', () => {
    expect(isPlausibleIsotope(92, 235)).toBe(true);
    expect(isPlausibleIsotope(92, 238)).toBe(true);
    expect(isPlausibleIsotope(92, 0)).toBe(true);  // natural
    expect(isPlausibleIsotope(92, 700)).toBe(false);
    expect(isPlausibleIsotope(1, 1)).toBe(true);
    expect(isPlausibleIsotope(1, 3)).toBe(true);  // tritium
  });
  it('has all 118 elements', () => {
    for (let z = 1; z <= 118; z++) {
      const el = getElement(z);
      expect(el, `Element Z=${z} should exist`).toBeDefined();
      expect(el!.z).toBe(z);
      expect(el!.symbol).toBeTruthy();
      expect(el!.name).toBeTruthy();
      expect(el!.minA).toBeLessThan(el!.maxA);
    }
  });
  it('has correct data for key elements', () => {
    const tests: [number, string, string, number, number][] = [
      [1, 'H', 'Hydrogen', 1, 7],
      [6, 'C', 'Carbon', 8, 22],
      [8, 'O', 'Oxygen', 12, 28],
      [13, 'Al', 'Aluminium', 21, 43],
      [26, 'Fe', 'Iron', 45, 72],
      [29, 'Cu', 'Copper', 52, 80],
      [92, 'U', 'Uranium', 217, 242],
      [94, 'Pu', 'Plutonium', 228, 247],
      [118, 'Og', 'Oganesson', 293, 295],
    ];
    for (const [z, sym, name, minA, maxA] of tests) {
      const el = getElement(z);
      expect(el?.symbol, `Z=${z} symbol`).toBe(sym);
      expect(el?.name, `Z=${z} name`).toBe(name);
      expect(el?.minA, `Z=${z} minA`).toBe(minA);
      expect(el?.maxA, `Z=${z} maxA`).toBe(maxA);
    }
  });
  it('rejects invalid Z for isPlausibleIsotope', () => {
    expect(isPlausibleIsotope(0, 1)).toBe(false);
    expect(isPlausibleIsotope(119, 300)).toBe(false);
  });
});
