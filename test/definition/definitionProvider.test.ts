import { describe, it, expect } from 'vitest';
import { getDefinition } from '../../server/src/definition/definitionProvider';
import { parseInputFile } from '../../server/src/parser/inputFile';
import { DocumentIndex } from '../../server/src/analysis/documentIndex';
import { UniverseMap } from '../../server/src/analysis/universeMap';

/**
 * Test fixture:
 *
 * Line 0: title
 * Line 1: cell 1 — mat 1, density -7.86, geometry -1 2
 * Line 2: cell 2 — void, geometry 1
 * Line 3: blank
 * Line 4: surface 1 SO 5.0
 * Line 5: surface 2 PX 10.0
 * Line 6: blank
 * Line 7: c --- iron
 * Line 8: M1   26000  -1.00000
 * Line 9: NPS  1000
 */
const text = `test deck
1  1  -7.86  -1 2  IMP:N=1
2  0          1    IMP:N=0

1  SO  5.0
2  PX  10.0

c --- iron
M1   26000  -1.00000
NPS  1000
`;

const doc = parseInputFile(text);

describe('getDefinition', () => {
  it('jumps from surface ref in cell to surface definition', () => {
    // Cell 1 geometry: "-1" at cols 13–15 on line 1
    const result = getDefinition(doc, { line: 1, character: 13 }, text);
    expect(result).toBeDefined();
    expect(result!.range.startLine).toBe(4); // "1  SO  5.0"
  });

  it('jumps from unsigned surface ref to surface definition', () => {
    // Cell 1 geometry: "2" at col 16 on line 1
    const result = getDefinition(doc, { line: 1, character: 16 }, text);
    expect(result).toBeDefined();
    expect(result!.range.startLine).toBe(5); // "2  PX  10.0"
  });

  it('jumps from material number in cell to material definition', () => {
    // Cell 1: "1  1  -7.86  -1 2  IMP:N=1" — material "1" at col 3
    const result = getDefinition(doc, { line: 1, character: 3 }, text);
    expect(result).toBeDefined();
    expect(result!.range.startLine).toBe(8); // "M1   26000..."
  });

  it('returns undefined for non-reference tokens (IMP:N)', () => {
    // IMP:N=1 starts at col 20 on line 1
    const line1 = text.split('\n')[1];
    const impCol = line1.indexOf('IMP:N=1');
    const result = getDefinition(doc, { line: 1, character: impCol }, text);
    expect(result).toBeUndefined();
  });

  it('returns undefined in data block', () => {
    // Line 9: "NPS  1000" — in data block
    const result = getDefinition(doc, { line: 9, character: 5 }, text);
    expect(result).toBeUndefined();
  });

  it('returns undefined for undefined surface', () => {
    const text2 = `test
1  0  -99

1  SO  5.0

NPS 1
`;
    const doc2 = parseInputFile(text2);
    // Surface 99 doesn't exist
    const line1 = text2.split('\n')[1];
    const col = line1.indexOf('-99');
    const result = getDefinition(doc2, { line: 1, character: col }, text2);
    expect(result).toBeUndefined();
  });

  it('returns undefined for void cell material (mat=0)', () => {
    // Cell 2: "2  0  ..." — material 0 is void, no definition to jump to
    const result = getDefinition(doc, { line: 2, character: 3 }, text);
    expect(result).toBeUndefined();
  });

  it('returns undefined for whitespace position', () => {
    // Col 1 on line 1 is a space
    const result = getDefinition(doc, { line: 1, character: 1 }, text);
    expect(result).toBeUndefined();
  });

  it('returns undefined for cell number (first token)', () => {
    // Col 0 on line 1 is "1" (cell number), not a reference
    const result = getDefinition(doc, { line: 1, character: 0 }, text);
    expect(result).toBeUndefined();
  });
});

describe('getDefinition — LIKE BUT', () => {
  const likeText = `like but test
1  1  -7.86  -1    IMP:N=1
2  LIKE 1 BUT  IMP:N=0

1  SO  5.0

M1   26000  -1.00000
NPS 1
`;
  const likeDoc = parseInputFile(likeText);

  it('jumps from LIKE n cell reference to the referenced cell', () => {
    // Line 2: "2  LIKE 1 BUT  IMP:N=0" — "1" after LIKE
    const line2 = likeText.split('\n')[2];
    const likeIdx = line2.indexOf('LIKE');
    // The cell number is the token after LIKE
    const cellNumCol = line2.indexOf(' 1 ', likeIdx) + 1;
    const result = getDefinition(likeDoc, { line: 2, character: cellNumCol }, likeText);
    expect(result).toBeDefined();
    expect(result!.range.startLine).toBe(1); // cell 1 definition
  });

  it('returns undefined for LIKE keyword itself', () => {
    const line2 = likeText.split('\n')[2];
    const likeCol = line2.indexOf('LIKE');
    const result = getDefinition(likeDoc, { line: 2, character: likeCol }, likeText);
    expect(result).toBeUndefined();
  });

  it('returns undefined when LIKE references non-existent cell', () => {
    const badText = `like but missing
1  0  -1    IMP:N=1
2  LIKE 99 BUT  IMP:N=0

1  SO  5.0

NPS 1
`;
    const badDoc = parseInputFile(badText);
    const line2 = badText.split('\n')[2];
    const likeIdx = line2.indexOf('LIKE');
    const cellNumCol = line2.indexOf('99', likeIdx);
    const result = getDefinition(badDoc, { line: 2, character: cellNumCol }, badText);
    expect(result).toBeUndefined();
  });
});

describe('getDefinition — cell complement', () => {
  const complementText = `complement test
1  0  -1     IMP:N=1
2  0  #1     IMP:N=1

1  SO  5.0

NPS 1
`;
  const complementDoc = parseInputFile(complementText);

  it('jumps from #N cell complement to the referenced cell', () => {
    // Line 2: "2  0  #1     IMP:N=1"
    const line2 = complementText.split('\n')[2];
    const hashCol = line2.indexOf('#1');
    const result = getDefinition(complementDoc, { line: 2, character: hashCol }, complementText);
    expect(result).toBeDefined();
    // Should point to cell 1 definition (line 1)
    expect(result!.range.startLine).toBe(1);
  });
});

describe('getDefinition — FILL/U navigation', () => {
  const fillText = `fill universe test
1 1 -2.7 -1 IMP:N=1 FILL=3
2 0       1 IMP:N=0
3 1 -2.7 -2 IMP:N=1 U=3

1 SO 5.0
2 SO 10.0

M1 13027.80c 1.0
SDEF ERG=1.0
NPS 1000
`;
  const fillDoc = parseInputFile(fillText);
  const fillIdx = new DocumentIndex(fillDoc);
  const fillUm = new UniverseMap(fillDoc);

  it('jumps from FILL=3 to first cell with U=3', () => {
    const line1 = fillText.split('\n')[1];
    const fillCol = line1.indexOf('FILL=3');
    // Cursor on the '3' in FILL=3
    const result = getDefinition(fillDoc, { line: 1, character: fillCol + 5 }, fillText, { idx: fillIdx, um: fillUm });
    expect(result).toBeDefined();
    expect(result!.range.startLine).toBe(3); // cell 3 with U=3
  });

  it('jumps from FILL keyword part to first cell with U=N', () => {
    const line1 = fillText.split('\n')[1];
    const fillCol = line1.indexOf('FILL=3');
    // Cursor on the 'F' in FILL=3
    const result = getDefinition(fillDoc, { line: 1, character: fillCol }, fillText, { idx: fillIdx, um: fillUm });
    expect(result).toBeDefined();
    expect(result!.range.startLine).toBe(3);
  });

  it('jumps from U=3 to cell with FILL=3', () => {
    const line3 = fillText.split('\n')[3];
    const uCol = line3.indexOf('U=3');
    // Cursor on the '3' in U=3
    const result = getDefinition(fillDoc, { line: 3, character: uCol + 2 }, fillText, { idx: fillIdx, um: fillUm });
    expect(result).toBeDefined();
    expect(result!.range.startLine).toBe(1); // cell 1 with FILL=3
  });

  it('jumps from U keyword part to cell with FILL=N', () => {
    const line3 = fillText.split('\n')[3];
    const uCol = line3.indexOf('U=3');
    // Cursor on the 'U' in U=3
    const result = getDefinition(fillDoc, { line: 3, character: uCol }, fillText, { idx: fillIdx, um: fillUm });
    expect(result).toBeDefined();
    expect(result!.range.startLine).toBe(1);
  });

  it('returns undefined for FILL referencing non-existent universe', () => {
    const badText = `bad fill test
1 0 -1 IMP:N=1 FILL=99
2 0  1 IMP:N=0

1 SO 5.0

NPS 1
`;
    const badDoc = parseInputFile(badText);
    const badIdx = new DocumentIndex(badDoc);
    const badUm = new UniverseMap(badDoc);
    const line1 = badText.split('\n')[1];
    const fillCol = line1.indexOf('FILL=99');
    const result = getDefinition(badDoc, { line: 1, character: fillCol + 5 }, badText, { idx: badIdx, um: badUm });
    expect(result).toBeUndefined();
  });

  it('returns undefined for U with no cell filling that universe', () => {
    const orphanText = `orphan universe test
1 0 -1 IMP:N=1 U=5
2 0  1 IMP:N=0

1 SO 5.0

NPS 1
`;
    const orphanDoc = parseInputFile(orphanText);
    const orphanIdx = new DocumentIndex(orphanDoc);
    const orphanUm = new UniverseMap(orphanDoc);
    const line1 = orphanText.split('\n')[1];
    const uCol = line1.indexOf('U=5');
    const result = getDefinition(orphanDoc, { line: 1, character: uCol + 2 }, orphanText, { idx: orphanIdx, um: orphanUm });
    expect(result).toBeUndefined();
  });

  it('handles *FILL= (starred fill)', () => {
    const starText = `star fill test
1 1 -2.7 -1 IMP:N=1 *FILL=3
2 0       1 IMP:N=0
3 1 -2.7 -2 IMP:N=1 U=3

1 SO 5.0
2 SO 10.0

M1 13027.80c 1.0
NPS 1000
`;
    const starDoc = parseInputFile(starText);
    const starIdx = new DocumentIndex(starDoc);
    const starUm = new UniverseMap(starDoc);
    const line1 = starText.split('\n')[1];
    const fillCol = line1.indexOf('*FILL=3');
    const result = getDefinition(starDoc, { line: 1, character: fillCol + 6 }, starText, { idx: starIdx, um: starUm });
    expect(result).toBeDefined();
    expect(result!.range.startLine).toBe(3);
  });
});

describe('getDefinition — data block', () => {
  it('jumps from SDEF CEL=1 to cell definition', () => {
    const text = `def test
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF CEL=1
NPS 1000
`;
    const doc = parseInputFile(text);
    const sdefLine = 6; // "SDEF CEL=1"
    const celCol = text.split('\n')[sdefLine].indexOf('CEL=1');
    const result = getDefinition(doc, { line: sdefLine, character: celCol + 4 }, text);
    expect(result).toBeDefined();
    expect(result!.range.startLine).toBe(1); // cell 1
  });

  it('jumps from SDEF SUR=1 to surface definition', () => {
    const text = `def test
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF SUR=1
NPS 1000
`;
    const doc = parseInputFile(text);
    const sdefLine = 6;
    const surCol = text.split('\n')[sdefLine].indexOf('SUR=1');
    const result = getDefinition(doc, { line: sdefLine, character: surCol + 4 }, text);
    expect(result).toBeDefined();
    expect(result!.range.startLine).toBe(4); // surface 1
  });

  it('jumps from SDEF TR=1 to transform definition', () => {
    const text = `def test
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

TR1 1.0 2.0 3.0
SDEF TR=1
NPS 1000
`;
    const doc = parseInputFile(text);
    const sdefLine = 7; // "SDEF TR=1"
    const trCol = text.split('\n')[sdefLine].indexOf('TR=1');
    const result = getDefinition(doc, { line: sdefLine, character: trCol + 3 }, text);
    expect(result).toBeDefined();
    expect(result!.range.startLine).toBe(6); // TR1
  });

  it('jumps from F4 tally bin to cell definition', () => {
    const text = `def test
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
F4:N 1
SDEF ERG=1.0
NPS 1000
`;
    const doc = parseInputFile(text);
    const tallyLine = 7; // "F4:N 1"
    const binCol = text.split('\n')[tallyLine].indexOf(' 1') + 1;
    const result = getDefinition(doc, { line: tallyLine, character: binCol }, text);
    expect(result).toBeDefined();
    expect(result!.range.startLine).toBe(1); // cell 1
  });

  it('jumps from F2 tally bin to surface definition', () => {
    const text = `def test
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

F2:N 1
SDEF ERG=1.0
NPS 1000
`;
    const doc = parseInputFile(text);
    const tallyLine = 6;
    const binCol = text.split('\n')[tallyLine].indexOf(' 1') + 1;
    const result = getDefinition(doc, { line: tallyLine, character: binCol }, text);
    expect(result).toBeDefined();
    expect(result!.range.startLine).toBe(4); // surface 1
  });

  it('jumps from FM material ref to material definition', () => {
    const text = `def test
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
F4:N 1
FM4 1.0 1 102
SDEF ERG=1.0
NPS 1000
`;
    const doc = parseInputFile(text);
    const fmLine = 8; // "FM4 1.0 1 102"
    const lineStr = text.split('\n')[fmLine];
    // The "1" after "1.0" is the material ref — find second '1' after FM4
    const matCol = lineStr.indexOf(' 1 ', lineStr.indexOf('1.0')) + 1;
    const result = getDefinition(doc, { line: fmLine, character: matCol }, text);
    expect(result).toBeDefined();
    expect(result!.range.startLine).toBe(6); // M1
  });

  it('returns undefined for non-entity token in data block', () => {
    const text = `def test
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

NPS 1000
SDEF ERG=1.0
`;
    const doc = parseInputFile(text);
    // cursor on "NPS" keyword
    const result = getDefinition(doc, { line: 6, character: 1 }, text);
    expect(result).toBeUndefined();
  });

  it('returns undefined for SDEF CEL referencing non-existent cell', () => {
    const text = `def test
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF CEL=99
NPS 1000
`;
    const doc = parseInputFile(text);
    const sdefLine = 6;
    const celCol = text.split('\n')[sdefLine].indexOf('CEL=99');
    const result = getDefinition(doc, { line: sdefLine, character: celCol + 4 }, text);
    expect(result).toBeUndefined();
  });

  it('returns undefined for tally bin referencing non-existent cell', () => {
    const text = `def test
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

F4:N 99
SDEF ERG=1.0
NPS 1000
`;
    const doc = parseInputFile(text);
    const tallyLine = 6;
    const lineStr = text.split('\n')[tallyLine];
    const binCol = lineStr.indexOf('99');
    const result = getDefinition(doc, { line: tallyLine, character: binCol }, text);
    expect(result).toBeUndefined();
  });
});

describe('getDefinition — cross-file (sourceUri)', () => {
  it('returns sourceUri for material from READ file', () => {
    const input = [
      'Test cross-file',
      '1 1 -2.7 -1',
      '',
      '1 so 5.0',
      '',
      'M1 92235.80c 1.0',
      'NPS 1000',
    ].join('\n');
    const doc = parseInputFile(input);
    doc.materials[0].sourceUri = 'file:///path/to/materials.i';

    // Cell 1 material ref "1" at col 2
    const result = getDefinition(doc, { line: 1, character: 2 }, input);
    expect(result).toBeDefined();
    expect(result!.uri).toBe('file:///path/to/materials.i');
    expect(result!.range.startLine).toBe(5); // M1 line
  });

  it('returns sourceUri for surface from READ file', () => {
    const input = [
      'Test cross-file surf',
      '1 0 -1',
      '',
      '1 so 5.0',
      '',
      'NPS 1000',
    ].join('\n');
    const doc = parseInputFile(input);
    doc.surfaces[0].sourceUri = 'file:///path/to/surfaces.i';

    // Cell 1 geometry ref "-1" — cursor on the '1' at col 5
    const result = getDefinition(doc, { line: 1, character: 5 }, input);
    expect(result).toBeDefined();
    expect(result!.uri).toBe('file:///path/to/surfaces.i');
  });

  it('returns undefined uri for same-file entity', () => {
    const input = [
      'Test same-file',
      '1 1 -2.7 -1',
      '',
      '1 so 5.0',
      '',
      'M1 92235.80c 1.0',
      'NPS 1000',
    ].join('\n');
    const doc = parseInputFile(input);
    // No sourceUri set — same-file entity

    const result = getDefinition(doc, { line: 1, character: 2 }, input);
    expect(result).toBeDefined();
    expect(result!.uri).toBeUndefined();
  });
});
