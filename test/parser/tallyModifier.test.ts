import { describe, it, expect } from 'vitest';
import { isTallyModifier, parseTallyModifier } from '../../server/src/parser/dataCard';
import { LogicalLine } from '../../server/src/parser/tokenizer';

function makeLine(text: string, startLine = 0): LogicalLine {
  return { text, startLine, endLine: startLine, originalLines: [text] };
}

describe('isTallyModifier', () => {
  it('recognizes energy bin cards', () => {
    expect(isTallyModifier('E4 0.1 1 20')).toBe(true);
    expect(isTallyModifier('E0 0.1 1 20')).toBe(true);
  });
  it('recognizes time bin cards', () => {
    expect(isTallyModifier('T2 -1 1 1.0+37 NT')).toBe(true);
  });
  it('recognizes cosine bin cards', () => {
    expect(isTallyModifier('C1 -0.866 -0.5 0 0.5 0.866 1')).toBe(true);
    expect(isTallyModifier('*C1 150 120 90 60 30 0')).toBe(true);
  });
  it('recognizes tally comment cards', () => {
    expect(isTallyModifier('FC4 neutron flux in cell 1')).toBe(true);
  });
  it('recognizes tally multiplier cards', () => {
    expect(isTallyModifier('FM4 -1 2 -5 -6')).toBe(true);
  });
  it('recognizes other modifier cards', () => {
    expect(isTallyModifier('FQ4 E S M')).toBe(true);
    expect(isTallyModifier('DE5 0.01 0.1 0.2')).toBe(true);
    expect(isTallyModifier('DF5 LIN 0.062 0.533')).toBe(true);
    expect(isTallyModifier('CF4 1 2')).toBe(true);
    expect(isTallyModifier('SF2 1 2')).toBe(true);
    expect(isTallyModifier('FS4 1 2')).toBe(true);
    expect(isTallyModifier('SD4 1')).toBe(true);
    expect(isTallyModifier('FT8 PHL')).toBe(true);
  });
  it('rejects non-modifier cards', () => {
    expect(isTallyModifier('M1 1001.80c 1.0')).toBe(false);
    expect(isTallyModifier('F4:N 1 2 3')).toBe(false);
  });
});

describe('parseTallyModifier', () => {
  it('parses energy bin card', () => {
    const card = parseTallyModifier(makeLine('E4 0.1 1 20'));
    expect(card.cardType).toBe('E');
    expect(card.tallyNumber).toBe(4);
    expect(card.values).toEqual(['0.1', '1', '20']);
  });
  it('parses CF card with cell references', () => {
    const card = parseTallyModifier(makeLine('CF4 1 2 3'));
    expect(card.cardType).toBe('CF');
    expect(card.entityRefs).toEqual([1, 2, 3]);
  });
  it('parses SF card with surface references', () => {
    const card = parseTallyModifier(makeLine('SF2 1 3 5'));
    expect(card.cardType).toBe('SF');
    expect(card.entityRefs).toEqual([1, 3, 5]);
  });
  it('parses FM card with material references', () => {
    const card = parseTallyModifier(makeLine('FM4 -1 2 -5 -6'));
    expect(card.cardType).toBe('FM');
    expect(card.materialRefs).toEqual([2]);
  });
});
