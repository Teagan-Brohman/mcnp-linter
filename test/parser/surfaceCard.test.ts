import { describe, it, expect } from 'vitest';
import { parseSurfaceCard } from '../../server/src/parser/surfaceCard';
import { LogicalLine } from '../../server/src/parser/tokenizer';

function makeLine(text: string): LogicalLine {
  return { text, startLine: 0, endLine: 0, originalLines: [text] };
}

describe('parseSurfaceCard', () => {
  it('parses simple plane: 1 PY 3', () => {
    const s = parseSurfaceCard(makeLine('1  PY  3'));
    expect(s.id).toBe(1);
    expect(s.type).toBe('PY');
    expect(s.parameters).toEqual([3]);
    expect(s.modifier).toBeUndefined();
    expect(s.transform).toBeUndefined();
  });

  it('parses sphere: 10 SO 5.0', () => {
    const s = parseSurfaceCard(makeLine('10  SO  5.0'));
    expect(s.id).toBe(10);
    expect(s.type).toBe('SO');
    expect(s.parameters).toEqual([5.0]);
  });

  it('parses general sphere: 2 S 1.0 2.0 3.0 4.0', () => {
    const s = parseSurfaceCard(makeLine('2  S  1.0 2.0 3.0 4.0'));
    expect(s.type).toBe('S');
    expect(s.parameters).toEqual([1.0, 2.0, 3.0, 4.0]);
  });

  it('parses reflecting surface: *3 PX 10', () => {
    const s = parseSurfaceCard(makeLine('*3  PX  10'));
    expect(s.id).toBe(3);
    expect(s.modifier).toBe('*');
    expect(s.type).toBe('PX');
  });

  it('parses white boundary: +5 PZ 0', () => {
    const s = parseSurfaceCard(makeLine('+5  PZ  0'));
    expect(s.id).toBe(5);
    expect(s.modifier).toBe('+');
  });

  it('parses with transformation number: 11 7 CX 1', () => {
    const s = parseSurfaceCard(makeLine('11  7  CX  1'));
    expect(s.id).toBe(11);
    expect(s.transform).toBe(7);
    expect(s.type).toBe('CX');
    expect(s.parameters).toEqual([1]);
  });

  it('parses cone: 3 K/Y 0 0 2 0.25 1', () => {
    const s = parseSurfaceCard(makeLine('3  K/Y  0 0 2 0.25 1'));
    expect(s.type).toBe('K/Y');
    expect(s.parameters).toEqual([0, 0, 2, 0.25, 1]);
  });

  it('parses macrobody RPP', () => {
    const s = parseSurfaceCard(makeLine('20  RPP  -5 5 -5 5 -5 5'));
    expect(s.type).toBe('RPP');
    expect(s.parameters).toEqual([-5, 5, -5, 5, -5, 5]);
  });

  it('parses GQ with many parameters', () => {
    const s = parseSurfaceCard(makeLine('11  GQ  1 0.25 0.75 0 -0.866 0 -12 -2 3.464 39'));
    expect(s.type).toBe('GQ');
    expect(s.parameters).toHaveLength(10);
  });

  it('handles Fortran-style scientific notation like 1.0E-3', () => {
    const s = parseSurfaceCard(makeLine('5  S  0.0 0.0 0.0 1.0E-3'));
    expect(s.parameters[3]).toBeCloseTo(0.001);
  });
});
