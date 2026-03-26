import { describe, it, expect } from 'vitest';
import { prepareRename, getRenameEdits } from '../../server/src/rename/renameProvider';
import { parseInputFile } from '../../server/src/parser/inputFile';
import { DocumentIndex } from '../../server/src/analysis/documentIndex';

const inputText = `rename test
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

describe('prepareRename', () => {
  it('returns range and placeholder for cell number', () => {
    const result = prepareRename(doc, { line: 1, character: 0 }, inputText, { idx });
    expect(result).toBeDefined();
    expect(result!.placeholder).toBe('1');
  });

  it('returns range and placeholder for surface number', () => {
    const result = prepareRename(doc, { line: 5, character: 0 }, inputText, { idx });
    expect(result).toBeDefined();
    expect(result!.placeholder).toBe('1');
  });

  it('returns undefined for whitespace', () => {
    // Line 4 is the blank separator
    const result = prepareRename(doc, { line: 4, character: 0 }, inputText, { idx });
    expect(result).toBeUndefined();
  });
});

describe('getRenameEdits — cell', () => {
  it('renames cell definition and #N complement', () => {
    const edits = getRenameEdits(doc, { line: 1, character: 0 }, inputText, '10', { idx });
    expect(edits.length).toBeGreaterThanOrEqual(2);
    // All edits should produce "10"
    for (const edit of edits) {
      expect(edit.newText).toBe('10');
    }
  });

  it('rejects non-numeric new name', () => {
    const edits = getRenameEdits(doc, { line: 1, character: 0 }, inputText, 'abc', { idx });
    expect(edits.length).toBe(0);
  });
});

describe('getRenameEdits — surface', () => {
  it('renames surface definition and geometry refs', () => {
    // Surface 1 is used as -1 in cell 1
    const edits = getRenameEdits(doc, { line: 5, character: 0 }, inputText, '10', { idx });
    expect(edits.length).toBeGreaterThanOrEqual(2);
    // Check that surface ref edits preserve the sign character
    for (const edit of edits) {
      expect(edit.newText).toBe('10');
    }
  });
});

describe('getRenameEdits — material', () => {
  it('renames material definition, cell usage, and MT card', () => {
    const lines = inputText.split('\n');
    const line8 = lines[8];
    const col = line8.indexOf('M1');
    const edits = getRenameEdits(doc, { line: 8, character: col }, inputText, '5', { idx });
    expect(edits.length).toBeGreaterThanOrEqual(3);
    for (const edit of edits) {
      expect(edit.newText).toBe('5');
    }
    // Verify we're editing M → M5 (only the number part)
    const matDefEdit = edits.find(e => e.range.startLine === 8);
    expect(matDefEdit).toBeDefined();
    // For MN, startCol should be after the 'M' character
    expect(matDefEdit!.range.startCol).toBeGreaterThan(0);
  });
});
