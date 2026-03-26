import { describe, it, expect } from 'vitest';
import { getSurfaceType } from '../../server/src/data/surfaceTypes';

describe('surfaceTypes', () => {
  it('returns plane info for PX', () => {
    const st = getSurfaceType('PX');
    expect(st?.description).toBe('Plane normal to x axis');
    expect(st?.paramNames).toEqual(['D']);
  });
  it('returns sphere info for SO', () => {
    const st = getSurfaceType('SO');
    expect(st?.description).toContain('Sphere');
    expect(st?.paramNames).toEqual(['R']);
  });
  it('is case-insensitive', () => {
    expect(getSurfaceType('px')?.description).toBe(getSurfaceType('PX')?.description);
  });
  it('returns undefined for unknown mnemonic', () => {
    expect(getSurfaceType('ZZ')).toBeUndefined();
  });
  it('handles slash mnemonics like C/Z', () => {
    const st = getSurfaceType('C/Z');
    expect(st).toBeDefined();
    expect(st?.description).toContain('Cylinder');
  });
  it('handles macrobodies like RPP', () => {
    expect(getSurfaceType('RPP')).toBeDefined();
    expect(getSurfaceType('RCC')).toBeDefined();
  });
  it('has all expected surface types', () => {
    const expected = [
      'P', 'PX', 'PY', 'PZ',
      'X', 'Y', 'Z',
      'SO', 'S', 'SX', 'SY', 'SZ',
      'C/X', 'C/Y', 'C/Z', 'CX', 'CY', 'CZ',
      'K/X', 'K/Y', 'K/Z', 'KX', 'KY', 'KZ',
      'SQ', 'GQ',
      'TX', 'TY', 'TZ',
      'RPP', 'BOX', 'SPH', 'RCC', 'RHP', 'HEX', 'REC', 'TRC', 'ELL', 'WED', 'ARB',
    ];
    for (const m of expected) {
      expect(getSurfaceType(m), `Surface type ${m} should exist`).toBeDefined();
    }
  });
  it('recognizes HEX as a surface type', () => {
    const hex = getSurfaceType('HEX');
    expect(hex).toBeDefined();
    expect(hex!.description).toContain('hexagonal prism');
  });
  it('recognizes point-defined surface types X, Y, Z', () => {
    for (const m of ['X', 'Y', 'Z']) {
      const st = getSurfaceType(m);
      expect(st).toBeDefined();
      expect(st!.description).toContain('point');
    }
  });
  it('returns correct param counts for known surfaces', () => {
    expect(getSurfaceType('P')?.paramNames).toEqual(['A', 'B', 'C', 'D']);
    expect(getSurfaceType('GQ')?.paramNames).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K']);
    expect(getSurfaceType('RPP')?.paramNames).toEqual(['xmin', 'xmax', 'ymin', 'ymax', 'zmin', 'zmax']);
  });
});
