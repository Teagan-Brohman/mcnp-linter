import { describe, it, expect } from 'vitest';
import { parseInputFile } from '../../server/src/parser/inputFile';
import { DocumentIndex } from '../../server/src/analysis/documentIndex';

describe('DocumentIndex', () => {
  const doc = parseInputFile(`index test
1  1  -2.7  -1  IMP:N=1
2  0  1  IMP:N=0

1  SO  5.0
2  SO  10.0

M1  13027.80c 1.0
M2  1001.80c 0.667  8016.80c 0.333
`);
  const idx = new DocumentIndex(doc);

  it('looks up cell by ID', () => {
    expect(idx.getCell(1)).toBeDefined();
    expect(idx.getCell(1)!.id).toBe(1);
    expect(idx.getCell(99)).toBeUndefined();
  });
  it('looks up surface by ID', () => {
    expect(idx.getSurface(1)).toBeDefined();
    expect(idx.getSurface(99)).toBeUndefined();
  });
  it('looks up material by ID', () => {
    expect(idx.getMaterial(1)).toBeDefined();
    expect(idx.getMaterial(99)).toBeUndefined();
  });
  it('provides ID sets', () => {
    expect(idx.cellIds.has(1)).toBe(true);
    expect(idx.cellIds.has(99)).toBe(false);
    expect(idx.surfaceIds.has(2)).toBe(true);
    expect(idx.materialIds.has(2)).toBe(true);
  });
  it('finds block for line number', () => {
    const block = idx.getBlockForLine(1);
    expect(block).toBeDefined();
    expect(block!.type).toBe('cell');
  });

  it('indexes SDEF card lines', () => {
    const doc = parseInputFile(`index test
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF ERG=7.0 PAR=2
NPS 1000
`);
    const idx = new DocumentIndex(doc);
    const block = idx.getBlockForLine(6);
    expect(block).toBeDefined();
    expect(block!.type).toBe('sdef');
  });

  it('indexes MODE card lines', () => {
    const doc = parseInputFile(`index test
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

MODE N P
NPS 1000
`);
    const idx = new DocumentIndex(doc);
    const block = idx.getBlockForLine(6);
    expect(block).toBeDefined();
    expect(block!.type).toBe('mode');
  });

  it('indexes NPS card lines', () => {
    const doc = parseInputFile(`index test
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

NPS 10000
`);
    const idx = new DocumentIndex(doc);
    const block = idx.getBlockForLine(6);
    expect(block).toBeDefined();
    expect(block!.type).toBe('nps');
  });

  it('indexes tally card lines', () => {
    const doc = parseInputFile(`index test
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
F4:N 1
NPS 1000
`);
    const idx = new DocumentIndex(doc);
    const block = idx.getBlockForLine(7);
    expect(block).toBeDefined();
    expect(block!.type).toBe('tally');
  });

  it('indexes KCODE card lines', () => {
    const doc = parseInputFile(`index test
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
KCODE 1000 1.0 10 50
NPS 1000
`);
    const idx = new DocumentIndex(doc);
    const block = idx.getBlockForLine(7);
    expect(block).toBeDefined();
    expect(block!.type).toBe('kcode');
  });

  it('indexes source distribution card lines', () => {
    const doc = parseInputFile(`index test
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF ERG=D1
SI1 H 0 1 2
SP1 0 0.5 0.5
NPS 1000
`);
    const idx = new DocumentIndex(doc);
    const siBlock = idx.getBlockForLine(7);
    expect(siBlock).toBeDefined();
    expect(siBlock!.type).toBe('sourceDist');
    const spBlock = idx.getBlockForLine(8);
    expect(spBlock).toBeDefined();
    expect(spBlock!.type).toBe('sourceDist');
  });
});
