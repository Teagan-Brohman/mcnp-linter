import { describe, it, expect } from 'vitest';
import { parseCellCard } from '../../server/src/parser/cellCard';
import { LogicalLine } from '../../server/src/parser/tokenizer';

function makeLine(text: string, startLine = 0): LogicalLine {
  return { text, startLine, endLine: startLine, originalLines: [text] };
}

describe('parseCellCard', () => {
  it('parses void cell: 1 0 -1 2 -3', () => {
    const c = parseCellCard(makeLine('1  0  -1 2 -3'));
    expect(c.id).toBe(1);
    expect(c.materialId).toBe(0);
    expect(c.density).toBeUndefined();
    expect(c.geometry.surfaceRefs).toHaveLength(3);
    expect(c.geometry.surfaceRefs[0]).toMatchObject({ id: 1, sense: '-' });
    expect(c.geometry.surfaceRefs[1]).toMatchObject({ id: 2, sense: '+' });
    expect(c.geometry.surfaceRefs[2]).toMatchObject({ id: 3, sense: '-' });
  });

  it('parses material cell with negative density', () => {
    const c = parseCellCard(makeLine('2  3  -3.7  -1'));
    expect(c.id).toBe(2);
    expect(c.materialId).toBe(3);
    expect(c.density).toBe(-3.7);
    expect(c.geometry.surfaceRefs).toHaveLength(1);
    expect(c.geometry.surfaceRefs[0]).toMatchObject({ id: 1, sense: '-' });
  });

  it('parses material cell with positive density', () => {
    const c = parseCellCard(makeLine('5  1  0.048  -10 20'));
    expect(c.density).toBe(0.048);
    expect(c.geometry.surfaceRefs).toHaveLength(2);
  });

  it('parses cell parameters', () => {
    const c = parseCellCard(makeLine('2  3  -3.7  -1  IMP:N=2 IMP:P=4'));
    expect(c.parameters.get('IMP:N')).toBe('2');
    expect(c.parameters.get('IMP:P')).toBe('4');
  });

  it('parses union operator (colon)', () => {
    const c = parseCellCard(makeLine('5  0  (1 : -2 : 3)'));
    expect(c.geometry.surfaceRefs).toHaveLength(3);
  });

  it('parses complement with cell number: #3', () => {
    const c = parseCellCard(makeLine('5  0  #3'));
    expect(c.geometry.raw).toContain('#3');
    // #3 is a cell complement, not a surface ref
  });

  it('parses complement with surface list: #(-1 2 -3)', () => {
    const c = parseCellCard(makeLine('5  0  #(-1 2 -3)'));
    expect(c.geometry.surfaceRefs.length).toBeGreaterThanOrEqual(3);
  });

  it('parses LIKE n BUT form', () => {
    const c = parseCellCard(makeLine('3  LIKE 2 BUT  IMP:N=10 TRCL=1'));
    expect(c.id).toBe(3);
    expect(c.likeCell).toBe(2);
    expect(c.parameters.get('IMP:N')).toBe('10');
    expect(c.parameters.get('TRCL')).toBe('1');
  });

  it('handles cell with U= and FILL= params', () => {
    const c = parseCellCard(makeLine('10  1  -7.8  -1  U=1 FILL=2 IMP:N=1'));
    expect(c.parameters.get('U')).toBe('1');
    expect(c.parameters.get('FILL')).toBe('2');
    expect(c.geometry.surfaceRefs).toHaveLength(1);
  });

  it('handles large cell and surface numbers', () => {
    const c = parseCellCard(makeLine('99999  0  -100 200'));
    expect(c.id).toBe(99999);
    expect(c.geometry.surfaceRefs).toHaveLength(2);
  });

  it('tracks range for #N cell complement (single token)', () => {
    const line: LogicalLine = {
      text: '5  0  -1 #3 IMP:N=1',
      startLine: 4,
      endLine: 4,
      originalLines: ['5  0  -1 #3 IMP:N=1'],
      originalLineNumbers: [4],
    };
    const cell = parseCellCard(line);
    expect(cell.geometry.cellRefs).toBeDefined();
    expect(cell.geometry.cellRefs!.length).toBe(1);
    const ref = cell.geometry.cellRefs![0];
    expect(ref.id).toBe(3);
    expect(ref.range.startLine).toBe(4);
    expect(ref.range.startCol).toBe(9);
    expect(ref.range.endCol).toBe(11);
  });

  it('tracks range for # N cell complement (two tokens)', () => {
    const line: LogicalLine = {
      text: '5  0  -1 # 3 IMP:N=1',
      startLine: 4,
      endLine: 4,
      originalLines: ['5  0  -1 # 3 IMP:N=1'],
      originalLineNumbers: [4],
    };
    const cell = parseCellCard(line);
    expect(cell.geometry.cellRefs).toBeDefined();
    expect(cell.geometry.cellRefs!.length).toBe(1);
    const ref = cell.geometry.cellRefs![0];
    expect(ref.id).toBe(3);
    expect(ref.range.startLine).toBe(4);
    expect(ref.range.startCol).toBe(11);
    expect(ref.range.endCol).toBe(12);
  });

  it('extracts cell complement references', () => {
    const line = makeLine('3  0  -1 #2  IMP:N=1');
    const cell = parseCellCard(line, 0);
    expect(cell).not.toBeNull();
    expect(cell!.geometry.cellRefs).toBeDefined();
    expect(cell!.geometry.cellRefs!.length).toBe(1);
    expect(cell!.geometry.cellRefs![0].id).toBe(2);
  });
});

describe('array FILL parsing', () => {
  it('parses 1D array FILL', () => {
    const line: LogicalLine = {
      text: '10  0  -1  LAT=1 U=1 FILL=0:2 1 2 3 IMP:N=1',
      startLine: 0, endLine: 0,
      originalLines: ['10  0  -1  LAT=1 U=1 FILL=0:2 1 2 3 IMP:N=1'],
      originalLineNumbers: [0],
    };
    const cell = parseCellCard(line);
    expect(cell.arrayFill).toBeDefined();
    expect(cell.arrayFill!.ranges).toEqual([[0, 2]]);
    expect(cell.arrayFill!.universes).toEqual([1, 2, 3]);
  });

  it('parses 3D array FILL', () => {
    const line: LogicalLine = {
      text: '10  0  -1  LAT=1 U=1 FILL=0:1 0:1 0:0 1 2 3 4 IMP:N=1',
      startLine: 0, endLine: 0,
      originalLines: ['10  0  -1  LAT=1 U=1 FILL=0:1 0:1 0:0 1 2 3 4 IMP:N=1'],
      originalLineNumbers: [0],
    };
    const cell = parseCellCard(line);
    expect(cell.arrayFill).toBeDefined();
    expect(cell.arrayFill!.ranges).toEqual([[0, 1], [0, 1], [0, 0]]);
    expect(cell.arrayFill!.universes).toEqual([1, 2, 3, 4]);
  });

  it('parses array FILL with transform notation u(tr)', () => {
    const line: LogicalLine = {
      text: '10  0  -1  LAT=1 U=1 FILL=0:1 1(1) 2(2) IMP:N=1',
      startLine: 0, endLine: 0,
      originalLines: ['10  0  -1  LAT=1 U=1 FILL=0:1 1(1) 2(2) IMP:N=1'],
      originalLineNumbers: [0],
    };
    const cell = parseCellCard(line);
    expect(cell.arrayFill).toBeDefined();
    expect(cell.arrayFill!.universes).toEqual([1, 2]);
  });

  it('expands nR shorthand in array FILL', () => {
    const line = makeLine('10  0  -1  IMP:N=1 LAT=1 FILL=0:5 1 5R');
    const cell = parseCellCard(line);
    expect(cell.arrayFill).toBeDefined();
    expect(cell.arrayFill!.universes).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('expands nI shorthand in array FILL', () => {
    const line = makeLine('10  0  -1  IMP:N=1 LAT=1 FILL=0:4 1 3I 5');
    const cell = parseCellCard(line);
    expect(cell.arrayFill).toBeDefined();
    expect(cell.arrayFill!.universes).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not set arrayFill for simple FILL=n', () => {
    const line: LogicalLine = {
      text: '10  0  -1  FILL=5 IMP:N=1',
      startLine: 0, endLine: 0,
      originalLines: ['10  0  -1  FILL=5 IMP:N=1'],
      originalLineNumbers: [0],
    };
    const cell = parseCellCard(line);
    expect(cell.arrayFill).toBeUndefined();
    expect(cell.parameters.get('FILL')).toBe('5');
  });
});
