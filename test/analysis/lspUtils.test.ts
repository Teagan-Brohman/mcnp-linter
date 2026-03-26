import { describe, it, expect } from 'vitest';
import { getTokenAtPosition, getTokenRange, resolveCellAtLine, extractCardName, getMaterialIdAtPosition, getEntityAtPosition, findModifierTokenPositions } from '../../server/src/analysis/lspUtils';
import { TallyModifierCard } from '../../server/src/types';
import { splitLines } from '../../server/src/utils/text';
import { parseInputFile } from '../../server/src/parser/inputFile';
import { DocumentIndex } from '../../server/src/analysis/documentIndex';

describe('getTokenAtPosition', () => {
  it('returns token when cursor is at start of token', () => {
    expect(getTokenAtPosition('1  1  -7.86  -1', 0)).toBe('1');
  });

  it('returns token when cursor is in the middle of a token', () => {
    expect(getTokenAtPosition('1  1  -7.86  -1', 7)).toBe('-7.86');
  });

  it('returns token when cursor is at the last character of a token', () => {
    expect(getTokenAtPosition('M1   26000.80c', 13)).toBe('26000.80c');
  });

  it('returns undefined when cursor is on whitespace', () => {
    expect(getTokenAtPosition('1  SO  5.0', 2)).toBeUndefined();
  });

  it('returns undefined when cursor is past line end', () => {
    expect(getTokenAtPosition('SO', 5)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getTokenAtPosition('', 0)).toBeUndefined();
  });

  it('extracts negated surface refs like -1', () => {
    expect(getTokenAtPosition('1  0  -1 2', 6)).toBe('-1');
  });

  it('handles single-character lines', () => {
    expect(getTokenAtPosition('x', 0)).toBe('x');
  });
});

describe('getTokenRange', () => {
  it('returns range of first token', () => {
    expect(getTokenRange('10 1 -7.86 -1', 0)).toEqual({ start: 0, end: 2 });
  });

  it('returns range of second token', () => {
    expect(getTokenRange('10 1 -7.86 -1', 1)).toEqual({ start: 3, end: 4 });
  });

  it('returns range of third token', () => {
    expect(getTokenRange('10 1 -7.86 -1', 2)).toEqual({ start: 5, end: 10 });
  });

  it('returns undefined when token index out of bounds', () => {
    expect(getTokenRange('a b', 5)).toBeUndefined();
  });

  it('handles leading whitespace correctly', () => {
    const r = getTokenRange('  token1 token2', 0);
    expect(r).toBeDefined();
    expect(r!.end - r!.start).toBe(6);
  });
});

describe('resolveCellAtLine', () => {
  const input = [
    'c test',
    '1 0 -1',
    '2 0 1',
    '',
    '1 SO 5.0',
    '',
    '',
  ].join('\n');

  it('returns cell at startLine using idx', () => {
    const doc = parseInputFile(input);
    const idx = new DocumentIndex(doc);
    const cell = resolveCellAtLine(idx, doc, 1);
    expect(cell?.id).toBe(1);
  });

  it('falls back to linear scan when idx is undefined', () => {
    const doc = parseInputFile(input);
    const cell = resolveCellAtLine(undefined, doc, 2);
    expect(cell?.id).toBe(2);
  });

  it('returns undefined for line not in any cell', () => {
    const doc = parseInputFile(input);
    const idx = new DocumentIndex(doc);
    expect(resolveCellAtLine(idx, doc, 5)).toBeUndefined();
  });
});

describe('extractCardName', () => {
  it('extracts inline $ comment', () => {
    const lines = ['M1  1001.80c 1.0  $ Water hydrogen'];
    expect(extractCardName(0, 0, lines)).toBe('Water hydrogen');
  });

  it('extracts c comment above', () => {
    const lines = ['c Fuel material', 'M1  92235.80c 1.0'];
    expect(extractCardName(1, 1, lines)).toBe('Fuel material');
  });

  it('skips separator lines', () => {
    const lines = ['c Fuel', 'c --------', 'M1  92235.80c 1.0'];
    expect(extractCardName(2, 2, lines)).toBe('Fuel');
  });

  it('returns undefined when no comment', () => {
    const lines = ['M1  92235.80c 1.0'];
    expect(extractCardName(0, 0, lines)).toBeUndefined();
  });
});

describe('splitLines', () => {
  it('splits on newlines', () => {
    expect(splitLines('a\nb\nc')).toEqual(['a', 'b', 'c']);
  });

  it('normalizes \\r\\n', () => {
    expect(splitLines('a\r\nb')).toEqual(['a', 'b']);
  });
});

describe('getMaterialIdAtPosition', () => {
  it('returns material ID when cursor is on second token', () => {
    expect(getMaterialIdAtPosition('1 5 -7.86 -1', 2)).toBe(5);
  });

  it('returns undefined when cursor is on first token', () => {
    expect(getMaterialIdAtPosition('1 5 -7.86 -1', 0)).toBeUndefined();
  });

  it('returns undefined for void cell (material 0)', () => {
    expect(getMaterialIdAtPosition('1 0 -1', 2)).toBeUndefined();
  });
});

describe('getEntityAtPosition', () => {
  const input = `entity test
1  1  -2.7  -1 2  IMP:N=1
2  0        #1    IMP:N=0

1  SO  5.0
2  PX  10.0

M1  13027.80c  1.0
MT1  al27.12t
`;
  const doc = parseInputFile(input);
  const idx = new DocumentIndex(doc);

  it('identifies cell number on cell start line', () => {
    const entity = getEntityAtPosition(doc, { line: 1, character: 0 }, input, idx);
    expect(entity).toBeDefined();
    expect(entity!.type).toBe('cell');
    expect(entity!.id).toBe(1);
  });

  it('identifies material ref on cell start line', () => {
    const lines = input.split('\n');
    const line1 = lines[1];
    const firstSpace = line1.indexOf(' ');
    let matCol = firstSpace;
    while (line1[matCol] === ' ') matCol++;
    const entity = getEntityAtPosition(doc, { line: 1, character: matCol }, input, idx);
    expect(entity).toBeDefined();
    expect(entity!.type).toBe('material');
    expect(entity!.id).toBe(1);
  });

  it('identifies surface ref in geometry', () => {
    const lines = input.split('\n');
    const line1 = lines[1];
    const col = line1.indexOf('-1');
    const entity = getEntityAtPosition(doc, { line: 1, character: col }, input, idx);
    expect(entity).toBeDefined();
    expect(entity!.type).toBe('surface');
    expect(entity!.id).toBe(1);
  });

  it('identifies #N cell complement ref', () => {
    const lines = input.split('\n');
    const line2 = lines[2];
    const col = line2.indexOf('#1');
    const entity = getEntityAtPosition(doc, { line: 2, character: col }, input, idx);
    expect(entity).toBeDefined();
    expect(entity!.type).toBe('cell');
    expect(entity!.id).toBe(1);
  });

  it('identifies surface definition', () => {
    const entity = getEntityAtPosition(doc, { line: 4, character: 0 }, input, idx);
    expect(entity).toBeDefined();
    expect(entity!.type).toBe('surface');
    expect(entity!.id).toBe(1);
  });

  it('identifies material definition', () => {
    const lines = input.split('\n');
    const matLineIdx = lines.findIndex(l => l.startsWith('M1'));
    const col = lines[matLineIdx].indexOf('M1');
    const entity = getEntityAtPosition(doc, { line: matLineIdx, character: col }, input, idx);
    expect(entity).toBeDefined();
    expect(entity!.type).toBe('material');
    expect(entity!.id).toBe(1);
  });

  it('returns undefined for whitespace', () => {
    const entity = getEntityAtPosition(doc, { line: 3, character: 0 }, input, idx);
    expect(entity).toBeUndefined();
  });

  it('identifies standalone # as cell complement', () => {
    // "# N" where # and N are separate tokens — cursor on the #
    const text = `standalone hash test
1  0  -1  IMP:N=1
2  0  # 1  IMP:N=0

1  SO  5.0

NPS 1
`;
    const d = parseInputFile(text);
    const ix = new DocumentIndex(d);
    const lines = text.split('\n');
    const line2 = lines[2];
    const hashCol = line2.indexOf('#');
    const entity = getEntityAtPosition(d, { line: 2, character: hashCol }, text, ix);
    expect(entity).toBeDefined();
    expect(entity!.type).toBe('cell');
    expect(entity!.id).toBe(1);
  });
});

describe('findModifierTokenPositions', () => {
  function makeMod(startLine: number, startCol: number, endLine: number, endCol: number): TallyModifierCard {
    return {
      cardType: 'CF',
      tallyNumber: 4,
      values: [],
      range: { startLine, startCol, endLine, endCol },
    } as TallyModifierCard;
  }

  it('finds a single match at the correct column', () => {
    const line = 'CF4 1 2 3';
    const mod = makeMod(0, 0, 0, line.length);
    const results = findModifierTokenPositions(mod, '2', [line]);
    expect(results).toEqual([{ startLine: 0, startCol: 6, endLine: 0, endCol: 7 }]);
  });

  it('finds multiple matches', () => {
    const line = 'CF4 1 2 1 3';
    const mod = makeMod(0, 0, 0, line.length);
    const results = findModifierTokenPositions(mod, '1', [line]);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ startLine: 0, startCol: 4, endLine: 0, endCol: 5 });
    expect(results[1]).toEqual({ startLine: 0, startCol: 8, endLine: 0, endCol: 9 });
  });

  it('returns empty array when target not found', () => {
    const line = 'CF4 1 2 3';
    const mod = makeMod(0, 0, 0, line.length);
    const results = findModifierTokenPositions(mod, '5', [line]);
    expect(results).toEqual([]);
  });

  it('skips the first token (card keyword)', () => {
    const line = 'CF4 4';
    const mod = makeMod(0, 0, 0, line.length);
    const results = findModifierTokenPositions(mod, 'CF4', [line]);
    expect(results).toEqual([]);
  });

  it('finds target on continuation line in multi-line card', () => {
    const lines = ['CF4 1 2', '     3 4'];
    const mod = makeMod(0, 0, 1, lines[1].length);
    const results = findModifierTokenPositions(mod, '3', lines);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ startLine: 1, startCol: 5, endLine: 1, endCol: 6 });
  });

  it('finds target at end of line', () => {
    const line = 'CF4 1 2';
    const mod = makeMod(0, 0, 0, line.length);
    const results = findModifierTokenPositions(mod, '2', [line]);
    expect(results).toEqual([{ startLine: 0, startCol: 6, endLine: 0, endCol: 7 }]);
  });

  it('does not match partial tokens', () => {
    const line = 'CF4 12 2';
    const mod = makeMod(0, 0, 0, line.length);
    const results = findModifierTokenPositions(mod, '1', [line]);
    expect(results).toEqual([]);
  });

  it('returns empty array for card with no values', () => {
    const line = 'CF4';
    const mod = makeMod(0, 0, 0, line.length);
    const results = findModifierTokenPositions(mod, '1', [line]);
    expect(results).toEqual([]);
  });
});
