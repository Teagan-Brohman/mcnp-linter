import { describe, it, expect } from 'vitest';
import { getHover } from '../../server/src/hover/hoverProvider';
import { parseInputFile } from '../../server/src/parser/inputFile';

/**
 * Test fixture: a minimal MCNP input with known structure.
 *
 * Line 0: title
 * Line 1: cell 1 — material 1, density -2.7, geometry -1 2
 * Line 2: cell 2 — void, geometry 1
 * Line 3: blank (separator)
 * Line 4: surface 1 SO 5.0
 * Line 5: surface 2 PX 10.0
 * Line 6: blank (separator)
 * Line 7: M1 with ZAID 13027.80c
 */
const inputText = `hover provider test
1  1  -2.7  -1 2  IMP:N=1
2  0         1    IMP:N=0

1  SO  5.0
2  PX  10.0

M1  13027.80c  1.0
`;

const doc = parseInputFile(inputText);

describe('getHover', () => {
  it('returns surface hover when cursor is on a surface ref in cell geometry', () => {
    // Line 1: "1  1  -2.7  -1 2  IMP:N=1"
    // Surface ref "-1" should be in the geometry region
    // Find the column of "-1" in line 1
    const line1 = inputText.split('\n')[1];
    const col = line1.indexOf('-1');
    const hover = getHover(doc, { line: 1, character: col }, inputText);
    expect(hover).toBeDefined();
    expect(hover).toContain('Surface 1');
    expect(hover).toContain('SO');
  });

  it('returns surface hover for unsigned surface ref in geometry', () => {
    // Line 1: "1  1  -2.7  -1 2  IMP:N=1"
    // Surface ref "2" is at a specific column after "-1 "
    const line1 = inputText.split('\n')[1];
    // Find " 2 " — the surface ref 2 after -1
    const dashOneIdx = line1.indexOf('-1');
    const twoIdx = line1.indexOf('2', dashOneIdx + 2);
    const hover = getHover(doc, { line: 1, character: twoIdx }, inputText);
    expect(hover).toBeDefined();
    expect(hover).toContain('Surface 2');
    expect(hover).toContain('PX');
  });

  it('returns material summary when cursor is on material number', () => {
    // Line 1: "1  1  -2.7  -1 2  IMP:N=1"
    // Token "1" (second token) is the material number
    const line1 = inputText.split('\n')[1];
    // Find second token (material ID): it's at index 3 (after "1  ")
    const firstSpace = line1.indexOf(' ');
    let matCol = firstSpace;
    while (line1[matCol] === ' ') matCol++;
    const hover = getHover(doc, { line: 1, character: matCol }, inputText);
    expect(hover).toBeDefined();
    expect(hover).toContain('Material 1');
  });

  it('does NOT return surface hover when cursor is on cell number', () => {
    // Line 1: "1  1  -2.7  -1 2  IMP:N=1"
    // First token "1" is the cell number — should not trigger surface hover
    const hover = getHover(doc, { line: 1, character: 0 }, inputText);
    // Cell number "1" now shows cell hover, not surface hover
    expect(hover).toBeDefined();
    expect(hover).toContain('Cell 1');
    expect(hover).not.toContain('SO');
  });

  it('does NOT return surface hover when cursor is on density', () => {
    // Line 1: "1  1  -2.7  -1 2  IMP:N=1"
    // Token "-2.7" is the density
    const line1 = inputText.split('\n')[1];
    const densityCol = line1.indexOf('-2.7');
    const hover = getHover(doc, { line: 1, character: densityCol }, inputText);
    expect(hover).toBeUndefined();
  });

  it('returns ZAID hover for a ZAID in data block', () => {
    // Line 7: "M1  13027.80c  1.0"
    const lines = inputText.split('\n');
    const dataLine = lines[7];
    const zaidCol = dataLine.indexOf('13027.80c');
    const hover = getHover(doc, { line: 7, character: zaidCol }, inputText);
    expect(hover).toBeDefined();
    expect(hover).toContain('Aluminium');
  });

  it('returns undefined when cursor is on empty space', () => {
    // Line 3 is blank
    const hover = getHover(doc, { line: 3, character: 0 }, inputText);
    expect(hover).toBeUndefined();
  });

  it('returns undefined for position beyond document', () => {
    const hover = getHover(doc, { line: 999, character: 0 }, inputText);
    expect(hover).toBeUndefined();
  });
});

/**
 * Test fixture: material with continuation lines (5-column indent).
 *
 * Line 0: title
 * Line 1: cell
 * Line 2: blank
 * Line 3: surface
 * Line 4: blank
 * Line 5: M1 with first ZAID
 * Line 6: continuation with second ZAID
 * Line 7: NPS card (non-material data card)
 */
const continuationInput = `continuation test
1  0  -1  IMP:N=1

1  SO  5.0

M1  1001.80c -0.11190
     8016.80c -0.88810
NPS 1000
`;

const continuationDoc = parseInputFile(continuationInput);

describe('getHover — continuation lines', () => {
  it('returns ZAID hover for ZAID on first line of material', () => {
    const lines = continuationInput.split('\n');
    const line5 = lines[5];
    const zaidCol = line5.indexOf('1001.80c');
    const hover = getHover(continuationDoc, { line: 5, character: zaidCol }, continuationInput);
    expect(hover).toBeDefined();
    expect(hover).toContain('1001.80c');
    expect(hover).toContain('Hydrogen');
  });

  it('returns ZAID hover for ZAID on continuation line', () => {
    const lines = continuationInput.split('\n');
    const line6 = lines[6];
    const zaidCol = line6.indexOf('8016.80c');
    const hover = getHover(continuationDoc, { line: 6, character: zaidCol }, continuationInput);
    expect(hover).toBeDefined();
    expect(hover).toContain('8016.80c');
    expect(hover).toContain('Oxygen');
  });

  it('returns data card hover for NPS keyword', () => {
    // Line 7 is "NPS 1000" — hovering on "NPS" shows keyword documentation
    const hover = getHover(continuationDoc, { line: 7, character: 0 }, continuationInput);
    expect(hover).toBeDefined();
    expect(hover).toContain('**NPS**');
    expect(hover).toContain('histories');
  });

  it('ZAID entry ranges are distinct per ZAID', () => {
    // Verify that each ZAID has its own unique range, not the full material range
    const mat = continuationDoc.materials[0];
    expect(mat.components.length).toBe(2);
    const [h, o] = mat.components;

    // They should be on different lines
    expect(h.range.startLine).toBe(5);
    expect(o.range.startLine).toBe(6);

    // Each range should span only the ZAID token width
    expect(h.range.endCol - h.range.startCol).toBe('1001.80c'.length);
    expect(o.range.endCol - o.range.startCol).toBe('8016.80c'.length);
  });
});

/**
 * Test fixture: cell card with geometry spanning continuation lines.
 *
 * Line 0: title
 * Line 1: cell 1 — first line of geometry
 * Line 2: continuation — more surface refs
 * Line 3: cell 2 — void
 * Line 4: blank
 * Line 5: surface 1
 * Line 6: surface 2
 * Line 7: surface 3
 * Line 8: blank
 * Line 9: M1
 */
const multiLineCellInput = `multi-line cell test
1  1  -2.7  -1
     2 -3  IMP:N=1
2  0   1:-2:3  IMP:N=0

1  SO  5.0
2  PX  10.0
3  CZ  3.0

M1  13027.80c  1.0
`;

const multiLineCellDoc = parseInputFile(multiLineCellInput);

describe('getHover — surface refs on continuation lines', () => {
  it('returns surface hover for ref on continuation line (5-col indent)', () => {
    // Line 2: "     2 -3  IMP:N=1"
    // Surface ref "2" should trigger hover for surface 2
    const lines = multiLineCellInput.split('\n');
    const line2 = lines[2];
    const col = line2.indexOf('2');
    const hover = getHover(multiLineCellDoc, { line: 2, character: col }, multiLineCellInput);
    expect(hover).toBeDefined();
    expect(hover).toContain('Surface 2');
    expect(hover).toContain('PX');
  });

  it('returns surface hover for negative ref on continuation line', () => {
    // Line 2: "     2 -3  IMP:N=1"
    // Surface ref "-3" should trigger hover for surface 3
    const lines = multiLineCellInput.split('\n');
    const line2 = lines[2];
    const col = line2.indexOf('-3');
    const hover = getHover(multiLineCellDoc, { line: 2, character: col }, multiLineCellInput);
    expect(hover).toBeDefined();
    expect(hover).toContain('Surface 3');
    expect(hover).toContain('CZ');
  });

  it('surface ref ranges point to correct physical lines', () => {
    // Cell 1 has surface refs -1, 2, -3
    // -1 should be on line 1, 2 and -3 should be on line 2
    const cell = multiLineCellDoc.cells[0];
    const refs = cell.geometry.surfaceRefs;
    expect(refs).toHaveLength(3);

    // -1 is on the first line of the cell (line 1)
    expect(refs[0].id).toBe(1);
    expect(refs[0].range.startLine).toBe(1);

    // 2 is on the continuation line (line 2)
    expect(refs[1].id).toBe(2);
    expect(refs[1].range.startLine).toBe(2);

    // -3 is on the continuation line (line 2)
    expect(refs[2].id).toBe(3);
    expect(refs[2].range.startLine).toBe(2);
  });
});

/**
 * Test fixture: universe/lattice nesting.
 */
const universeInput = `universe hover test
1  0  -1  FILL=1 IMP:N=1
2  0  -2  U=1 FILL=2 LAT=1 IMP:N=1
3  1  -1.0  -3  U=2 IMP:N=1
4  0   1  IMP:N=0

1  SO 10
2  SO 5
3  SO 2

M1  1001.80c 1.0
`;

const universeDoc = parseInputFile(universeInput);

describe('getHover — universe/cell hover', () => {
  it('shows cell hover with nesting chain when hovering cell number', () => {
    // Line 3: "3  1  -1.0  -3  U=2 IMP:N=1"
    const hover = getHover(universeDoc, { line: 3, character: 0 }, universeInput);
    expect(hover).toBeDefined();
    expect(hover).toContain('Cell 3');
    expect(hover).toContain('U=2');
    expect(hover).toContain('Nesting chain');
  });

  it('shows cell hover for real-world cell', () => {
    // Line 1: "1  0  -1  FILL=1 IMP:N=1"
    const hover = getHover(universeDoc, { line: 1, character: 0 }, universeInput);
    expect(hover).toBeDefined();
    expect(hover).toContain('Cell 1');
    expect(hover).toContain('real world');
    expect(hover).toContain('FILL=1');
  });
});

describe('getHover — surface block type mnemonic', () => {
  const surfBlockInput = `surface type hover
1  0  -1  IMP:N=1

1  CZ  5.0
2  PZ  10.0
3  RPP  0 10 0 10 0 10
4  SO  3.0

NPS 1
`;
  const surfBlockDoc = parseInputFile(surfBlockInput);

  it('shows usage hover for CZ mnemonic', () => {
    const lines = surfBlockInput.split('\n');
    const line3 = lines[3];
    const czCol = line3.indexOf('CZ');
    const hover = getHover(surfBlockDoc, { line: 3, character: czCol }, surfBlockInput);
    expect(hover).toBeDefined();
    expect(hover).toContain('**CZ**');
    expect(hover).toContain('Cylinder on z axis');
    expect(hover).toContain('Usage:');
    expect(hover).toContain('R');
  });

  it('shows usage hover for RPP mnemonic', () => {
    const lines = surfBlockInput.split('\n');
    const line5 = lines[5];
    const rppCol = line5.indexOf('RPP');
    const hover = getHover(surfBlockDoc, { line: 5, character: rppCol }, surfBlockInput);
    expect(hover).toBeDefined();
    expect(hover).toContain('**RPP**');
    expect(hover).toContain('macrobody');
    expect(hover).toContain('xmin');
    expect(hover).toContain('zmax');
  });

  it('shows equation in surface type hover', () => {
    const lines = surfBlockInput.split('\n');
    const line6 = lines[6];
    const soCol = line6.indexOf('SO');
    const hover = getHover(surfBlockDoc, { line: 6, character: soCol }, surfBlockInput);
    expect(hover).toBeDefined();
    expect(hover).toContain('Sphere centered at origin');
    expect(hover).toContain('R\u00B2');
  });

  it('returns undefined for surface number token', () => {
    const hover = getHover(surfBlockDoc, { line: 3, character: 0 }, surfBlockInput);
    expect(hover).toBeUndefined();
  });

  it('returns undefined for parameter values', () => {
    const lines = surfBlockInput.split('\n');
    const line3 = lines[3];
    const valCol = line3.indexOf('5.0');
    const hover = getHover(surfBlockDoc, { line: 3, character: valCol }, surfBlockInput);
    expect(hover).toBeUndefined();
  });
});

/**
 * Test fixture: MT card hover
 */
const thermalInput = `thermal hover test
1  1  -1.0  -1  IMP:N=1
2  0         1  IMP:N=0

1  SO  5.0

M1  1001.80c 0.6667 8016.80c 0.3333
MT1  lwtr.10t
`;

const thermalDoc = parseInputFile(thermalInput);

/**
 * Test fixture: LIKE BUT hover
 *
 * Line 0: title
 * Line 1: cell 1307 with $ comment
 * Line 2: cell 401307 LIKE 1307 BUT ...
 * Line 3: blank
 * Line 4: surface 1
 * Line 5: blank
 * Line 6: M1
 * Line 7: NPS
 */
const likeButInput = `like but hover test
1307 0 -1 fill=1107 imp:n=1 u=1000           $ Fuel element #07
401307 like 1307 but fill=401107 u=401        $ Fuel element #07

1  SO  5.0

M1  92235.80c  1.0
NPS 1
`;

const likeButDoc = parseInputFile(likeButInput);

describe('getHover — LIKE BUT cell reference', () => {
  it('shows referenced cell hover with $ comment', () => {
    const lines = likeButInput.split('\n');
    const line2 = lines[2];
    const likeIdx = line2.indexOf('like');
    const cellNumCol = line2.indexOf('1307', likeIdx);
    const hover = getHover(likeButDoc, { line: 2, character: cellNumCol }, likeButInput);
    expect(hover).toBeDefined();
    expect(hover).toContain('Cell 1307');
    expect(hover).toContain('Fuel element #07');
  });

  it('prefers $ comment over C comment for referenced cell', () => {
    const text = `c comment vs dollar
C As-specified fuel element
1307 0 -1 imp:n=1                             $ Fuel element #07
2 like 1307 but imp:n=0

1  SO  5.0

NPS 1
`;
    const doc = parseInputFile(text);
    const lines = text.split('\n');
    const line3 = lines[3];
    const cellNumCol = line3.indexOf('1307');
    const hover = getHover(doc, { line: 3, character: cellNumCol }, text);
    expect(hover).toBeDefined();
    expect(hover).toContain('Cell 1307');
    expect(hover).toContain('Fuel element #07');
    expect(hover).not.toContain('As-specified');
  });

  it('falls back to C comment when no $ comment', () => {
    const text = `c comment fallback
C Fuel element #07
1307 0 -1 imp:n=1
2 like 1307 but imp:n=0

1  SO  5.0

NPS 1
`;
    const doc = parseInputFile(text);
    const lines = text.split('\n');
    const line3 = lines[3];
    const cellNumCol = line3.indexOf('1307');
    const hover = getHover(doc, { line: 3, character: cellNumCol }, text);
    expect(hover).toBeDefined();
    expect(hover).toContain('Cell 1307');
    expect(hover).toContain('Fuel element #07');
  });

  it('shows line number when no comment exists', () => {
    const text = `no comment
1307 0 -1 imp:n=1
2 like 1307 but imp:n=0

1  SO  5.0

NPS 1
`;
    const doc = parseInputFile(text);
    const lines = text.split('\n');
    const line2 = lines[2];
    const cellNumCol = line2.indexOf('1307');
    const hover = getHover(doc, { line: 2, character: cellNumCol }, text);
    expect(hover).toBeDefined();
    expect(hover).toContain('Cell 1307');
    expect(hover).toContain('line 2');
  });

  it('returns not-found message for missing LIKE cell', () => {
    const text = `missing ref
2 like 9999 but imp:n=0

1  SO  5.0

NPS 1
`;
    const doc = parseInputFile(text);
    const lines = text.split('\n');
    const line1 = lines[1];
    const cellNumCol = line1.indexOf('9999');
    const hover = getHover(doc, { line: 1, character: cellNumCol }, text);
    expect(hover).toBeDefined();
    expect(hover).toContain('Cell 9999');
    expect(hover).toContain('not found');
  });
});

describe('getHover — MAT= parameter', () => {
  it('shows material hover when hovering on MAT=N value', () => {
    const text = `mat param test
1  1 -2.7  -1  IMP:N=1
2  LIKE 1 BUT  MAT=1 RHO=-3.0

1  SO 5.0

c --- aluminum
M1 13027.80c 1.0
NPS 1000
`;
    const doc = parseInputFile(text);
    const line2 = text.split('\n')[2];
    // Cursor on the "1" in "MAT=1"
    const matCol = line2.indexOf('MAT=1') + 4;
    const hover = getHover(doc, { line: 2, character: matCol }, text);
    expect(hover).toBeDefined();
    expect(hover).toContain('Material 1');
    expect(hover).toContain('aluminum');
  });

  it('returns undefined when hovering on MAT keyword (not value)', () => {
    const text = `mat param test
1  1 -2.7  -1  IMP:N=1
2  LIKE 1 BUT  MAT=1

1  SO 5.0

M1 13027.80c 1.0
NPS 1000
`;
    const doc = parseInputFile(text);
    const line2 = text.split('\n')[2];
    // Cursor on the "M" in "MAT=1"
    const matCol = line2.indexOf('MAT=1');
    const hover = getHover(doc, { line: 2, character: matCol }, text);
    // Should not show material hover (cursor is on keyword, not the number)
    expect(hover).toBeUndefined();
  });
});

describe('getHover — #N cell complement', () => {
  const complementInput = `complement hover test
1  0  -1  IMP:N=1            $ Target cell
2  0  -2  IMP:N=1
3  0  #1 #2  IMP:N=0

1  SO  5.0
2  PX  10.0

NPS 1
`;
  const complementDoc = parseInputFile(complementInput);

  it('shows cell hover when hovering on #N complement ref', () => {
    const lines = complementInput.split('\n');
    const line3 = lines[3];
    const hashCol = line3.indexOf('#1');
    const hover = getHover(complementDoc, { line: 3, character: hashCol }, complementInput);
    expect(hover).toBeDefined();
    expect(hover).toContain('Cell 1');
    expect(hover).toContain('Target cell');
  });

  it('shows cell hover for second complement ref', () => {
    const lines = complementInput.split('\n');
    const line3 = lines[3];
    const hashCol = line3.indexOf('#2');
    const hover = getHover(complementDoc, { line: 3, character: hashCol }, complementInput);
    expect(hover).toBeDefined();
    expect(hover).toContain('Cell 2');
  });

  it('shows not-found for missing complement ref', () => {
    const text = `missing complement
1  0  #999  IMP:N=0

1  SO  5.0

NPS 1
`;
    const doc = parseInputFile(text);
    const lines = text.split('\n');
    const line1 = lines[1];
    const hashCol = line1.indexOf('#999');
    const hover = getHover(doc, { line: 1, character: hashCol }, text);
    expect(hover).toBeDefined();
    expect(hover).toContain('Cell 999');
    expect(hover).toContain('not found');
  });
});

describe('data card keyword hover', () => {
  it('shows hover for NPS keyword', () => {
    const text = `hover test\n1 0 -1 IMP:N=1\n2 0  1 IMP:N=0\n\n1 SO 5.0\n\nNPS 10000\n`;
    const doc = parseInputFile(text);
    const result = getHover(doc, { line: 6, character: 1 }, text);
    expect(result).toBeDefined();
    expect(result).toMatch(/NPS/);
    expect(result).toMatch(/histories|particles/i);
  });

  it('shows hover for MODE keyword', () => {
    const text = `hover test\n1 0 -1 IMP:N=1\n2 0  1 IMP:N=0\n\n1 SO 5.0\n\nMODE N P\nNPS 10000\n`;
    const doc = parseInputFile(text);
    const result = getHover(doc, { line: 6, character: 1 }, text);
    expect(result).toBeDefined();
    expect(result).toMatch(/MODE/);
  });

  it('shows hover for SDEF keyword', () => {
    const text = `hover test\n1 0 -1 IMP:N=1\n2 0  1 IMP:N=0\n\n1 SO 5.0\n\nSDEF ERG=7.0 PAR=2\nNPS 10000\n`;
    const doc = parseInputFile(text);
    const result = getHover(doc, { line: 6, character: 1 }, text);
    expect(result).toBeDefined();
    expect(result).toMatch(/SDEF|source/i);
  });

  it('shows hover for tally type on F4 card', () => {
    const text = `hover test\n1 1 -2.7 -1 IMP:N=1\n2 0       1 IMP:N=0\n\n1 SO 5.0\n\nM1 13027.80c 1.0\nF4:N 1\nNPS 10000\n`;
    const doc = parseInputFile(text);
    const result = getHover(doc, { line: 7, character: 1 }, text);
    expect(result).toBeDefined();
    expect(result).toMatch(/flux|track.length/i);
  });

  it('shows hover for KCODE keyword', () => {
    const text = `hover test\n1 0 -1 IMP:N=1\n2 0  1 IMP:N=0\n\n1 SO 5.0\n\nKCODE 1000 1.0 10 50\nNPS 10000\n`;
    const doc = parseInputFile(text);
    const result = getHover(doc, { line: 6, character: 2 }, text);
    expect(result).toBeDefined();
    expect(result).toMatch(/KCODE|criticality/i);
  });

  it('returns undefined for non-keyword token in data block', () => {
    const text = `hover test\n1 0 -1 IMP:N=1\n2 0  1 IMP:N=0\n\n1 SO 5.0\n\nNPS 10000\n`;
    const doc = parseInputFile(text);
    const result = getHover(doc, { line: 6, character: 5 }, text);
    // Position 5 is on "10000" — just a number, no hover
    expect(result).toBeUndefined();
  });
});

describe('getHover — comment lines', () => {
  it('returns undefined for commented-out ZAID in data block', () => {
    const text = `comment hover test
1  1  -2.7  -1  IMP:N=1
2  0         1  IMP:N=0

1  SO  5.0

M1  13027.80c  1.0
c M2  92235.80c  0.04
NPS 1000
`;
    const doc = parseInputFile(text);
    // Line 7: "c M2  92235.80c  0.04" — cursor on the ZAID
    const line7 = text.split('\n')[7];
    const col = line7.indexOf('92235');
    const hover = getHover(doc, { line: 7, character: col }, text);
    expect(hover).toBeUndefined();
  });

  it('returns undefined for commented-out cell line', () => {
    const text = `comment hover test
1  1  -2.7  -1  IMP:N=1
c 2  0         1  IMP:N=0

1  SO  5.0

M1  13027.80c  1.0
NPS 1000
`;
    const doc = parseInputFile(text);
    const hover = getHover(doc, { line: 2, character: 5 }, text);
    expect(hover).toBeUndefined();
  });
});

describe('getHover — thermal cards', () => {
  it('returns thermal hover for S(a,b) table name', () => {
    const lines = thermalInput.split('\n');
    // Find the MT line dynamically
    const mtLineIdx = lines.findIndex(l => l.startsWith('MT1'));
    const mtLine = lines[mtLineIdx];
    const tableCol = mtLine.indexOf('lwtr.10t');
    const hover = getHover(thermalDoc, { line: mtLineIdx, character: tableCol }, thermalInput);
    expect(hover).toBeDefined();
    expect(hover).toContain('lwtr.10t');
    expect(hover).toContain('Light water');
  });

  it('does not return hover for MT prefix itself', () => {
    const lines = thermalInput.split('\n');
    const mtLineIdx = lines.findIndex(l => l.startsWith('MT1'));
    // Hovering on "MT1" — not a ZAID and not in a thermal table entry range
    const hover = getHover(thermalDoc, { line: mtLineIdx, character: 0 }, thermalInput);
    expect(hover).toBeUndefined();
  });
});
