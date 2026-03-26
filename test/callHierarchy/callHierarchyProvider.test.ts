import { describe, it, expect } from 'vitest';
import { prepareCallHierarchy, getIncomingCalls, getOutgoingCalls } from '../../server/src/callHierarchy/callHierarchyProvider';
import { parseInputFile } from '../../server/src/parser/inputFile';
import { DocumentIndex } from '../../server/src/analysis/documentIndex';
import { UniverseMap } from '../../server/src/analysis/universeMap';

const input = `call hierarchy test
1  0  -1  FILL=1 IMP:N=1
2  0  -2  U=1 FILL=2 IMP:N=1
3  1  -1.0  -3  U=2 IMP:N=1
4  0   1  IMP:N=0

1  SO 10
2  SO 5
3  SO 2

M1  1001.80c  1.0
`;

const uri = 'file:///test.i';

function setup() {
  const doc = parseInputFile(input);
  const idx = new DocumentIndex(doc);
  const um = new UniverseMap(doc);
  return { doc, idx, um };
}

describe('prepareCallHierarchy', () => {
  it('returns item for cursor on a cell line', () => {
    const { doc, idx, um } = setup();
    // Line 1 is cell 1
    const result = prepareCallHierarchy(doc, { line: 1, character: 0 }, input, uri, { idx, um });
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].name).toBe('Cell 1');
  });

  it('returns null for cursor on a surface line', () => {
    const { doc, idx, um } = setup();
    // Line 6 is surface 1
    const result = prepareCallHierarchy(doc, { line: 6, character: 0 }, input, uri, { idx, um });
    expect(result).toBeNull();
  });
});

describe('getOutgoingCalls', () => {
  it('returns cells in filled universe for cell with FILL', () => {
    const { doc, idx, um } = setup();
    // Cell 1 has FILL=1, so outgoing should be cell 2 (U=1)
    const prepResult = prepareCallHierarchy(doc, { line: 1, character: 0 }, input, uri, { idx, um });
    expect(prepResult).not.toBeNull();

    const outgoing = getOutgoingCalls(doc, prepResult![0], input, uri, { idx, um });
    expect(outgoing).toHaveLength(1);
    expect(outgoing[0].to.name).toBe('Cell 2');
  });

  it('returns empty for cell without FILL', () => {
    const { doc, idx, um } = setup();
    // Cell 3 has no FILL
    const prepResult = prepareCallHierarchy(doc, { line: 3, character: 0 }, input, uri, { idx, um });
    expect(prepResult).not.toBeNull();

    const outgoing = getOutgoingCalls(doc, prepResult![0], input, uri, { idx, um });
    expect(outgoing).toHaveLength(0);
  });
});

describe('getIncomingCalls', () => {
  it('returns cells that fill the universe this cell belongs to', () => {
    const { doc, idx, um } = setup();
    // Cell 2 is in U=1, cell 1 has FILL=1 → cell 1 is incoming
    const prepResult = prepareCallHierarchy(doc, { line: 2, character: 0 }, input, uri, { idx, um });
    expect(prepResult).not.toBeNull();

    const incoming = getIncomingCalls(doc, prepResult![0], input, uri, { idx, um });
    expect(incoming).toHaveLength(1);
    expect(incoming[0].from.name).toBe('Cell 1');
  });

  it('returns empty for cell in real world (U=0)', () => {
    const { doc, idx, um } = setup();
    // Cell 1 is in U=0 (real world)
    const prepResult = prepareCallHierarchy(doc, { line: 1, character: 0 }, input, uri, { idx, um });
    expect(prepResult).not.toBeNull();

    const incoming = getIncomingCalls(doc, prepResult![0], input, uri, { idx, um });
    expect(incoming).toHaveLength(0);
  });
});
