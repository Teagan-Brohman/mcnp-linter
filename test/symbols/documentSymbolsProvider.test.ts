import { describe, it, expect } from 'vitest';
import { getDocumentSymbols } from '../../server/src/symbols/documentSymbolsProvider';
import { parseInputFile } from '../../server/src/parser/inputFile';
import { SymbolKind } from 'vscode-languageserver/node';

const inputText = `document symbols test
1  1  -2.7  -1  IMP:N=1            $ Fuel rod
2  0         1  IMP:N=0             $ Outside

1  SO  5.0

M1  13027.80c  1.0                  $ Aluminum
MT1  al27.12t
F4:N  1
`;

describe('getDocumentSymbols', () => {
  const doc = parseInputFile(inputText);

  it('returns symbols for all card types', () => {
    const symbols = getDocumentSymbols(doc, inputText);
    expect(symbols.length).toBeGreaterThanOrEqual(5); // 2 cells + 1 surface + 1 mat + 1 thermal + 1 tally
  });

  it('cell symbols have Class kind and material detail', () => {
    const symbols = getDocumentSymbols(doc, inputText);
    const cellSymbols = symbols.filter(s => s.kind === SymbolKind.Class);
    expect(cellSymbols.length).toBe(2);
    expect(cellSymbols[0].name).toContain('Cell 1');
    expect(cellSymbols[0].name).toContain('Fuel rod');
    expect(cellSymbols[0].detail).toBe('mat 1');
    expect(cellSymbols[1].detail).toBe('void');
  });

  it('surface symbols have Interface kind', () => {
    const symbols = getDocumentSymbols(doc, inputText);
    const surfSymbols = symbols.filter(s => s.kind === SymbolKind.Interface);
    expect(surfSymbols.length).toBe(1);
    expect(surfSymbols[0].name).toContain('Surface 1');
    expect(surfSymbols[0].detail).toBe('SO');
  });

  it('material symbols show component count', () => {
    const symbols = getDocumentSymbols(doc, inputText);
    const matSymbols = symbols.filter(s => s.kind === SymbolKind.Variable);
    expect(matSymbols.length).toBe(1);
    expect(matSymbols[0].name).toContain('Material 1');
    expect(matSymbols[0].name).toContain('Aluminum');
    expect(matSymbols[0].detail).toContain('1 component');
  });

  it('tally symbols have Function kind', () => {
    const symbols = getDocumentSymbols(doc, inputText);
    const tallySymbols = symbols.filter(s => s.kind === SymbolKind.Function);
    expect(tallySymbols.length).toBe(1);
    expect(tallySymbols[0].name).toContain('F4');
    expect(tallySymbols[0].detail).toContain('track length');
  });

  it('thermal symbols have Event kind', () => {
    const symbols = getDocumentSymbols(doc, inputText);
    const thermalSymbols = symbols.filter(s => s.kind === SymbolKind.Event);
    expect(thermalSymbols.length).toBe(1);
    expect(thermalSymbols[0].name).toContain('MT 1');
    expect(thermalSymbols[0].detail).toContain('al27.12t');
  });
});
