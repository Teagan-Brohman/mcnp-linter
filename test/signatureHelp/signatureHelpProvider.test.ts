import { describe, it, expect } from 'vitest';
import { getSignatureHelp } from '../../server/src/signatureHelp/signatureHelpProvider';
import { parseInputFile } from '../../server/src/parser/inputFile';
import { DocumentIndex } from '../../server/src/analysis/documentIndex';

const input = `sig help test
1  0  -1  IMP:N=1

1  RPP  0 10 0 10 0 10
2  SO   5.0

NPS 1
`;

const doc = parseInputFile(input);
const idx = new DocumentIndex(doc);

describe('getSignatureHelp', () => {
  it('returns signature for RPP with correct parameter names', () => {
    // Cursor on the first parameter "0" of "1  RPP  0 10 0 10 0 10"
    const line = 3; // 0-based: "1  RPP  0 10 0 10 0 10"
    const result = getSignatureHelp(doc, { line, character: 8 }, input, { idx });
    expect(result).toBeDefined();
    expect(result!.signatures).toHaveLength(1);
    expect(result!.signatures[0].label).toBe('RPP xmin xmax ymin ymax zmin zmax');
    expect(result!.signatures[0].parameters).toHaveLength(6);
    expect(result!.activeSignature).toBe(0);
    expect(result!.activeParameter).toBe(0); // on xmin
  });

  it('active parameter index changes with cursor position', () => {
    const line = 3; // "1  RPP  0 10 0 10 0 10"
    // Find column positions: "1  RPP  0 10 0 10 0 10"
    //                         0123456789...
    // After "0 10" the cursor is at "0" (third param, ymin), which is activeParameter 2
    // Tokens after RPP: 0(col8) 10(col10) 0(col13) 10(col15) 0(col18) 10(col20)
    const result = getSignatureHelp(doc, { line, character: 13 }, input, { idx });
    expect(result).toBeDefined();
    expect(result!.activeParameter).toBe(2); // ymin
  });

  it('returns signature for SO with paramNames [R]', () => {
    const line = 4; // "2  SO   5.0"
    const result = getSignatureHelp(doc, { line, character: 8 }, input, { idx });
    expect(result).toBeDefined();
    expect(result!.signatures[0].label).toBe('SO R');
    expect(result!.signatures[0].parameters).toHaveLength(1);
    expect(result!.activeParameter).toBe(0);
  });

  it('returns undefined for non-surface lines (cell block)', () => {
    const line = 1; // "1  0  -1  IMP:N=1"
    const result = getSignatureHelp(doc, { line, character: 5 }, input, { idx });
    expect(result).toBeUndefined();
  });

  it('returns undefined for non-surface lines (data block)', () => {
    const line = 6; // "NPS 1"
    const result = getSignatureHelp(doc, { line, character: 2 }, input, { idx });
    expect(result).toBeUndefined();
  });

  it('returns undefined without idx', () => {
    const result = getSignatureHelp(doc, { line: 3, character: 8 }, input);
    expect(result).toBeUndefined();
  });

  it('highlights last parameter when cursor is at end of line', () => {
    const line = 3; // "1  RPP  0 10 0 10 0 10"
    // Cursor past the last token
    const result = getSignatureHelp(doc, { line, character: 22 }, input, { idx });
    expect(result).toBeDefined();
    expect(result!.activeParameter).toBe(5); // zmax (clamped to last)
  });
});
