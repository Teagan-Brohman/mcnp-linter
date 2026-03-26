import { describe, it, expect } from 'vitest';
import { getCellHover } from '../../server/src/hover/cellHover';
import { parseInputFile } from '../../server/src/parser/inputFile';

describe('getCellHover', () => {
  it('shows real-world cell info', () => {
    const doc = parseInputFile(`simple
1  1 -2.7  -1  IMP:N=1
2  0        1  IMP:N=0

1  SO 5

M1 13027.80c 1.0
`);
    const hover = getCellHover(doc, 1);
    expect(hover).toContain('Cell 1');
    expect(hover).toContain('U=0');
    expect(hover).toContain('real world');
  });

  it('shows universe assignment and nesting chain', () => {
    const doc = parseInputFile(`nested
1  0  -1  FILL=1 IMP:N=1
2  0  -2  U=1 FILL=2 LAT=1 IMP:N=1
3  0  -3  U=2 IMP:N=1
4  0   1  IMP:N=0

1  SO 10
2  SO 5
3  SO 2

NPS 100
`);
    const hover = getCellHover(doc, 3);
    expect(hover).toContain('Cell 3');
    expect(hover).toContain('U=2');
    // Should show the chain
    expect(hover).toContain('Cell 1');
    expect(hover).toContain('FILL=1');
    expect(hover).toContain('Cell 2');
    expect(hover).toContain('LAT=1');
    expect(hover).toContain('FILL=2');
  });

  it('shows tally path for nested cell', () => {
    const doc = parseInputFile(`tally path
1  0  -1  FILL=1 IMP:N=1
2  0  -2  U=1 FILL=2 LAT=1 IMP:N=1
3  0  -3  U=2 IMP:N=1
4  0   1  IMP:N=0

1  SO 10
2  SO 5
3  SO 2

NPS 100
`);
    const hover = getCellHover(doc, 3);
    // Should show both tally path forms
    expect(hover).toContain('3<2[i j k]<1');
    expect(hover).toContain('specific element');
    expect(hover).toContain('3<2<1');
    expect(hover).toContain('all instances');
  });

  it('shows FILL info for a cell that fills', () => {
    const doc = parseInputFile(`fill cell
1  0  -1  FILL=1 IMP:N=1
2  0  -2  U=1 IMP:N=1
3  0   1  IMP:N=0

1  SO 10
2  SO 5

NPS 100
`);
    const hover = getCellHover(doc, 1);
    expect(hover).toContain('FILL=1');
  });

  it('shows lattice type', () => {
    const doc = parseInputFile(`lattice
1  0  -1  FILL=1 IMP:N=1
2  0  -2  U=1 FILL=2 LAT=1 IMP:N=1
3  0  -3  U=2 IMP:N=1
4  0   1  IMP:N=0

1  SO 10
2  SO 5
3  SO 2

NPS 100
`);
    const hover = getCellHover(doc, 2);
    expect(hover).toContain('LAT=1');
    expect(hover).toContain('hexahedral');
  });

  it('returns undefined for unknown cell', () => {
    const doc = parseInputFile(`simple
1  0  -1  IMP:N=1

1  SO 5

NPS 100
`);
    expect(getCellHover(doc, 999)).toBeUndefined();
  });
});
