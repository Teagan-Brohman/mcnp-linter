import { describe, it, expect } from 'vitest';
import { getSemanticTokens, TOKEN_TYPES, TOKEN_MODIFIERS } from '../../server/src/semanticTokens/semanticTokensProvider';
import { parseInputFile } from '../../server/src/parser/inputFile';
import { DocumentIndex } from '../../server/src/analysis/documentIndex';

const input = [
  'semantic tokens test',
  '1  1  -2.7  -1 2  IMP:N=1',
  '2  0         1    IMP:N=0',
  '',
  '1  SO  5.0',
  '',
  'M1  92235.80c  1.0',
].join('\n');

describe('getSemanticTokens', () => {
  it('produces non-empty token data', () => {
    const doc = parseInputFile(input);
    const idx = new DocumentIndex(doc);
    const result = getSemanticTokens(doc, input, { idx }).build();
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('TOKEN_TYPES contains expected entries', () => {
    expect(TOKEN_TYPES).toContain('class');
    expect(TOKEN_TYPES).toContain('interface');
    expect(TOKEN_TYPES).toContain('variable');
    expect(TOKEN_TYPES).toContain('number');
    expect(TOKEN_TYPES).toContain('keyword');
  });

  it('TOKEN_MODIFIERS contains declaration', () => {
    expect(TOKEN_MODIFIERS).toContain('declaration');
  });

  it('tokens are in document order (encoded data has non-negative deltas)', () => {
    const doc = parseInputFile(input);
    const idx = new DocumentIndex(doc);
    const result = getSemanticTokens(doc, input, { idx }).build();
    const data = result.data;
    // SemanticTokens data is encoded as groups of 5:
    // [deltaLine, deltaStartChar, length, tokenType, tokenModifiers]
    // deltaLine >= 0 always; when deltaLine === 0, deltaStartChar >= 0
    for (let i = 0; i < data.length; i += 5) {
      const deltaLine = data[i];
      const deltaChar = data[i + 1];
      expect(deltaLine).toBeGreaterThanOrEqual(0);
      if (deltaLine === 0 && i > 0) {
        expect(deltaChar).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('highlights cell numbers, surface refs, material IDs, ZAIDs, and keywords', () => {
    const doc = parseInputFile(input);
    const idx = new DocumentIndex(doc);
    const result = getSemanticTokens(doc, input, { idx }).build();
    const data = result.data;

    // Decode tokens back to absolute positions
    const decoded: { line: number; col: number; length: number; type: number; mod: number }[] = [];
    let line = 0, col = 0;
    for (let i = 0; i < data.length; i += 5) {
      line += data[i];
      if (data[i] > 0) col = 0;
      col += data[i + 1];
      decoded.push({ line, col, length: data[i + 2], type: data[i + 3], mod: data[i + 4] });
    }

    // Cell number declarations (type=0, mod=1) for cells 1 and 2
    const cellDecls = decoded.filter(t => t.type === 0 && t.mod === 1);
    expect(cellDecls.length).toBe(2);

    // Surface declaration (type=1, mod=1)
    const surfDecls = decoded.filter(t => t.type === 1 && t.mod === 1);
    expect(surfDecls.length).toBe(1);

    // Material declaration M1 (type=2, mod=1)
    const matDecls = decoded.filter(t => t.type === 2 && t.mod === 1);
    expect(matDecls.length).toBe(1);

    // Surface refs in geometry (type=1, mod=0)
    const surfRefs = decoded.filter(t => t.type === 1 && t.mod === 0);
    expect(surfRefs.length).toBeGreaterThanOrEqual(2); // -1, 2, 1

    // Material ID reference on cell line (type=2, mod=0)
    const matRefs = decoded.filter(t => t.type === 2 && t.mod === 0);
    expect(matRefs.length).toBe(1); // cell 1 has mat 1; cell 2 has mat 0 (void, skipped)

    // ZAID (type=3, mod=0)
    const zaids = decoded.filter(t => t.type === 3 && t.mod === 0);
    expect(zaids.length).toBe(1); // 92235.80c

    // Keywords (type=4, mod=0)
    const keywords = decoded.filter(t => t.type === 4 && t.mod === 0);
    expect(keywords.length).toBe(2); // IMP:N on both cells
  });
});
