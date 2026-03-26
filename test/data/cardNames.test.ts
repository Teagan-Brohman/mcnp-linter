import { describe, it, expect } from 'vitest';
import { KNOWN_DATA_CARDS, extractCardBaseName } from '../../server/src/data/cardNames';

describe('KNOWN_DATA_CARDS', () => {
  it('contains common card names', () => {
    for (const name of ['MODE', 'NPS', 'SDEF', 'KCODE', 'M', 'MT', 'F', 'TR', 'PHYS', 'CUT', 'IMP']) {
      expect(KNOWN_DATA_CARDS.has(name), `expected ${name} in set`).toBe(true);
    }
  });

  it('does not contain numbered variants', () => {
    expect(KNOWN_DATA_CARDS.has('M1')).toBe(false);
    expect(KNOWN_DATA_CARDS.has('F5')).toBe(false);
    expect(KNOWN_DATA_CARDS.has('TR3')).toBe(false);
  });
});

describe('extractCardBaseName', () => {
  it('extracts simple card names', () => {
    expect(extractCardBaseName('SDEF ERG=1.0')).toBe('SDEF');
    expect(extractCardBaseName('MODE N P')).toBe('MODE');
    expect(extractCardBaseName('NPS 1000')).toBe('NPS');
  });

  it('strips number suffixes', () => {
    expect(extractCardBaseName('M1  13027.80c 1.0')).toBe('M');
    expect(extractCardBaseName('MT1  lwtr.20t')).toBe('MT');
    expect(extractCardBaseName('F5:N  0 0 0 1')).toBe('F');
    expect(extractCardBaseName('TR5  0 0 0')).toBe('TR');
    expect(extractCardBaseName('FM104 -1 1 -6 -8')).toBe('FM');
  });

  it('strips * and + prefixes', () => {
    expect(extractCardBaseName('*TR5  0 0 0')).toBe('TR');
    expect(extractCardBaseName('*F5:N  0 0 0 1')).toBe('F');
    expect(extractCardBaseName('+F6:N  1')).toBe('F');
    expect(extractCardBaseName('*FILL  1')).toBe('FILL');
  });

  it('strips particle designator suffix', () => {
    expect(extractCardBaseName('PHYS:N  100 0')).toBe('PHYS');
    expect(extractCardBaseName('CUT:N  1e30')).toBe('CUT');
    expect(extractCardBaseName('IMP:N,P  1')).toBe('IMP');
  });

  it('returns undefined for blank lines', () => {
    expect(extractCardBaseName('')).toBeUndefined();
    expect(extractCardBaseName('   ')).toBeUndefined();
  });

  it('strips * prefix from TRCL', () => {
    expect(extractCardBaseName('*TRCL  1 0 0')).toBe('TRCL');
  });

  it('handles purely numeric first token', () => {
    // A line starting with only digits — digits stripped leaves empty, so returns the digits
    expect(extractCardBaseName('12345 some data')).toBe('12345');
  });

  it('handles cards with no suffix or prefix', () => {
    expect(extractCardBaseName('KCODE 1000 1.0 10 100')).toBe('KCODE');
    expect(extractCardBaseName('KSRC 0 0 0')).toBe('KSRC');
    expect(extractCardBaseName('PRINT')).toBe('PRINT');
  });
});
