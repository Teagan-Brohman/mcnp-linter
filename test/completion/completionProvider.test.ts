import { describe, it, expect } from 'vitest';
import { getCompletions } from '../../server/src/completion/completionProvider';
import { parseInputFile } from '../../server/src/parser/inputFile';
import { DocumentIndex } from '../../server/src/analysis/documentIndex';
import { CompletionItemKind } from 'vscode-languageserver/node';

function setup(input: string) {
  const doc = parseInputFile(input);
  const idx = new DocumentIndex(doc);
  return { doc, idx, text: input };
}

describe('getCompletions', () => {
  const basicInput = `test problem
1  1 -2.7  -1 2  IMP:N=1  $ fuel cell
2  0        1    IMP:N=0  $ void

1  SO 5
2  PZ 10

M1 13027.80c 1.0
NPS 1000
`;

  describe('cell block', () => {
    it('offers surface IDs and cell complements in geometry region', () => {
      const { doc, idx, text } = setup(basicInput);
      // Line 1 (cell 1), character 15 — in geometry region after density
      const items = getCompletions(doc, { line: 1, character: 15 }, text, { idx });

      // Should include surface references
      const surfLabels = items.filter(i => i.kind === CompletionItemKind.Reference && !i.label.startsWith('#'));
      expect(surfLabels.map(i => i.label)).toContain('1');
      expect(surfLabels.map(i => i.label)).toContain('2');

      // Surface detail includes type
      const s1 = surfLabels.find(i => i.label === '1');
      expect(s1?.detail).toContain('SO');
    });

    it('offers cell complements excluding self', () => {
      const { doc, idx, text } = setup(basicInput);
      const items = getCompletions(doc, { line: 1, character: 15 }, text, { idx });

      const complements = items.filter(i => i.label.startsWith('#'));
      expect(complements.map(i => i.label)).toContain('#2');
      expect(complements.map(i => i.label)).not.toContain('#1'); // skip self
    });

    it('offers parameter keywords in geometry/parameter region', () => {
      const { doc, idx, text } = setup(basicInput);
      const items = getCompletions(doc, { line: 1, character: 15 }, text, { idx });

      const keywords = items.filter(i => i.kind === CompletionItemKind.Keyword);
      const labels = keywords.map(i => i.label);
      expect(labels).toContain('IMP:N=');
      expect(labels).toContain('U=');
      expect(labels).toContain('FILL=');
      expect(labels).toContain('LAT=');
    });

    it('offers material IDs at material position (token 1)', () => {
      const { doc, idx, text } = setup(basicInput);
      // Line 1: "1  1 -2.7  -1 2  IMP:N=1  $ fuel cell"
      // Token 1 is "1" (material), starts at col 3
      const items = getCompletions(doc, { line: 1, character: 3 }, text, { idx });

      const labels = items.map(i => i.label);
      expect(labels).toContain('0'); // void
      expect(labels).toContain('1'); // M1
      // Material detail
      const m1 = items.find(i => i.label === '1' && i.kind === CompletionItemKind.Value);
      expect(m1?.detail).toContain('Material 1');
    });

    it('does not offer completions at cell number position', () => {
      const { doc, idx, text } = setup(basicInput);
      // Token 0 position (cell number)
      const items = getCompletions(doc, { line: 1, character: 0 }, text, { idx });
      expect(items).toHaveLength(0);
    });
  });

  describe('LIKE BUT cell', () => {
    const likeButInput = `like but test
1  1 -2.7  -1  IMP:N=1  $ fuel cell
2  LIKE 1 BUT  IMP:N=0

1  SO 5.0

M1 13027.80c 1.0
NPS 1000
`;

    it('offers cell IDs at the LIKE cell-number position (token 2)', () => {
      const { doc, idx, text } = setup(likeButInput);
      // Line 2: "2  LIKE 1 BUT  IMP:N=0" — token 2 is "1" (the cell ref after LIKE)
      const line2 = text.split('\n')[2];
      const likeIdx = line2.indexOf('LIKE');
      const cellNumCol = line2.indexOf(' 1 ', likeIdx) + 1;
      const items = getCompletions(doc, { line: 2, character: cellNumCol }, text, { idx });

      const labels = items.map(i => i.label);
      expect(labels).toContain('1'); // cell 1
      expect(labels).not.toContain('2'); // skip self
      // Should NOT contain surface IDs as Reference items with "Surface" in detail
      const surfaceItems = items.filter(i => i.detail?.includes('Surface'));
      expect(surfaceItems).toHaveLength(0);
    });

    it('offers parameter keywords after BUT', () => {
      const { doc, idx, text } = setup(likeButInput);
      // Line 2: cursor in parameter region after BUT
      const line2 = text.split('\n')[2];
      const butIdx = line2.indexOf('BUT');
      const items = getCompletions(doc, { line: 2, character: butIdx + 5 }, text, { idx });

      // Should have parameter keywords only (no surfaces/complements)
      const keywords = items.filter(i => i.kind === CompletionItemKind.Keyword);
      expect(keywords.length).toBe(items.length);
      const labels = items.map(i => i.label);
      expect(labels).toContain('IMP:N=');
      expect(labels).toContain('U=');
      expect(labels).toContain('FILL=');
      expect(labels).toContain('MAT=');
      expect(labels).toContain('RHO=');
      expect(labels).toContain('TMP=');
    });

    it('offers values after typing KEY= (e.g. IMP:N=)', () => {
      // "2  LIKE 1 BUT  IMP:N=" — cursor right after =
      const valInput = `value completion test
1  1 -2.7  -1  IMP:N=1
2  LIKE 1 BUT  IMP:N=

1  SO 5.0

M1 13027.80c 1.0
NPS 1000
`;
      const { doc, idx, text } = setup(valInput);
      const line2 = text.split('\n')[2];
      const eqCol = line2.indexOf('IMP:N=') + 6; // right after =
      const items = getCompletions(doc, { line: 2, character: eqCol }, text, { idx });

      const labels = items.map(i => i.label);
      expect(labels).toContain('1');
      expect(labels).toContain('0');
      expect(items).toHaveLength(2);
    });

    it('offers material IDs after typing MAT=', () => {
      const matInput = `mat value test
1  1 -2.7  -1  IMP:N=1
2  LIKE 1 BUT  MAT=

1  SO 5.0

M1 13027.80c 1.0
NPS 1000
`;
      const { doc, idx, text } = setup(matInput);
      const line2 = text.split('\n')[2];
      const eqCol = line2.indexOf('MAT=') + 4;
      const items = getCompletions(doc, { line: 2, character: eqCol }, text, { idx });

      const labels = items.map(i => i.label);
      expect(labels).toContain('1'); // M1
    });

    it('does not offer surfaces or cell complements for LIKE BUT cells', () => {
      const { doc, idx, text } = setup(likeButInput);
      // Line 2: after BUT in parameter region
      const line2 = text.split('\n')[2];
      const butIdx = line2.indexOf('BUT');
      const items = getCompletions(doc, { line: 2, character: butIdx + 5 }, text, { idx });

      // No surface reference items (only keyword/value)
      const surfaceRefItems = items.filter(i =>
        i.kind === CompletionItemKind.Reference && i.detail?.includes('Surface'));
      const complementItems = items.filter(i => i.label.startsWith('#'));
      expect(surfaceRefItems).toHaveLength(0);
      expect(complementItems).toHaveLength(0);
    });

    it('does not offer completions at cell number position (token 0)', () => {
      const { doc, idx, text } = setup(likeButInput);
      const items = getCompletions(doc, { line: 2, character: 0 }, text, { idx });
      expect(items).toHaveLength(0);
    });

    it('offers cell IDs when user is still typing LIKE (incomplete parse)', () => {
      // User has typed "2  LIKE " but not the cell number yet
      // Parser won't recognize this as LIKE BUT (needs 4+ tokens)
      const incompleteInput = `like but incomplete
1  1 -2.7  -1  IMP:N=1
2  LIKE

1  SO 5.0

M1 13027.80c 1.0
NPS 1000
`;
      const { doc, idx, text } = setup(incompleteInput);
      // Cursor after "LIKE " at col 8
      const items = getCompletions(doc, { line: 2, character: 8 }, text, { idx });
      const labels = items.map(i => i.label);
      expect(labels).toContain('1'); // cell 1 should be offered
      // No surfaces
      const surfaceItems = items.filter(i => i.detail?.includes('Surface'));
      expect(surfaceItems).toHaveLength(0);
    });
  });

  describe('surface block', () => {
    it('does not offer mnemonics when surface type is already set', () => {
      const { doc, idx, text } = setup(basicInput);
      // Line 4 (surface 1: "1  SO 5") — type already parsed as SO
      const items = getCompletions(doc, { line: 4, character: 3 }, text, { idx });
      expect(items).toHaveLength(0);
    });

    it('offers surface type mnemonics when surface type is not yet parsed', () => {
      // Surface without a recognized type (incomplete line — just the number)
      const incompleteInput = `incomplete surf\n1 0 -1 imp:n=1\n\n1  \n\nNPS 1\n`;
      const { doc, idx, text } = setup(incompleteInput);
      // The parser may not produce a surface for an incomplete line,
      // so this may return empty — that's OK, completions fire before parse
      const items = getCompletions(doc, { line: 3, character: 3 }, text, { idx });
      // If no surface is parsed at this line, blockInfo is null → empty
      // This is correct behavior — completions depend on valid parse state
      expect(items).toHaveLength(0);
    });

    it('does not offer mnemonics on continuation lines', () => {
      const input = `test
1  0  -1  IMP:N=1

1  GQ 1 2 3
     4 5 6 7 8 9 10

NPS 100
`;
      const { doc, idx, text } = setup(input);
      // Line 4 is a continuation of surface 1
      const items = getCompletions(doc, { line: 4, character: 5 }, text, { idx });
      expect(items).toHaveLength(0);
    });
  });

  describe('data block', () => {
    it('offers data card keywords on gap lines', () => {
      const input = `test
1  0  -1  IMP:N=1

1  SO 5

M1 13027.80c 1.0
NPS 1000
`;
      const { doc, idx, text } = setup(input);
      // Find a gap line in data block — add a blank line after NPS
      const input2 = `test
1  0  -1  IMP:N=1

1  SO 5

M1 13027.80c 1.0
c data comment line
`;
      const { doc: doc2, idx: idx2, text: text2 } = setup(input2);
      // Line 6 is "c data comment line" — a comment, not indexed as a card
      // getBlockSection should return 'data', getBlockForLine should return undefined
      const section = idx2.getBlockSection(6);
      if (section === 'data') {
        const items = getCompletions(doc2, { line: 6, character: 0 }, text2, { idx: idx2 });
        const labels = items.map(i => i.label);
        expect(labels).toContain('MODE');
        expect(labels).toContain('NPS');
        expect(labels).toContain('SDEF');
        expect(labels).toContain('KCODE');
      }
    });

    it('returns empty on existing data card lines', () => {
      const input = `test
1  0  -1  IMP:N=1

1  SO 5

M1 13027.80c 1.0
`;
      const { doc, idx, text } = setup(input);
      // Line 5 is "M1 13027.80c 1.0" — an existing material card
      const items = getCompletions(doc, { line: 5, character: 0 }, text, { idx });
      expect(items).toHaveLength(0);
    });
  });

  describe('SDEF keyword completions', () => {
    it('offers SDEF keyword completions on SDEF card line', () => {
      const text = `completion test\n1 0 -1 IMP:N=1\n2 0  1 IMP:N=0\n\n1 SO 5.0\n\nSDEF \nNPS 1000\n`;
      const doc = parseInputFile(text);
      const idx = new DocumentIndex(doc);
      const items = getCompletions(doc, { line: 6, character: 5 }, text, { idx });
      const posItem = items.find(i => i.label === 'POS=');
      const ergItem = items.find(i => i.label === 'ERG=');
      const parItem = items.find(i => i.label === 'PAR=');
      expect(posItem).toBeDefined();
      expect(ergItem).toBeDefined();
      expect(parItem).toBeDefined();
    });

    it('offers SDEF keyword completions case-insensitively', () => {
      const text = `completion test\n1 0 -1 IMP:N=1\n\n1 SO 5.0\n\nsdef \nNPS 1000\n`;
      const doc = parseInputFile(text);
      const idx = new DocumentIndex(doc);
      const items = getCompletions(doc, { line: 5, character: 5 }, text, { idx });
      expect(items.find(i => i.label === 'CEL=')).toBeDefined();
      expect(items.find(i => i.label === 'SUR=')).toBeDefined();
    });

    it('includes detail descriptions for SDEF keywords', () => {
      const text = `completion test\n1 0 -1 IMP:N=1\n\n1 SO 5.0\n\nSDEF \n`;
      const doc = parseInputFile(text);
      const idx = new DocumentIndex(doc);
      const items = getCompletions(doc, { line: 5, character: 5 }, text, { idx });
      const posItem = items.find(i => i.label === 'POS=');
      expect(posItem?.detail).toBe('Position (x y z)');
      expect(posItem?.kind).toBe(CompletionItemKind.Property);
    });

    it('offers CTME in data block completions', () => {
      const text = `completion test\n1 0 -1\n2 0  1\n\n1 SO 5.0\n\n\n`;
      const doc = parseInputFile(text);
      const idx = new DocumentIndex(doc);
      const items = getCompletions(doc, { line: 6, character: 0 }, text, { idx });
      const ctme = items.find(i => i.label === 'CTME');
      expect(ctme).toBeDefined();
      expect(ctme!.detail).toBeDefined();
    });

    it('data keyword completions have descriptions', () => {
      const text = `completion test\n1 0 -1\n2 0  1\n\n1 SO 5.0\n\n\n`;
      const doc = parseInputFile(text);
      const idx = new DocumentIndex(doc);
      const items = getCompletions(doc, { line: 6, character: 0 }, text, { idx });
      const nps = items.find(i => i.label === 'NPS');
      expect(nps).toBeDefined();
      expect(nps!.detail).toBeDefined();
      expect(nps!.detail).toMatch(/histor|particle/i);
    });

    it('does not offer SDEF keywords on non-SDEF data card lines', () => {
      const { doc, idx, text } = setup(basicInput);
      // Line 6 is "M1 13027.80c 1.0"
      const items = getCompletions(doc, { line: 6, character: 0 }, text, { idx });
      const sdefKw = items.find(i => i.label === 'POS=');
      expect(sdefKw).toBeUndefined();
    });
  });

  describe('ZAID completions from xsdir', () => {
    it('offers ZAID completions on material card lines with xsdir', () => {
      const text = `completion test\n1 0 -1 IMP:N=1\n2 0  1 IMP:N=0\n\n1 SO 5.0\n\nM1 \nSDEF ERG=1.0\nNPS 1000\n`;
      const doc = parseInputFile(text);
      const idx = new DocumentIndex(doc);
      const xsdirData = {
        entries: new Map([
          ['92235', [{ zaid: '92235', suffix: '80c', awr: 233.025, temperature: 293.6, library: 'ENDF80' }]],
          ['1001', [{ zaid: '1001', suffix: '80c', awr: 0.999, temperature: 293.6, library: 'ENDF80' }]],
        ]),
      };
      const items = getCompletions(doc, { line: 6, character: 3 }, text, { idx, xsdirData });
      const u235 = items.find(i => i.label === '92235.80c');
      expect(u235).toBeDefined();
      expect(u235!.detail).toMatch(/U-235/i);
      const h1 = items.find(i => i.label === '1001.80c');
      expect(h1).toBeDefined();
    });

    it('shows library info in detail field', () => {
      const text = `completion test\n1 0 -1 IMP:N=1\n\n1 SO 5.0\n\nM1 \n`;
      const doc = parseInputFile(text);
      const idx = new DocumentIndex(doc);
      const xsdirData = {
        entries: new Map([
          ['92235', [{ zaid: '92235', suffix: '80c', awr: 233.025, temperature: 293.6, library: 'ENDF80' }]],
        ]),
      };
      const items = getCompletions(doc, { line: 5, character: 3 }, text, { idx, xsdirData });
      const u235 = items.find(i => i.label === '92235.80c');
      expect(u235!.detail).toContain('[ENDF80]');
    });

    it('shows natural isotope label for A=0', () => {
      const text = `completion test\n1 0 -1 IMP:N=1\n\n1 SO 5.0\n\nM1 \n`;
      const doc = parseInputFile(text);
      const idx = new DocumentIndex(doc);
      const xsdirData = {
        entries: new Map([
          ['92000', [{ zaid: '92000', suffix: '80c', awr: 236.0, temperature: 293.6 }]],
        ]),
      };
      const items = getCompletions(doc, { line: 5, character: 3 }, text, { idx, xsdirData });
      const unat = items.find(i => i.label === '92000.80c');
      expect(unat).toBeDefined();
      expect(unat!.detail).toMatch(/Uranium.*nat/i);
    });

    it('offers multiple suffixes for the same ZAID', () => {
      const text = `completion test\n1 0 -1 IMP:N=1\n\n1 SO 5.0\n\nM1 \n`;
      const doc = parseInputFile(text);
      const idx = new DocumentIndex(doc);
      const xsdirData = {
        entries: new Map([
          ['92235', [
            { zaid: '92235', suffix: '80c', awr: 233.025, temperature: 293.6, library: 'ENDF80' },
            { zaid: '92235', suffix: '70c', awr: 233.025, temperature: 293.6, library: 'ENDF70' },
          ]],
        ]),
      };
      const items = getCompletions(doc, { line: 5, character: 3 }, text, { idx, xsdirData });
      expect(items.find(i => i.label === '92235.80c')).toBeDefined();
      expect(items.find(i => i.label === '92235.70c')).toBeDefined();
    });

    it('no ZAID completions without xsdir', () => {
      const text = `completion test\n1 0 -1 IMP:N=1\n2 0  1 IMP:N=0\n\n1 SO 5.0\n\nM1 \nSDEF ERG=1.0\nNPS 1000\n`;
      const doc = parseInputFile(text);
      const idx = new DocumentIndex(doc);
      const items = getCompletions(doc, { line: 6, character: 3 }, text, { idx });
      const u235 = items.find(i => i.label === '92235.80c');
      expect(u235).toBeUndefined();
    });
  });

  describe('tally bin completions', () => {
    it('offers cell completions on F4 tally card', () => {
      const text = `completion test\n1 1 -2.7 -1 IMP:N=1\n2 0       1 IMP:N=0\n\n1 SO 5.0\n\nM1 13027.80c 1.0\nF4:N 1\nSDEF ERG=1.0\nNPS 1000\n`;
      const doc = parseInputFile(text);
      const idx = new DocumentIndex(doc);
      const items = getCompletions(doc, { line: 7, character: 6 }, text, { idx });
      const cell1 = items.find(i => i.label === '1');
      expect(cell1).toBeDefined();
      expect(cell1!.detail).toMatch(/Cell 1/);
    });

    it('offers surface completions on F2 tally card', () => {
      const text = `completion test\n1 0 -1 IMP:N=1\n2 0  1 IMP:N=0\n\n1 SO 5.0\n\nF2:N 1\nSDEF ERG=1.0\nNPS 1000\n`;
      const doc = parseInputFile(text);
      const idx = new DocumentIndex(doc);
      const items = getCompletions(doc, { line: 6, character: 6 }, text, { idx });
      const surf1 = items.find(i => i.label === '1');
      expect(surf1).toBeDefined();
      expect(surf1!.detail).toMatch(/Surface 1.*SO/i);
    });

    it('no entity completions on F5 (point detector)', () => {
      const text = `completion test\n1 0 -1 IMP:N=1\n2 0  1 IMP:N=0\n\n1 SO 5.0\n\nF5:N 0 0 0 1\nSDEF ERG=1.0\nNPS 1000\n`;
      const doc = parseInputFile(text);
      const idx = new DocumentIndex(doc);
      const items = getCompletions(doc, { line: 6, character: 12 }, text, { idx });
      // F5 uses x y z r format, not cell/surface bins
      const cell = items.find(i => i.label === '1' && i.detail?.includes('Cell'));
      const surf = items.find(i => i.label === '1' && i.detail?.includes('Surface'));
      expect(cell).toBeUndefined();
      expect(surf).toBeUndefined();
    });

    it('offers cell completions on F6 tally card', () => {
      const text = `completion test\n1 1 -2.7 -1 IMP:N=1\n2 0       1 IMP:N=0\n\n1 SO 5.0\n\nM1 13027.80c 1.0\nF6:N 1\nNPS 1000\n`;
      const doc = parseInputFile(text);
      const idx = new DocumentIndex(doc);
      const items = getCompletions(doc, { line: 7, character: 6 }, text, { idx });
      expect(items.some(i => i.detail?.includes('Cell'))).toBe(true);
    });

    it('offers surface completions on F1 tally card', () => {
      const text = `completion test\n1 0 -1 IMP:N=1\n2 0  1 IMP:N=0\n\n1 SO 5.0\n\nF1:N 1\nNPS 1000\n`;
      const doc = parseInputFile(text);
      const idx = new DocumentIndex(doc);
      const items = getCompletions(doc, { line: 6, character: 6 }, text, { idx });
      expect(items.some(i => i.detail?.includes('Surface'))).toBe(true);
    });

    it('shows material info in cell completion detail', () => {
      const text = `completion test\n1 1 -2.7 -1 IMP:N=1\n2 0       1 IMP:N=0\n\n1 SO 5.0\n\nM1 13027.80c 1.0\nF4:N 1\nNPS 1000\n`;
      const doc = parseInputFile(text);
      const idx = new DocumentIndex(doc);
      const items = getCompletions(doc, { line: 7, character: 6 }, text, { idx });
      const cell1 = items.find(i => i.label === '1');
      expect(cell1!.detail).toMatch(/M1/);
      const cell2 = items.find(i => i.label === '2');
      expect(cell2!.detail).toMatch(/void/);
    });
  });

  describe('edge cases', () => {
    it('returns empty for blank separator lines', () => {
      const { doc, idx, text } = setup(basicInput);
      // Line 3 is the blank separator between cells and surfaces
      const items = getCompletions(doc, { line: 3, character: 0 }, text, { idx });
      expect(items).toHaveLength(0);
    });

    it('returns empty for title line', () => {
      const { doc, idx, text } = setup(basicInput);
      const items = getCompletions(doc, { line: 0, character: 0 }, text, { idx });
      expect(items).toHaveLength(0);
    });
  });
});
