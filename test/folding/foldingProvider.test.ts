import { describe, it, expect } from 'vitest';
import { getFoldingRanges } from '../../server/src/folding/foldingProvider';
import { parseInputFile } from '../../server/src/parser/inputFile';

// FoldingRangeKind.Region === 'region' per LSP spec
const Region = 'region';

const inputText = `folding test
1  1  -2.7  -1
     2  IMP:N=1
2  0   1  IMP:N=0

1  SO  5.0
2  PX  10.0

M1  13027.80c  1.0
NPS 1000
`;

describe('getFoldingRanges', () => {
  const doc = parseInputFile(inputText);

  it('produces block-level Region folds for cells and surfaces', () => {
    const ranges = getFoldingRanges(doc);
    const regions = ranges.filter(r => r.kind === Region);
    // Should have cell block region (2 cells), surface block region (2 surfaces)
    expect(regions.length).toBeGreaterThanOrEqual(2);
  });

  it('produces card-level fold for multi-line cell', () => {
    const ranges = getFoldingRanges(doc);
    // Cell 1 spans lines 1-2 (continuation), should have a card-level fold
    const cardFolds = ranges.filter(r => r.kind !== Region);
    const multiLineFold = cardFolds.find(r => r.startLine === 1 && r.endLine === 2);
    expect(multiLineFold).toBeDefined();
  });

  it('does not produce card-level fold for single-line card', () => {
    const ranges = getFoldingRanges(doc);
    const cardFolds = ranges.filter(r => r.kind !== Region);
    // Cell 2 is single-line, should not have a fold
    const singleLineFolds = cardFolds.filter(r => r.startLine === r.endLine);
    expect(singleLineFolds.length).toBe(0);
  });

  it('handles empty document', () => {
    const emptyDoc = parseInputFile('empty doc\n\n\n');
    const ranges = getFoldingRanges(emptyDoc);
    expect(ranges.length).toBe(0);
  });
});
