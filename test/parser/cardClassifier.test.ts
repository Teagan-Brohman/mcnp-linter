import { describe, it, expect } from 'vitest';
import { classifyCardLine } from '../../server/src/parser/cardClassifier';

describe('classifyCardLine', () => {
  it('classifies cell cards (with material+density)', () => {
    expect(classifyCardLine('1 1 -2.7 -1 IMP:N=1')).toBe('cell');
  });
  it('classifies void cell', () => {
    expect(classifyCardLine('2 0 1 IMP:N=0')).toBe('cell');
  });
  it('classifies LIKE BUT cell', () => {
    expect(classifyCardLine('45 like 5 but u=9')).toBe('cell');
  });
  it('classifies plain surface', () => {
    expect(classifyCardLine('10 PX 0')).toBe('surface');
  });
  it('classifies surface with TR', () => {
    expect(classifyCardLine('10 1 PX 0')).toBe('surface');
  });
  it('classifies RCC surface', () => {
    expect(classifyCardLine('40 RCC 3.69 3.69 -50 0 0 400 100')).toBe('surface');
  });
  it('classifies material data card', () => {
    expect(classifyCardLine('M1 1001.80c 1')).toBe('data');
  });
  it('classifies tally data card', () => {
    expect(classifyCardLine('F4:N 1')).toBe('data');
  });
  it('classifies starred tally', () => {
    expect(classifyCardLine('*F8:P 1')).toBe('data');
  });
  it('classifies IMP/MODE/NPS', () => {
    expect(classifyCardLine('IMP:N 1 1 0')).toBe('data');
    expect(classifyCardLine('MODE N P')).toBe('data');
    expect(classifyCardLine('NPS 1000')).toBe('data');
  });
  it('returns unknown for a single-token line', () => {
    expect(classifyCardLine('42')).toBe('unknown');
  });
  it('returns unknown for empty input', () => {
    expect(classifyCardLine('')).toBe('unknown');
  });
});
