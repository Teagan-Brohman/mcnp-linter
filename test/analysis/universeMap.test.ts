import { describe, it, expect } from 'vitest';
import { UniverseMap } from '../../server/src/analysis/universeMap';
import { parseInputFile } from '../../server/src/parser/inputFile';

describe('UniverseMap', () => {
  it('identifies cells in the real world (no U keyword)', () => {
    const doc = parseInputFile(`simple
1  0  -1  IMP:N=1
2  0   1  IMP:N=0

1  SO 5

NPS 100
`);
    const um = new UniverseMap(doc);
    expect(um.getCellUniverse(1)).toBe(0);
    expect(um.getCellUniverse(2)).toBe(0);
    expect(um.getUniverseCells(0)).toEqual(expect.arrayContaining([1, 2]));
  });

  it('identifies cells assigned to a universe', () => {
    const doc = parseInputFile(`universes
1  0  -1  FILL=1 IMP:N=1
2  0  -2  U=1 IMP:N=1
3  0   2  U=1 IMP:N=1
4  0   1  IMP:N=0

1  SO 10
2  SO 5

NPS 100
`);
    const um = new UniverseMap(doc);
    expect(um.getCellUniverse(1)).toBe(0);
    expect(um.getCellUniverse(2)).toBe(1);
    expect(um.getCellUniverse(3)).toBe(1);
    expect(um.getUniverseCells(1)).toEqual(expect.arrayContaining([2, 3]));
  });

  it('tracks FILL relationships', () => {
    const doc = parseInputFile(`fill
1  0  -1  FILL=1 IMP:N=1
2  0  -2  U=1 IMP:N=1
3  0   1  IMP:N=0

1  SO 10
2  SO 5

NPS 100
`);
    const um = new UniverseMap(doc);
    expect(um.getCellFill(1)).toBe(1);
    expect(um.getCellFill(2)).toBeUndefined();
  });

  it('tracks LAT type', () => {
    const doc = parseInputFile(`lattice
1  0  -1  FILL=1 IMP:N=1
2  0  -2  U=1 FILL=2 LAT=1 IMP:N=1
3  1  -1.0  -3  U=2 IMP:N=1
4  0   1  IMP:N=0

1  SO 10
2  SO 5
3  SO 2

M1 1001.80c 1.0
NPS 100
`);
    const um = new UniverseMap(doc);
    expect(um.getCellLat(2)).toBe(1);
    expect(um.getCellLat(1)).toBeUndefined();
  });

  it('handles negative universe (fully enclosed optimization)', () => {
    const doc = parseInputFile(`neg universe
1  0  -1  FILL=1 IMP:N=1
2  0  -2  U=-1 IMP:N=1
3  0   1  IMP:N=0

1  SO 10
2  SO 5

NPS 100
`);
    const um = new UniverseMap(doc);
    // Negative U means same universe but with optimization flag
    expect(um.getCellUniverse(2)).toBe(1);
  });

  it('builds nesting chain from leaf cell to real world', () => {
    const doc = parseInputFile(`chain
1  0  1 -2 -3 4 -5 6  FILL=1 IMP:N=1
2  0  -7 1 -3 8  U=1 FILL=2 LAT=1 IMP:N=1
3  0  -11  U=2 IMP:N=1
4  0   11  U=2 IMP:N=1
5  0  -1:2:3:-4:5:-6  IMP:N=0

1  PX 0
2  PX 10
3  PY 10
4  PY 0
5  PZ 10
6  PZ 0
7  SO 1
8  PX 5
11 SO 0.5

NPS 100
`);
    const um = new UniverseMap(doc);
    const chain = um.getNestingChain(3);
    // Chain should be: cell 3 (U=2) <- cell 2 (FILL=2, U=1, LAT=1) <- cell 1 (FILL=1, U=0)
    expect(chain).toHaveLength(3);
    expect(chain[0].cellId).toBe(3);
    expect(chain[0].universe).toBe(2);
    expect(chain[1].cellId).toBe(2);
    expect(chain[1].fill).toBe(2);
    expect(chain[1].lat).toBe(1);
    expect(chain[2].cellId).toBe(1);
    expect(chain[2].fill).toBe(1);
    expect(chain[2].universe).toBe(0);
  });

  it('detects lattice not alone in universe', () => {
    const doc = parseInputFile(`lattice not alone
1  1  -1.0  -1  U=1 LAT=1 FILL=2  IMP:N=1
2  1  -1.0  -2  U=1  IMP:N=1
3  0  1  IMP:N=0

1  SO  5.0
2  SO  10.0

M1  1001.80c 1.0
`);
    const um = new UniverseMap(doc);
    const violations = um.getLatticeNotAlone();
    expect(violations.length).toBe(1);
    expect(violations[0].cellId).toBe(1);
  });

  it('recognizes *FILL parameter', () => {
    const doc = parseInputFile(`star fill
1  0  -1  IMP:N=1  *FILL=2
2  0  -2  IMP:N=1  U=2

1  SO  5.0
2  SO  3.0
`);
    const um = new UniverseMap(doc);
    expect(um.getCellFill(1)).toBe(2);
    expect(um.getUndefinedFillUniverses()).toHaveLength(0);
  });

  it('returns single-element chain for real-world cell', () => {
    const doc = parseInputFile(`simple
1  0  -1  IMP:N=1
2  0   1  IMP:N=0

1  SO 5

NPS 100
`);
    const um = new UniverseMap(doc);
    const chain = um.getNestingChain(1);
    expect(chain).toHaveLength(1);
    expect(chain[0].cellId).toBe(1);
    expect(chain[0].universe).toBe(0);
  });

  describe('data-card parameter merging', () => {
    it('applies U data card to cells by order', () => {
      const doc = parseInputFile(`u data card
1  0  -1  FILL=1 IMP:N=1
2  0  -2  IMP:N=1
3  0   1  IMP:N=0

1  SO 10
2  SO 5

U 0 1 0
`);
      const um = new UniverseMap(doc);
      expect(um.getCellUniverse(1)).toBe(0);
      expect(um.getCellUniverse(2)).toBe(1);
      expect(um.getCellUniverse(3)).toBe(0);
    });

    it('applies LAT data card to cells by order', () => {
      const doc = parseInputFile(`lat data card
1  0  -1  FILL=1 IMP:N=1
2  0  -2  FILL=3 IMP:N=1
3  0   1  IMP:N=0

1  SO 10
2  SO 5

LAT 0 1 0
U 0 1 0
`);
      const um = new UniverseMap(doc);
      expect(um.getCellLat(1)).toBeUndefined();
      expect(um.getCellLat(2)).toBe(1);
    });

    it('applies FILL data card to cells by order', () => {
      const doc = parseInputFile(`fill data card
1  0  -1  IMP:N=1
2  0  -2  IMP:N=1
3  0   1  IMP:N=0

1  SO 10
2  SO 5

FILL 0 2 0
U 0 1 0
`);
      const um = new UniverseMap(doc);
      expect(um.getCellFill(1)).toBeUndefined();
      expect(um.getCellFill(2)).toBe(2);
    });

    it('cell-card parameter takes precedence over data card', () => {
      const doc = parseInputFile(`precedence
1  0  -1  U=5 IMP:N=1
2  0  -2  IMP:N=1
3  0   1  IMP:N=0

1  SO 10
2  SO 5

U 3 1 0
`);
      const um = new UniverseMap(doc);
      expect(um.getCellUniverse(1)).toBe(5);
      expect(um.getCellUniverse(2)).toBe(1);
    });
  });
});
