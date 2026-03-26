import { describe, it, expect } from 'vitest';
import { getSelectionRanges } from '../../server/src/selectionRange/selectionRangeProvider';
import { parseInputFile } from '../../server/src/parser/inputFile';
import { DocumentIndex } from '../../server/src/analysis/documentIndex';
import { SelectionRange } from 'vscode-languageserver/node';

const inputText = `selection range test
1  1  -2.7  -1
     2  IMP:N=1
2  0   1  IMP:N=0

1  SO  5.0
2  PX  10.0

M1  13027.80c  1.0
`;

function collectChain(sr: SelectionRange): SelectionRange[] {
  const chain: SelectionRange[] = [];
  let current: SelectionRange | undefined = sr;
  while (current) {
    chain.push(current);
    current = current.parent;
  }
  return chain;
}

describe('getSelectionRanges', () => {
  const doc = parseInputFile(inputText);
  const idx = new DocumentIndex(doc);

  it('multi-line cell: token → line → card → block chain on continuation line', () => {
    // Line 2 (0-based) is "     2  IMP:N=1" — continuation of cell 1
    // Cursor on character 5, which is '2'
    const ranges = getSelectionRanges(doc, [{ line: 2, character: 5 }], inputText, { idx });
    expect(ranges).toHaveLength(1);

    const chain = collectChain(ranges[0]);
    // Should have 4 levels: token → line → card → block
    expect(chain.length).toBe(4);

    // Token: '2' at col 5-6
    expect(chain[0].range.start).toEqual({ line: 2, character: 5 });
    expect(chain[0].range.end).toEqual({ line: 2, character: 6 });

    // Line: full line 2
    expect(chain[1].range.start).toEqual({ line: 2, character: 0 });
    expect(chain[1].range.end.line).toBe(2);

    // Card: cell 1 spanning lines 1-2
    expect(chain[2].range.start.line).toBe(1);
    expect(chain[2].range.end.line).toBe(2);

    // Block: entire cell block
    expect(chain[3].range.start.line).toBe(1);
    expect(chain[3].range.end.line).toBe(3);
  });

  it('single-line card: token → line → block (no card level)', () => {
    // Line 5 (0-based) is "1  SO  5.0" — single-line surface
    const ranges = getSelectionRanges(doc, [{ line: 5, character: 3 }], inputText, { idx });
    expect(ranges).toHaveLength(1);

    const chain = collectChain(ranges[0]);
    // Should have 3 levels: token → line → block (no card level since single-line)
    expect(chain.length).toBe(3);

    // Token: 'SO'
    expect(chain[0].range.start).toEqual({ line: 5, character: 3 });
    expect(chain[0].range.end).toEqual({ line: 5, character: 5 });

    // Line: full line
    expect(chain[1].range.start).toEqual({ line: 5, character: 0 });
    expect(chain[1].range.end.line).toBe(5);

    // Block: surface block (spans both surfaces, lines 5-6)
    expect(chain[2].range.start.line).toBe(5);
    expect(chain[2].range.end.line).toBe(6);
  });

  it('block range covers correct span for cell block', () => {
    const ranges = getSelectionRanges(doc, [{ line: 1, character: 0 }], inputText, { idx });
    const chain = collectChain(ranges[0]);
    const blockRange = chain[chain.length - 1].range;
    // Cell block should span from cell 1 start to cell 2 end
    expect(blockRange.start.line).toBe(1);
    expect(blockRange.end.line).toBe(3);
  });

  it('handles multiple positions', () => {
    const ranges = getSelectionRanges(
      doc,
      [{ line: 1, character: 0 }, { line: 5, character: 0 }],
      inputText,
      { idx }
    );
    expect(ranges).toHaveLength(2);
  });

  it('handles cursor on whitespace', () => {
    // Line 2 starts with spaces
    const ranges = getSelectionRanges(doc, [{ line: 2, character: 0 }], inputText, { idx });
    expect(ranges).toHaveLength(1);
    const chain = collectChain(ranges[0]);
    // Token should be zero-width at cursor
    expect(chain[0].range.start.character).toBe(0);
    expect(chain[0].range.end.character).toBe(0);
  });
});
