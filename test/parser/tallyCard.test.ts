import { describe, it, expect } from 'vitest';
import { isTallyCard, parseTallyCard } from '../../server/src/parser/dataCard';
import { LogicalLine } from '../../server/src/parser/tokenizer';

function makeLine(text: string, startLine = 0): LogicalLine {
  return { text, startLine, endLine: startLine, originalLines: [text] };
}

describe('isTallyCard', () => {
  it('recognizes basic tally cards', () => {
    expect(isTallyCard('F4:N 1 2 3')).toBe(true);
    expect(isTallyCard('F2:P 1 3 6 T')).toBe(true);
    expect(isTallyCard('F104:N 1')).toBe(true);
    expect(isTallyCard('*F4:N 1')).toBe(true);
    expect(isTallyCard('+F6 2')).toBe(true);
    expect(isTallyCard('F8:E 1')).toBe(true);
    expect(isTallyCard('F5:P 0. 0. 5. 1.')).toBe(true);
  });
  it('rejects non-tally cards', () => {
    expect(isTallyCard('M1 1001.80c 1.0')).toBe(false);
    expect(isTallyCard('FC4 my comment')).toBe(false);
    expect(isTallyCard('FM4 1.0 1 -6')).toBe(false);
    expect(isTallyCard('FILL 1 2 3')).toBe(false);
  });
});

describe('parseTallyCard', () => {
  it('parses simple cell tally', () => {
    const card = parseTallyCard(makeLine('F4:N 1 2 3'));
    expect(card.tallyNumber).toBe(4);
    expect(card.tallyType).toBe(4);
    expect(card.particles).toBe('N');
    expect(card.bins).toHaveLength(3);
    expect(card.bins[0].entries[0].id).toBe(1);
    expect(card.hasTotal).toBe(false);
  });
  it('parses surface tally with total', () => {
    const card = parseTallyCard(makeLine('F2:N 1 3 6 T'));
    expect(card.tallyType).toBe(2);
    expect(card.bins).toHaveLength(3);
    expect(card.hasTotal).toBe(true);
  });
  it('parses tally with parenthesized groups', () => {
    const card = parseTallyCard(makeLine('F1:P (1 2) (3 4 5) 6'));
    expect(card.tallyType).toBe(1);
    expect(card.bins).toHaveLength(3);
    expect(card.bins[0].entries).toHaveLength(2);
    expect(card.bins[1].entries).toHaveLength(3);
    expect(card.bins[2].entries).toHaveLength(1);
  });
  it('parses energy-multiplied tally', () => {
    const card = parseTallyCard(makeLine('*F4:N 1'));
    expect(card.prefix).toBe('*');
    expect(card.tallyType).toBe(4);
  });
  it('parses collision heating tally', () => {
    const card = parseTallyCard(makeLine('+F6 2'));
    expect(card.prefix).toBe('+');
    expect(card.tallyType).toBe(6);
    expect(card.particles).toBe('');
  });
  it('parses multi-digit tally number', () => {
    const card = parseTallyCard(makeLine('F104:N 1'));
    expect(card.tallyNumber).toBe(104);
    expect(card.tallyType).toBe(4);
  });
  it('parses multi-particle tally', () => {
    const card = parseTallyCard(makeLine('F6:N,P 1'));
    expect(card.particles).toBe('N,P');
  });
});

describe('repeated structure tally', () => {
  it('parses single-level RS chain', () => {
    const card = parseTallyCard(makeLine('F4:N (1 2 < 3)'));
    expect(card.chains).toHaveLength(1);
    expect(card.chains![0].levels).toHaveLength(2);
    expect(card.chains![0].levels[0].cells).toEqual([1, 2]);
    expect(card.chains![0].levels[1].cells).toEqual([3]);
  });

  it('parses multi-level RS chain', () => {
    const card = parseTallyCard(makeLine('F4:P (11 < 16 < 17)'));
    expect(card.chains![0].levels).toHaveLength(3);
    expect(card.chains![0].levels[0].cells).toEqual([11]);
    expect(card.chains![0].levels[1].cells).toEqual([16]);
    expect(card.chains![0].levels[2].cells).toEqual([17]);
  });

  it('parses lattice indices with ranges', () => {
    const card = parseTallyCard(makeLine('F4:P (11<16[-10:10 -10:10 -10:10]<17)'));
    expect(card.chains).toHaveLength(1);
    const level1 = card.chains![0].levels[1];
    expect(level1.cells).toContain(16);
    expect(level1.latticeIndices!.dimensions).toEqual([[-10, 10], [-10, 10], [-10, 10]]);
  });

  it('parses single lattice indices', () => {
    const card = parseTallyCard(makeLine('F4:N (1 < 2[0 0 0] < 3)'));
    const level1 = card.chains![0].levels[1];
    expect(level1.latticeIndices!.dimensions).toEqual([[0, 0], [0, 0], [0, 0]]);
  });

  it('parses universe shorthand', () => {
    const card = parseTallyCard(makeLine('F4:N (U=2 < 3)'));
    expect(card.chains![0].levels[0].universeRef).toBe(2);
  });

  it('parses mixed simple + RS bins', () => {
    const card = parseTallyCard(makeLine('F4:N 5 (1<2<3)'));
    expect(card.bins.length).toBeGreaterThanOrEqual(1);
    expect(card.chains).toHaveLength(1);
  });

  it('parses multiple RS groups', () => {
    const card = parseTallyCard(makeLine('F4:N (1<2) (3<4)'));
    expect(card.chains).toHaveLength(2);
  });
});
