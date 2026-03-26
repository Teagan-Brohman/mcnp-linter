import { describe, it, expect } from 'vitest';
import { findReferences } from '../../server/src/references/referencesProvider';
import { parseInputFile } from '../../server/src/parser/inputFile';
import { DocumentIndex } from '../../server/src/analysis/documentIndex';

const inputText = `references test
1  1  -2.7  -1 2  IMP:N=1
2  0        #1    IMP:N=0
3  0         1    IMP:N=0

1  SO  5.0
2  PX  10.0

M1  13027.80c  1.0
MT1  al27.12t
`;

const doc = parseInputFile(inputText);
const idx = new DocumentIndex(doc);

describe('findReferences — cell', () => {
  it('finds cell definition and #N complement ref', () => {
    // Cursor on cell 1 number (line 1, col 0)
    const refs = findReferences(doc, { line: 1, character: 0 }, inputText, { idx });
    expect(refs.length).toBeGreaterThanOrEqual(2);
    // Should include the definition (line 1) and the #1 complement (line 2)
    const lines = refs.map(r => r.startLine);
    expect(lines).toContain(1); // definition
    expect(lines).toContain(2); // #1 complement
  });

  it('finds cell from complement ref position', () => {
    const lines = inputText.split('\n');
    const line2 = lines[2];
    const hashCol = line2.indexOf('#1');
    const refs = findReferences(doc, { line: 2, character: hashCol }, inputText, { idx });
    expect(refs.length).toBeGreaterThanOrEqual(2);
  });
});

describe('findReferences — surface', () => {
  it('finds surface definition and geometry refs', () => {
    // Cursor on surface 1 definition (line 5, col 0)
    const refs = findReferences(doc, { line: 5, character: 0 }, inputText, { idx });
    expect(refs.length).toBeGreaterThanOrEqual(2);
    const lines = refs.map(r => r.startLine);
    expect(lines).toContain(5); // definition
    // Surface 1 is used in cell 1 (-1) on line 1
    expect(lines).toContain(1);
  });

  it('finds surface from geometry ref position', () => {
    const lines = inputText.split('\n');
    const line1 = lines[1];
    const col = line1.indexOf('-1');
    const refs = findReferences(doc, { line: 1, character: col }, inputText, { idx });
    expect(refs.length).toBeGreaterThanOrEqual(2);
  });
});

describe('findReferences — material', () => {
  it('finds material definition, cell usage, and MT card', () => {
    // Cursor on M1 definition (line 8)
    const lines = inputText.split('\n');
    const line8 = lines[8];
    const col = line8.indexOf('M1');
    const refs = findReferences(doc, { line: 8, character: col }, inputText, { idx });
    expect(refs.length).toBeGreaterThanOrEqual(3);
    const refLines = refs.map(r => r.startLine);
    expect(refLines).toContain(8); // M1 definition
    expect(refLines).toContain(1); // cell 1 uses material 1
    expect(refLines).toContain(9); // MT1
  });

  it('finds material from cell material position', () => {
    const lines = inputText.split('\n');
    const line1 = lines[1];
    // Second token is material number
    const firstSpace = line1.indexOf(' ');
    let matCol = firstSpace;
    while (line1[matCol] === ' ') matCol++;
    const refs = findReferences(doc, { line: 1, character: matCol }, inputText, { idx });
    expect(refs.length).toBeGreaterThanOrEqual(3);
  });

  it('excludes declaration when includeDeclaration is false', () => {
    const lines = inputText.split('\n');
    const line8 = lines[8];
    const col = line8.indexOf('M1');
    const refs = findReferences(doc, { line: 8, character: col }, inputText, { idx, includeDeclaration: false });
    const refLines = refs.map(r => r.startLine);
    expect(refLines).not.toContain(8); // M1 definition excluded
  });
});

describe('findReferences — no match', () => {
  it('returns empty for whitespace position', () => {
    const refs = findReferences(doc, { line: 4, character: 0 }, inputText, { idx });
    // Line 4 is the blank separator between cells and surfaces
    expect(refs.length).toBe(0);
  });
});
