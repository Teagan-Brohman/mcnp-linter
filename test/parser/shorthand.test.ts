import { describe, it, expect } from 'vitest';
import { expandShorthand } from '../../server/src/parser/shorthand';

describe('expandShorthand', () => {
  it('passes through plain numbers unchanged', () => {
    expect(expandShorthand(['1', '2', '3'])).toEqual([1, 2, 3]);
  });
  it('expands nR (repeat)', () => {
    expect(expandShorthand(['1', '3R'])).toEqual([1, 1, 1, 1]);
  });
  it('expands nI (linear interpolation)', () => {
    expect(expandShorthand(['1', '2I', '4'])).toEqual([1, 2, 3, 4]);
  });
  it('expands nM (log interpolation)', () => {
    const result = expandShorthand(['1', '3M', '16']);
    expect(result).toHaveLength(5);
    [1, 2, 4, 8, 16].forEach((expected, i) => {
      expect(result[i]).toBeCloseTo(expected, 10);
    });
  });
  it('expands nJ (jump/default)', () => {
    expect(expandShorthand(['1', '2J', '4'])).toEqual([1, 0, 0, 4]);
  });
  it('expands 1R shorthand', () => {
    expect(expandShorthand(['5', '1R'])).toEqual([5, 5]);
  });
  it('handles mixed shorthand', () => {
    expect(expandShorthand(['1', '2R', '10', '2I', '40'])).toEqual([1, 1, 1, 10, 20, 30, 40]);
  });
  it('expands lowercase shorthand (e.g. 3r)', () => {
    expect(expandShorthand(['5', '3r'])).toEqual([5, 5, 5, 5]);
  });
  it('handles R at start (no previous value) as error — returns NaN', () => {
    const result = expandShorthand(['3R']);
    expect(result[0]).toBeNaN();
  });
});
