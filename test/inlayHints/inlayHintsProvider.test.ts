import { describe, it, expect } from 'vitest';
import { getInlayHints } from '../../server/src/inlayHints/inlayHintsProvider';
import { parseInputFile } from '../../server/src/parser/inputFile';
import { DocumentIndex } from '../../server/src/analysis/documentIndex';
import { InlayHintKind } from 'vscode-languageserver/node';

const input = [
  'inlay hints test',
  '1  1  -2.7  -1 2  IMP:N=1',
  '2  0         1    IMP:N=0',
  '',
  '1  SO  5.0',
  '2  PX  10.0',
  '',
  'M1  92235.80c  0.05',
  '     8016.80c  0.95',
].join('\n');

const fullRange = { start: { line: 0 }, end: { line: 20 } };

describe('getInlayHints', () => {
  it('shows U-235 and O-16 labels after ZAIDs', () => {
    const doc = parseInputFile(input);
    const idx = new DocumentIndex(doc);
    const hints = getInlayHints(doc, fullRange, input, { idx });

    const zaidHints = hints.filter(h => typeof h.label === 'string' && (h.label.includes('U-') || h.label.includes('O-')));
    expect(zaidHints.length).toBe(2);

    const uHint = zaidHints.find(h => (h.label as string).includes('U-235'));
    expect(uHint).toBeDefined();
    expect(uHint!.kind).toBe(InlayHintKind.Type);
    expect(uHint!.paddingLeft).toBe(true);

    const oHint = zaidHints.find(h => (h.label as string).includes('O-16'));
    expect(oHint).toBeDefined();
    expect(oHint!.kind).toBe(InlayHintKind.Type);
    expect(oHint!.paddingLeft).toBe(true);
  });

  it('shows surface type after surface refs in geometry', () => {
    const doc = parseInputFile(input);
    const idx = new DocumentIndex(doc);
    const hints = getInlayHints(doc, fullRange, input, { idx });

    const surfHints = hints.filter(h => typeof h.label === 'string' && (h.label.includes('SO') || h.label.includes('PX')));
    expect(surfHints.length).toBeGreaterThanOrEqual(2);

    const soHint = surfHints.find(h => (h.label as string).includes('SO'));
    expect(soHint).toBeDefined();

    const pxHint = surfHints.find(h => (h.label as string).includes('PX'));
    expect(pxHint).toBeDefined();
  });

  it('respects range filter (only hints within range)', () => {
    const doc = parseInputFile(input);
    const idx = new DocumentIndex(doc);

    // Only request hints for the material card lines (lines 7-8)
    const materialRange = { start: { line: 7 }, end: { line: 8 } };
    const hints = getInlayHints(doc, materialRange, input, { idx });

    // Should only have ZAID hints, no surface type hints
    const surfHints = hints.filter(h => typeof h.label === 'string' && (h.label.includes('SO') || h.label.includes('PX')));
    expect(surfHints.length).toBe(0);

    const zaidHints = hints.filter(h => typeof h.label === 'string' && (h.label.includes('U-') || h.label.includes('O-')));
    expect(zaidHints.length).toBe(2);
  });

  it('returns empty for document with no materials/cells', () => {
    const emptyInput = 'empty test\n\n\n\n';
    const doc = parseInputFile(emptyInput);
    const idx = new DocumentIndex(doc);
    const hints = getInlayHints(doc, fullRange, emptyInput, { idx });
    expect(hints).toEqual([]);
  });

  it('hides surface type hints when showSurfaceTypes is false', () => {
    const doc = parseInputFile(input);
    const idx = new DocumentIndex(doc);
    const hints = getInlayHints(doc, fullRange, input, { idx, showSurfaceTypes: false });

    const surfHints = hints.filter(h => typeof h.label === 'string' && (h.label.includes('SO') || h.label.includes('PX')));
    expect(surfHints.length).toBe(0);

    // ZAID hints should still appear
    const zaidHints = hints.filter(h => typeof h.label === 'string' && (h.label.includes('U-') || h.label.includes('O-')));
    expect(zaidHints.length).toBe(2);
  });

  it('positions ZAID hints after the fraction on continuation lines', () => {
    const doc = parseInputFile(input);
    const idx = new DocumentIndex(doc);
    const hints = getInlayHints(doc, fullRange, input, { idx });

    // U-235 on line 7: "M1  92235.80c  0.05" → fraction ends at col 19
    const uHint = hints.find(h => typeof h.label === 'string' && (h.label as string).includes('U-235'));
    expect(uHint).toBeDefined();
    expect(uHint!.position).toEqual({ line: 7, character: 19 });

    // O-16 on line 8: "     8016.80c  0.95" → fraction ends at col 19
    const oHint = hints.find(h => typeof h.label === 'string' && (h.label as string).includes('O-16'));
    expect(oHint).toBeDefined();
    expect(oHint!.position).toEqual({ line: 8, character: 19 });
  });

  it('positions hints after fractions with multiple ZAIDs per line', () => {
    const multiInput = [
      'multi ZAID test',
      '1  1  -2.7  -1  IMP:N=1',
      '',
      '1  SO  5.0',
      '',
      'M107115 13027.00c 0.730443',
      '        14028.00c 0.099366  14029.00c 0.005046  14030.00c 0.003326',
      '        92235.00c 0.032287  92238.00c 0.129533',
    ].join('\n');

    const doc = parseInputFile(multiInput);
    const hints = getInlayHints(doc, fullRange, multiInput);

    // Line 5: "M107115 13027.00c 0.730443" → fraction ends at col 26
    const alHint = hints.find(h => (h.label as string).includes('Al-27'));
    expect(alHint).toBeDefined();
    expect(alHint!.position).toEqual({ line: 5, character: 26 });

    // Line 6: "        14028.00c 0.099366  14029.00c 0.005046  14030.00c 0.003326"
    const si28Hint = hints.find(h => (h.label as string).includes('Si-28'));
    expect(si28Hint).toBeDefined();
    expect(si28Hint!.position).toEqual({ line: 6, character: 26 });

    const si29Hint = hints.find(h => (h.label as string).includes('Si-29'));
    expect(si29Hint).toBeDefined();
    expect(si29Hint!.position).toEqual({ line: 6, character: 46 });

    const si30Hint = hints.find(h => (h.label as string).includes('Si-30'));
    expect(si30Hint).toBeDefined();
    expect(si30Hint!.position).toEqual({ line: 6, character: 66 });

    // Line 7: "        92235.00c 0.032287  92238.00c 0.129533"
    const u235Hint = hints.find(h => (h.label as string).includes('U-235'));
    expect(u235Hint).toBeDefined();
    expect(u235Hint!.position).toEqual({ line: 7, character: 26 });

    const u238Hint = hints.find(h => (h.label as string).includes('U-238'));
    expect(u238Hint).toBeDefined();
    expect(u238Hint!.position).toEqual({ line: 7, character: 46 });
  });

  it('shows El-nat for natural composition (a=0)', () => {
    const natInput = [
      'natural test',
      '1  1  -2.7  -1  IMP:N=1',
      '',
      '1  SO  5.0',
      '',
      'M1  26000.80c  1.0',
    ].join('\n');

    const doc = parseInputFile(natInput);
    const idx = new DocumentIndex(doc);
    const hints = getInlayHints(doc, fullRange, natInput, { idx });

    const natHint = hints.find(h => typeof h.label === 'string' && (h.label as string).includes('Fe-nat'));
    expect(natHint).toBeDefined();
  });
});
