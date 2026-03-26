import { describe, it, expect } from 'vitest';
import { parseInputFile } from '../../server/src/parser/inputFile';
import { validateCrossReferences } from '../../server/src/analysis/crossReference';
import { UniverseMap } from '../../server/src/analysis/universeMap';
import { getHover } from '../../server/src/hover/hoverProvider';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('integration: validation-test.i', () => {
  const text = readFileSync(join(__dirname, '../fixtures/validation-test.i'), 'utf-8');
  const doc = parseInputFile(text);
  const errors = validateCrossReferences(doc);

  it('parses all cells', () => {
    expect(doc.cells).toHaveLength(5);
  });

  it('parses all surfaces', () => {
    expect(doc.surfaces).toHaveLength(4);
  });

  it('parses materials including M0', () => {
    expect(doc.materials.length).toBeGreaterThanOrEqual(2);
  });

  it('flags undefined material 5', () => {
    const err = errors.find(e => e.message.includes('Material 5'));
    expect(err).toBeDefined();
  });

  it('flags undefined surface 99', () => {
    const err = errors.find(e => e.message.includes('Surface 99'));
    expect(err).toBeDefined();
  });

  it('flags undefined surface 100', () => {
    const err = errors.find(e => e.message.includes('Surface 100'));
    expect(err).toBeDefined();
  });

  it('does not flag valid references', () => {
    const falsePositives = errors.filter(e =>
      /\bSurface 1\b/.test(e.message) ||
      /\bSurface 2\b/.test(e.message) ||
      /\bSurface 3\b/.test(e.message) ||
      /\bSurface 4\b/.test(e.message) ||
      /\bMaterial 1\b/.test(e.message) ||
      /\bMaterial 2\b/.test(e.message)
    );
    expect(falsePositives).toHaveLength(0);
  });
});

describe('universe/lattice integration', () => {
  const universeText = readFileSync(join(__dirname, '../fixtures/universe-lattice.i'), 'utf-8');
  const universeDoc = parseInputFile(universeText);
  const um = new UniverseMap(universeDoc);

  it('parses all cells with correct universe assignments', () => {
    expect(universeDoc.cells).toHaveLength(5);
    expect(um.getCellUniverse(1)).toBe(0);
    expect(um.getCellUniverse(2)).toBe(1);
    expect(um.getCellUniverse(3)).toBe(2);
    expect(um.getCellUniverse(4)).toBe(2);
    expect(um.getCellUniverse(5)).toBe(0);
  });

  it('tracks FILL and LAT correctly', () => {
    expect(um.getCellFill(1)).toBe(1);
    expect(um.getCellFill(2)).toBe(2);
    expect(um.getCellLat(2)).toBe(1);
  });

  it('builds correct nesting chain for fuel cell', () => {
    const chain = um.getNestingChain(3);
    expect(chain).toHaveLength(3);
    expect(chain[0]).toMatchObject({ cellId: 3, universe: 2 });
    expect(chain[1]).toMatchObject({ cellId: 2, universe: 1, fill: 2, lat: 1 });
    expect(chain[2]).toMatchObject({ cellId: 1, universe: 0, fill: 1 });
  });

  it('produces no cross-reference errors for valid universe structure', () => {
    const diags = validateCrossReferences(universeDoc);
    const universeErrors = diags.filter(d => d.message.includes('Universe') || d.message.includes('LAT'));
    expect(universeErrors).toHaveLength(0);
  });

  it('hover on fuel cell shows nesting chain and tally path', () => {
    const hover = getHover(universeDoc, { line: 8, character: 0 }, universeText);
    expect(hover).toBeDefined();
    expect(hover).toContain('Cell 3');
    expect(hover).toContain('U=2');
    expect(hover).toContain('3<2');
  });
});

describe('array FILL lattice integration', () => {
  const content = readFileSync(join(__dirname, '../fixtures/array-fill-lattice.i'), 'utf-8');
  const doc = parseInputFile(content);
  const errors = validateCrossReferences(doc);

  it('validates array FILL lattice with no errors', () => {
    // All 4 fill universes (10,20,30,40) are defined, count is correct (2×2×1=4)
    const fillErrors = errors.filter(e => e.message.includes('FILL') || e.message.includes('array'));
    expect(fillErrors).toHaveLength(0);
  });

  it('parses data-card U assignments in full input', () => {
    const doc2 = parseInputFile(`data card test
1  0  -1  FILL=1 IMP:N=1
2  0  -2  IMP:N=1
3  0  -3  IMP:N=1
4  0   1  IMP:N=0

1  SO 10
2  SO 5
3  SO 3

U 0 1 1 0
`);
    const errors2 = validateCrossReferences(doc2);
    // Cells 2 and 3 assigned to U=1 via data card, cell 1 has FILL=1 — valid setup
    const uErrors = errors2.filter(e => e.message.includes('Universe'));
    expect(uErrors).toHaveLength(0);
  });
});

describe('elemental ZAID diagnostics', () => {
  it('check 63: elemental ZAID info hints for multi-element material', () => {
    const input = `integration test
1  1  -7.87  -1  IMP:N=1
2  0          1  IMP:N=0

1  SO  5.0

M1  26000 -0.70  6000 -0.005
     28000 -0.10   24000 -0.19
     25000 -0.005
SDEF ERG=1.0
NPS 1000
`;
    const doc = parseInputFile(input);
    const errors = validateCrossReferences(doc);
    const check63 = errors.filter(e => e.checkNumber === 63);
    // Fe, C, Ni, Cr, Mn are all elements with natural abundances
    expect(check63.length).toBe(5);
    expect(check63.every(e => e.severity === 'info')).toBe(true);
  });
});

describe('thermal card integration', () => {
  const thermalText = readFileSync(join(__dirname, '../fixtures/thermal-test.i'), 'utf-8');
  const thermalDoc = parseInputFile(thermalText);
  const errors = validateCrossReferences(thermalDoc);

  it('parses thermal cards', () => {
    expect(thermalDoc.thermalCards).toHaveLength(2);
    expect(thermalDoc.thermalCards[0].id).toBe(1);
    expect(thermalDoc.thermalCards[1].id).toBe(5);
  });

  it('MT1 has lwtr.10t table', () => {
    const mt1 = thermalDoc.thermalCards[0];
    expect(mt1.tables).toHaveLength(1);
    expect(mt1.tables[0].identifier).toBe('lwtr');
    expect(mt1.tables[0].suffix).toBe('10t');
  });

  it('flags MT5 without matching M5', () => {
    const mtError = errors.find(e => e.message.includes('MT5'));
    expect(mtError).toBeDefined();
    expect(mtError!.severity).toBe('error');
  });

  it('does not flag MT1 (M1 exists)', () => {
    const mt1Error = errors.find(e => e.message.includes('MT1') && e.message.includes('not defined'));
    expect(mt1Error).toBeUndefined();
  });

  it('warns about mixed libraries in M2', () => {
    const libWarn = errors.find(e => e.message.includes('M2') && e.message.includes('mixes'));
    expect(libWarn).toBeDefined();
    expect(libWarn!.severity).toBe('warning');
  });

  it('hover on lwtr.10t shows thermal info', () => {
    const lines = thermalText.split('\n');
    // Find the MT1 line
    const mtLineIdx = lines.findIndex(l => /^MT1\s/i.test(l.trim()));
    expect(mtLineIdx).toBeGreaterThan(0);
    const mtLine = lines[mtLineIdx];
    const tableCol = mtLine.indexOf('lwtr.10t');
    const hover = getHover(thermalDoc, { line: mtLineIdx, character: tableCol }, thermalText);
    expect(hover).toBeDefined();
    expect(hover).toContain('lwtr.10t');
    expect(hover).toContain('Light water');
    expect(hover).toContain('M1');
  });
});
