import { describe, it, expect } from 'vitest';
import { SURFACE_TALLY_TYPES, CELL_TALLY_TYPES, POINT_DETECTOR_TALLY, FISSION_ENERGY_TALLY } from '../../server/src/data/tallyTypes';

describe('tallyTypes', () => {
  it('SURFACE_TALLY_TYPES contains 1 and 2', () => {
    expect(SURFACE_TALLY_TYPES.has(1)).toBe(true);
    expect(SURFACE_TALLY_TYPES.has(2)).toBe(true);
  });
  it('CELL_TALLY_TYPES contains 4, 6, 7, 8', () => {
    expect(CELL_TALLY_TYPES.has(4)).toBe(true);
    expect(CELL_TALLY_TYPES.has(6)).toBe(true);
    expect(CELL_TALLY_TYPES.has(7)).toBe(true);
    expect(CELL_TALLY_TYPES.has(8)).toBe(true);
  });
  it('POINT_DETECTOR_TALLY equals 5', () => {
    expect(POINT_DETECTOR_TALLY).toBe(5);
  });
  it('FISSION_ENERGY_TALLY equals 7', () => {
    expect(FISSION_ENERGY_TALLY).toBe(7);
  });
  it('no overlap between SURFACE_TALLY_TYPES and CELL_TALLY_TYPES', () => {
    for (const t of SURFACE_TALLY_TYPES) {
      expect(CELL_TALLY_TYPES.has(t), `type ${t} should not be in both sets`).toBe(false);
    }
  });
  it('neither set contains POINT_DETECTOR_TALLY', () => {
    expect(SURFACE_TALLY_TYPES.has(POINT_DETECTOR_TALLY)).toBe(false);
    expect(CELL_TALLY_TYPES.has(POINT_DETECTOR_TALLY)).toBe(false);
  });
});
