import { describe, it, expect } from 'vitest';
import { getWorkspaceSymbols } from '../../server/src/symbols/workspaceSymbolsProvider';
import { parseInputFile } from '../../server/src/parser/inputFile';
import { DocumentIndex } from '../../server/src/analysis/documentIndex';

const inputText1 = `workspace symbols test 1
1  1  -2.7  -1  IMP:N=1          $ Fuel rod
2  0         1  IMP:N=0

1  SO  5.0

M1  13027.80c  1.0
`;

const inputText2 = `workspace symbols test 2
10  0  -1  IMP:N=1                $ Shield
20  0   1  IMP:N=0

1  CZ  3.0

M2  26000.80c  1.0
`;

function makeDocEntry(uri: string, text: string) {
  const doc = parseInputFile(text);
  const idx = new DocumentIndex(doc);
  return { uri, doc, text, idx };
}

describe('getWorkspaceSymbols', () => {
  const docs = [
    makeDocEntry('file:///a.mcnp', inputText1),
    makeDocEntry('file:///b.mcnp', inputText2),
  ];

  it('returns all symbols when query is empty', () => {
    const results = getWorkspaceSymbols('', docs);
    // At least 2 cells + 1 surface + 1 material from each doc
    expect(results.length).toBeGreaterThanOrEqual(8);
  });

  it('filters by query string (case-insensitive)', () => {
    const results = getWorkspaceSymbols('fuel', docs);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].name.toLowerCase()).toContain('fuel');
  });

  it('includes correct URI for each symbol', () => {
    const results = getWorkspaceSymbols('Shield', docs);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].location.uri).toBe('file:///b.mcnp');
  });

  it('finds material symbols', () => {
    const results = getWorkspaceSymbols('Material 2', docs);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});
